import * as vscode from "vscode";
import {
    parsePrUrl,
    fetchPrDetails,
    fetchPrChanges,
    isSupportedChange,
    getFilePatch,
    saveFile
} from "../utils/azureDevOps";
import { getDecryptedPAT } from "../utils/encryption";

const adoApiVersion = "7.1";

export function registerDownloadChangedFilesCommand(context: vscode.ExtensionContext) {
    const downloadChangedFilesCommand = vscode.commands.registerCommand(
        "adopr-helper.downloadChangedFiles",
        async () => {
            try {
                await handleDownloadChangedFiles();
            } catch (err: any) {
                console.error(err);
                vscode.window.showErrorMessage(`Failed to process PR: ${err.message}`);
            }
        }
    );
    context.subscriptions.push(downloadChangedFilesCommand);
}

async function handleDownloadChangedFiles(): Promise<void> {
    const prUrl = await vscode.window.showInputBox({
        prompt: "Enter the Azure DevOps Pull Request URL",
        ignoreFocusOut: true,
    });

    if (!prUrl) {
        vscode.window.showWarningMessage("No PR URL provided.");
        return;
    }

    const parsedUrl = parsePrUrl(prUrl);
    if (!parsedUrl) {
        vscode.window.showErrorMessage("Invalid Azure DevOps PR URL format.");
        return;
    }

    const { organization, project, repository, pullRequestId } = parsedUrl;

    vscode.window.showInformationMessage(
        `Parsed PR URL:\nOrganization: ${organization}\nProject: ${project}\nRepository: ${repository}\nPull Request ID: ${pullRequestId}`
    );

    // Fetch PAT from encrypted storage
    const pat = getDecryptedPAT();

    if (!pat) {
        vscode.window.showErrorMessage("Azure DevOps PAT not set. Please run 'Set Azure DevOps PAT' first.");
        return;
    }

    const basicToken = Buffer.from(`:${pat}`).toString("base64");
    const headers = {
        Authorization: `Basic ${basicToken}`,
        Accept: "application/json",
    };
    const baseUrl = `https://dev.azure.com/${organization}/${project}/_apis/git/repositories/${repository}`;

    // Get PR details and validate
    const prDetailsUrl = `${baseUrl}/pullRequests/${pullRequestId}?api-version=${adoApiVersion}`;
    const prDetails = await fetchPrDetails(prDetailsUrl, headers);

    if (prDetails.status !== "active") {
        vscode.window.showErrorMessage("The PR is not active.");
        return;
    }

    if (prDetails.mergeStatus !== "succeeded") {
        vscode.window.showErrorMessage("The PR has merge conflict.");
        return;
    }

    const sourceBranch = encodeURIComponent(prDetails.sourceRefName?.replace("refs/heads/", ""));
    const targetBranch = encodeURIComponent(prDetails.targetRefName?.replace("refs/heads/", ""));

    if (!sourceBranch || !targetBranch) {
        vscode.window.showErrorMessage("Could not determine source or target branch from PR details.");
        return;
    }

    // Get PR changes
    const diffsUrl = `${baseUrl}/diffs/commits?baseVersion=${targetBranch}&targetVersion=${sourceBranch}&$top=2000&api-version=${adoApiVersion}`;

    const changes = await fetchPrChanges(diffsUrl, headers);

    if (changes.length === 0) {
        vscode.window.showInformationMessage("No changed files found in this PR.");
        return;
    }

    // Filter supported files
    const fileItems = changes
        .filter(c => isSupportedChange(c))
        .map(c => c.item);

    if (fileItems.length === 0) {
        vscode.window.showInformationMessage("No supported code file found in this PR.");
        return;
    }

    vscode.window.showInformationMessage(
        `Changed files to download:\n${fileItems.map(f => f.path).join("\n")}`,
        { modal: true }
    );

    // Download files in parallel with concurrency limit (moved to utils)
    const downloadFolder = vscode.Uri.joinPath(vscode.workspace.workspaceFolders?.[0].uri!, "PR_FOLDER");
    await vscode.workspace.fs.createDirectory(downloadFolder);

    const tasks = fileItems.map(f => getFilePatch(f, baseUrl, adoApiVersion, headers));
    const filePatches = await Promise.all(tasks);

    for (const { fileName, oldContent, patch } of filePatches) {
        await saveFile(oldContent || "", fileName, downloadFolder);
    }

    const patchContent = filePatches.map(f => f.patch).join("\n");
    await saveFile(patchContent, "patch.diff", downloadFolder);
    vscode.window.showInformationMessage(`Downloaded files to ${downloadFolder.fsPath}`);

    await createInstructionsFile(fileItems.map(f => f.path), downloadFolder);
    vscode.window.showInformationMessage("Instructions file created");
}

async function createInstructionsFile(fileNames: string[], downloadFolder: vscode.Uri): Promise<void> {
    const instructions = `
Please review the following code changes as if you were commenting on a GitHub pull request.
Here is the unified diff file (patch):
- patch.diff

Here are the original code files (if needed for context):
${fileNames.map(n => `- ${n}`).join("\n")}

Please generate inline review comments, suggestions, and highlight any issues, improvements, or best practices, just like a GitHub PR review.
`;
    await saveFile(instructions, "instructions.md", downloadFolder);
}