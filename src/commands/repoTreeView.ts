import * as vscode from 'vscode';
import { setProject, setRepo, showCurrentSelections } from '../utils/workspace';
import { fetchProjects } from '../utils/azureDevOps';
import { getDecryptedPAT, storeEncryptedPAT } from '../utils/encryption';
import { ProjectTreeItem, ProjectTreeProvider } from '../providers/ProjectTreeProvider';

export function registerRepoTreeView(context: vscode.ExtensionContext) {
    const repoTreeProvider = new ProjectTreeProvider();

    // Register the tree data provider
    const treeView = vscode.window.createTreeView('adopr-helper.view', {
        treeDataProvider: repoTreeProvider,
        showCollapseAll: true
    });

    const setPatCommand = vscode.commands.registerCommand(
        "adopr-helper.setPAT",
        async () => {
            try {
                const pat = await vscode.window.showInputBox({
                    prompt: "Enter your Azure DevOps Personal Access Token (PAT)",
                    ignoreFocusOut: true,
                    password: true,
                });

                if (!pat) {
                    vscode.window.showWarningMessage("No PAT provided.");
                    return;
                }

                // Store the PAT using encryption
                await storeEncryptedPAT(pat);

                vscode.window.showInformationMessage(
                    "Azure DevOps PAT saved securely with machine-specific encryption."
                );
            } catch (error: any) {
                console.error('Failed to set PAT:', error);
                vscode.window.showErrorMessage(`Failed to save PAT: ${error.message}`);
            }
        }
    );

    // Register commands
    const refreshCommand = vscode.commands.registerCommand('adopr-helper.refreshRepos', () => {
        repoTreeProvider.refresh();
    });

    const selectRepoCommand = vscode.commands.registerCommand('adopr-helper.selectRepo', async (repo: ProjectTreeItem) => {
        await setRepo(repo.name);
        vscode.window.showInformationMessage(`Selected repository: ${repo.name}`);
    });

    const selectProjectCommand = vscode.commands.registerCommand(
        'adopr-helper.selectProject',
        async (project: ProjectTreeItem) => {
            await setProject(project.name);
            vscode.window.showInformationMessage(`Selected project: ${project.name}`);
        }
    );

    const setOrgCommand = vscode.commands.registerCommand(
        'adopr-helper.setOrg',
        async () => {
            let org = vscode.workspace.getConfiguration().get<string>('adopr-helper.org');
            org = await vscode.window.showInputBox({
                prompt: 'Enter your Azure DevOps Organization name',
                placeHolder: org || 'e.g., mycompany',
                ignoreFocusOut: true
            });

            if (org) {
                await vscode.workspace.getConfiguration()
                    .update(
                        'adopr-helper.org',
                        org,
                        vscode.ConfigurationTarget.Global
                    );
                repoTreeProvider.refresh();
                vscode.window.showInformationMessage(`Organization set to: ${org}`);
            }
        }
    );

    const setProjectCommand = vscode.commands.registerCommand(
        'adopr-helper.setProject',
        async () => {
            try {
                // Get PAT and organization
                const pat = getDecryptedPAT();
                if (!pat) {
                    vscode.window.showErrorMessage('Failed to decrypt PAT. Please re-enter your PAT.');
                    return;
                }

                const org = vscode.workspace.getConfiguration().get<string>('adopr-helper.org');
                if (!org) {
                    vscode.window.showErrorMessage('Azure DevOps Organization not set. Please set your organization first.');
                    return;
                }

                const projects = await fetchProjects(org, pat);

                if (projects.length === 0) {
                    vscode.window.showInformationMessage('No projects found in this organization.');
                    return;
                }

                // Create QuickPick items
                const items: vscode.QuickPickItem[] = [];

                for (const p of projects) {
                    items.push({
                        label: p.name,
                        description: p.id,
                        detail: p.description || ' ',
                        iconPath: p.visibility === 'public'
                            ? new vscode.ThemeIcon('eye')
                            : new vscode.ThemeIcon('eye-closed')
                    });
                    items.push({
                        label: '',
                        kind: vscode.QuickPickItemKind.Separator
                    });
                }

                // Show QuickPick
                const selectedItem = await vscode.window.showQuickPick(items, {
                    placeHolder: 'Select an Azure DevOps project',
                    matchOnDescription: true,
                    matchOnDetail: true,
                    ignoreFocusOut: true
                });

                if (selectedItem) {
                    // Find the full project data
                    const selectedProject = projects.find(p => p.name === selectedItem.label);

                    if (selectedProject) {
                        // Store the selected project
                        await setProject(selectedProject.name);

                        vscode.window.showInformationMessage(`Project set to: ${selectedProject.name}`);

                        // Refresh the tree view
                        repoTreeProvider.refresh();
                    }
                }
            } catch (error: any) {
                console.error('Error setting project:', error);
                vscode.window.showErrorMessage(`Failed to load projects: ${error.message}`);
            }
        }
    );

    const showSelectionsCommand = vscode.commands.registerCommand('adopr-helper.showSelections', () => {
        showCurrentSelections();
    });

    // Add to subscriptions
    context.subscriptions.push(
        treeView,
        refreshCommand,
        setPatCommand,
        selectRepoCommand,
        selectProjectCommand,
        setProjectCommand,
        setOrgCommand,
        showSelectionsCommand
    );
}
