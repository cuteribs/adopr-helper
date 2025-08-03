import * as vscode from "vscode";
import { registerDownloadChangedFilesCommand } from "./commands/downloadChangedFiles";
import { registerRepoTreeView } from "./commands/repoTreeView";

export function activate(context: vscode.ExtensionContext) {
  console.log('Congratulations, your extension "adopr-helper" is now active!');
  registerDownloadChangedFilesCommand(context);
  registerRepoTreeView(context);
}

export function deactivate() {}
