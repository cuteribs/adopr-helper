// The module 'vscode' contains the VS Code extensibility API
// Import the module and reference it with the alias vscode in your code below
import * as vscode from "vscode";
import fetch from 'node-fetch';

// This method is called when your extension is activated
// Your extension is activated the very first time the command is executed
export function activate(context) {
  // Use the console to output diagnostic information (console.log) and errors (console.error)
  // This line of code will only be executed once when your extension is activated
  console.log('Congratulations, your extension "adopr-helper" is now active!');

  const adoApiVersion = "7.1"; // Adjust API version as needed

  const setPatCommand = vscode.commands.registerCommand(
    "adopr-helper.setPAT",
    async () => {
      const pat = await vscode.window.showInputBox({
        prompt: "Enter your Azure DevOps Personal Access Token (PAT)",
        ignoreFocusOut: true,
        password: true,
      });
      if (pat !== undefined) {
        await vscode.workspace
          .getConfiguration("adopr-helper")
          .update("pat", pat, vscode.ConfigurationTarget.Global);
        vscode.window.showInformationMessage(
          "Azure DevOps PAT saved successfully."
        );
      }
    }
  );

  const downloadChangedFilesCommand = vscode.commands.registerCommand(
    "adopr-helper.downloadChangedFiles",
    async () => {
      const prUrl = await vscode.window.showInputBox({
        prompt: "Enter the Azure DevOps Pull Request URL",
        ignoreFocusOut: true,
      });

      if (!prUrl) {
        vscode.window.showWarningMessage("No PR URL provided.");
        return;
      }

      // Example PR URL:
      // https://dev.azure.com/{organization}/{project}/_git/{repository}/pullrequest/{pullRequestId}
      // https://{org}.visualstudio.com/{project}/_git/{repository}/pullrequest/{id}
      const devAzureRegex = /https:\/\/dev\.azure\.com\/(.+?)\/(.+?)\/_git\/(.+?)\/pullrequest\/(\d+)/i;
      const visualStudioRegex = /https:\/\/(.+?)\.visualstudio\.com\/(.+?)\/_git\/(.+?)\/pullrequest\/(\d+)/i;
      let match = prUrl.match(devAzureRegex);
      let organization, project, repository, pullRequestId;

      if (match) {
        [, organization, project, repository, pullRequestId] = match;
      } else {
        match = prUrl.match(visualStudioRegex);

        if (match) {
          [, organization, project, repository, pullRequestId] = match;
        } else {
          vscode.window.showErrorMessage("Invalid Azure DevOps PR URL format.");
          return;
        }
      }

      vscode.window.showInformationMessage(
        `Parsed PR URL:\nOrganization: ${organization}\nProject: ${project}\nRepository: ${repository}\nPull Request ID: ${pullRequestId}`
      );

      // Fetch PAT from settings
      const pat = vscode.workspace.getConfiguration("adopr-helper").get<string>("pat");

      if (!pat) {
        vscode.window.showErrorMessage("Azure DevOps PAT not set. Please run 'Set Azure DevOps PAT' first.");
        return;
      }

	  const basicToken = Buffer.from(`:${pat}`).toString("base64");
	  const headers =  {
            "Authorization": `Basic ${basicToken}`,
            "Accept": "application/json"
      };
      // 1. Get PR details to find source and target branch names
	  const baseUrl = prUrl.includes('dev.azure.com')
	  	? `https://dev.azure.com/${organization}`
		: `https://${organization}.visualstudio.com`;
      const prDetailsUrl = `${baseUrl}/${project}/_apis/git/repositories/${repository}/pullRequests/${pullRequestId}?api-version=${adoApiVersion}`;
	  
      try {
        const prDetailsResponse = await fetch(prDetailsUrl, { headers: headers });

        if (!prDetailsResponse.ok) {
          throw new Error(`HTTP ${prDetailsResponse.status}: ${prDetailsResponse.statusText}`);
        }

        const prDetails = await prDetailsResponse.json();

		if(prDetails.status !== "active") {
		  vscode.window.showErrorMessage('The PR is not active.');
          return;
		}

		if (prDetails.mergeStatus !== "succeeded") {
          vscode.window.showErrorMessage('The PR has merge conflict.');
          return;
		}

        const sourceBranch = prDetails.sourceRefName?.replace('refs/heads/', '');
        const targetBranch = prDetails.targetRefName?.replace('refs/heads/', '');

        if (!sourceBranch || !targetBranch) {
          vscode.window.showErrorMessage('Could not determine source or target branch from PR details.');
          return;
        }

        // 2. Use /diffs/commits endpoint
        const diffsUrl = `${baseUrl}/${project}/_apis/git/repositories/${repository}/diffs/commits?baseVersion=${encodeURIComponent(targetBranch)}&targetVersion=${encodeURIComponent(sourceBranch)}&$top=2000&api-version=${adoApiVersion}`;

        const diffsResponse = await fetch(diffsUrl, { headers: headers });

        if (!diffsResponse.ok) {
          throw new Error(`HTTP ${diffsResponse.status}: ${diffsResponse.statusText}`);
        }

        const diffsData = await diffsResponse.json();
        const changes = diffsData.changes || [];

        if (changes.length === 0) {
          vscode.window.showInformationMessage("No changed files found in this PR.");
          return;
        }

        // Supported file extensions whitelist
        const supportedExtensions = [
          '.ts', '.js', '.json', '.md', '.txt', '.py', '.java', '.c', '.cpp', '.h', '.cs', '.go', '.rb', '.php', '.sh', '.xml', '.yml', '.yaml', '.html', '.css', '.scss', '.less', '.ini', '.cfg', '.bat', '.ps1', '.sql', '.rs', '.kt', '.swift', '.m', '.pl', '.r', '.dart', '.scala', '.vue', '.svelte', '.tsx', '.jsx'
        ];
		
        // Exclude binary files and filter by extension, and use the downloadUrl from the diffs endpoint
		const isSupportedExtension = (diff) => {
		  return diff.path && !diff.isFolder && diff.url && supportedExtensions.some(ext => diff.path.toLowerCase().endsWith(ext));
		};

        const fileItems = changes
          .filter((c) => isSupportedExtension(c.item))
          .map((c) => ({ path: c.item.path, url: c.item.url }));

        if (fileItems.length === 0) {
          vscode.window.showInformationMessage("No supported code file found in this PR.");
          return;
        }

        vscode.window.showInformationMessage(
          `Changed files to download:\n${fileItems.map(f => f.path).join("\n")}`, { modal: true }
        );

        // Download each changed file from the source branch to a fixed folder using the provided downloadUrl
        const downloadFolder = vscode.Uri.joinPath(vscode.workspace.workspaceFolders[0].uri, 'downloaded-pr-files');
        await vscode.workspace.fs.createDirectory(downloadFolder);

        for (const file of fileItems) {
          try {
            const fileResponse = await fetch(file.url, { headers });

            if (!fileResponse.ok) {
              vscode.window.showWarningMessage(`Failed to download ${file.path}: HTTP ${fileResponse.status}`);
              continue;
            }
			
            const fileContent = await fileResponse.text();
            const fullFilePath = vscode.Uri.joinPath(downloadFolder, file.path.replace(/^\//, ''));
            // Ensure parent directories exist
            await vscode.workspace.fs.createDirectory(fullFilePath.with({ path: fullFilePath.path.substring(0, fullFilePath.path.lastIndexOf('/')) }));
            await vscode.workspace.fs.writeFile(fullFilePath, Buffer.from(fileContent, 'utf8'));
          } catch (err) {
            vscode.window.showWarningMessage(`Error downloading ${file.path}: ${err.message}`);
          }
        }
        vscode.window.showInformationMessage(`Downloaded ${fileItems.length} files to ${downloadFolder.fsPath}`);
      } catch (err) {
        vscode.window.showErrorMessage(`Failed to fetch PR changes: ${err.message}`);
      }
    }
  );

  context.subscriptions.push(setPatCommand);
  context.subscriptions.push(downloadChangedFilesCommand);
}

// This method is called when your extension is deactivated
export function deactivate() {}
