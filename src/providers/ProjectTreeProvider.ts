import * as vscode from 'vscode';
import { fetchProjects, fetchRepositories as fetchRepos } from '../utils/azureDevOps';
import { getDecryptedPAT } from '../utils/encryption';
import { getProject } from '../utils/workspace';

export interface ProjectTreeItem {
    name: string;
    type: 'repos' | 'repo' | 'pullrequests' | 'pullrequest' | 'pipelines' | 'pipeline' | 'feeds' | 'feed';
}

export class ProjectTreeProvider implements vscode.TreeDataProvider<ProjectTreeItem> {
    private _onDidChangeTreeData: vscode.EventEmitter<ProjectTreeItem | undefined | null | void> = new vscode.EventEmitter<ProjectTreeItem | undefined | null | void>();
    readonly onDidChangeTreeData: vscode.Event<ProjectTreeItem | undefined | null | void> = this._onDidChangeTreeData.event;

    private projectItems: ProjectTreeItem[] = [];
    private repos: Map<string, ProjectTreeItem[]> = new Map();

    constructor() {
        this.loadProjectItems();
    }

    refresh(): void {
        this.projectItems = [];
        this.repos.clear();
        this.loadProjectItems();
        this._onDidChangeTreeData.fire();
    }

    getTreeItem(item: ProjectTreeItem): vscode.TreeItem {
        const treeItem = new vscode.TreeItem(item.name);

        if (item.type === 'repos') {
            treeItem.collapsibleState = vscode.TreeItemCollapsibleState.Collapsed;
            treeItem.iconPath = new vscode.ThemeIcon(item.type);
            treeItem.contextValue = 'repos';
            treeItem.command = {
                command: 'adopr-helper.selectRepo',
                title: 'Select Repository',
                arguments: [item]
            };
        } else if (item.type === 'pullrequests' || item.type === 'pipelines' || item.type === 'feeds') {
            treeItem.collapsibleState = vscode.TreeItemCollapsibleState.None;
            treeItem.iconPath = new vscode.ThemeIcon(item.type);
            treeItem.contextValue = 'repository';
            treeItem.command = {
                command: 'adopr-helper.selectRepo',
                title: 'Select Repository',
                arguments: [item]
            };
        }

        return treeItem;
    }

    async getChildren(item?: ProjectTreeItem): Promise<ProjectTreeItem[]> {
        if (!item) return this.projectItems;

        if (item.type === 'repos') {
            const project = getProject();
            const cached = this.repos.get(project);

            if (cached) return cached;

            try {
                const repos = await this.loadRepos(project);
                this.repos.set(project, repos);
                return repos;
            } catch (error) {
                vscode.window.showErrorMessage(`Failed to load repositories: ${error}`);
                return [];
            }
        }

        return [];
    }

    private loadProjectItems(): void {
        const items: ProjectTreeItem[] = [{
            name: 'Repos',
            type: 'repos' as const
        }, {
            name: 'Pull Requests',
            type: 'pullrequests' as const
        }, {
            name: 'Pipelines',
            type: 'pipelines' as const
        }];
        this.projectItems = items;
        this._onDidChangeTreeData.fire();
    }

    private async loadRepos(project: string): Promise<ProjectTreeItem[]> {
        const pat = getDecryptedPAT();
        if (!pat) {
            throw new Error('PAT not configured');
        }

        const org = await this.getOrg();

        if (!org) {
            throw new Error('Organization not configured');
        }

        const repos = await fetchRepos(org, project, pat);
        return repos.map(repo => ({
            name: repo.name,
            type: 'repo' as const
        }));
    }

    private async getOrg(): Promise<string | undefined> {
        let org = vscode.workspace.getConfiguration().get<string>('adopr-helper.org');

        if (!org) {
            org = await vscode.window.showInputBox({
                prompt: 'Enter your Azure DevOps Organization name',
                placeHolder: 'e.g., mycompany',
                ignoreFocusOut: true
            });

            if (org) {
                await vscode.workspace.getConfiguration().update(
                    'adopr-helper.org',
                    org,
                    vscode.ConfigurationTarget.Global
                );
            }
        }

        return org;
    }
}
