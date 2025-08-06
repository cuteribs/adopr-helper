import * as vscode from 'vscode';
import { getDecryptedPAT } from './encryption';

export interface Project {
    id: string;
    name: string;
}

export interface Repo {
    id: string;
    name: string;
    project: string;
}

function getConfig(key: string, errorMessage: string): string | undefined {
    const result = vscode.workspace.getConfiguration().get<string>(`adopr-helper.${key}`);

    if (result) return result;

    throw new Error(errorMessage);
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
    return getConfig('repo', 'Azure DevOps repository is not set');
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
export function getProject(): string | undefined {
    return getConfig('project', 'Azure DevOps project is not set');
}

export function getOrg(): string | undefined {
    return getConfig('org', 'Azure DevOps Organization is not set');
}

/**
 * Show the current selections in a status message
 */
export function showCurrentSelections(): void {
    const pat = getDecryptedPAT();

    if(!pat) {
        vscode.window.showWarningMessage('Azure DevOps PAT is not set');
        return;
    }

    const org = getOrg();

    if(!org) {
        vscode.window.showWarningMessage('Azure DevOps PAT is not set');
        return;
    }

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
