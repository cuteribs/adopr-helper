import * as vscode from 'vscode';

export interface Project {
    id: string;
    name: string;
}

export interface Repo {
    id: string;
    name: string;
    project: string;
}

/**
 * Set the selected Azure DevOps repository in workspace configuration
 */
export async function setRepo(repository: string): Promise<void> {
    await vscode.workspace.getConfiguration().update(
        'adopr-helper.repo',
        repository,
        vscode.ConfigurationTarget.Workspace
    );
}

/**
 * Get the currently selected Azure DevOps repository from workspace configuration
 */
export function getRepo(): string | undefined {
    const result = vscode.workspace.getConfiguration().get<string>('adopr-helper.repo');

    if (!result) {
        throw new Error('Azure DevOps repository is not set');
    }

    return result;
}

/**
 * Set the selected Azure DevOps project in workspace configuration
 */
export async function setProject(project: string): Promise<void> {
    await vscode.workspace.getConfiguration().update(
        'adopr-helper.project',
        project,
        vscode.ConfigurationTarget.Workspace
    );
}

/**
 * Get the currently selected Azure DevOps project from workspace configuration
 */
export function getProject(): string {
    const result = vscode.workspace.getConfiguration().get<string>('adopr-helper.project');

    if (!result) {
        throw new Error('Azure DevOps project is not set');
    }

    return result;
}

/**
 * Clear the selected project and repository
 */
export async function clearSelections(): Promise<void> {
    await vscode.workspace.getConfiguration().update(
        'adopr-helper.project',
        undefined,
        vscode.ConfigurationTarget.Workspace
    );
    await vscode.workspace.getConfiguration().update(
        'adopr-helper.repo',
        undefined,
        vscode.ConfigurationTarget.Workspace
    );
}

/**
 * Show the current selections in a status message
 */
export function showCurrentSelections(): void {
    const project = getProject();
    const repo = getRepo();

    if (project && repo) {
        vscode.window.showInformationMessage(
            `Selected: ${project} → ${repo}`
        );
    } else if (project) {
        vscode.window.showInformationMessage(
            `Selected project: ${project} (no repository selected)`
        );
    } else {
        vscode.window.showInformationMessage('No project or repository selected');
    }
}
