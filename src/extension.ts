import * as vscode from "vscode";
import { registerSetPatCommand } from "./commands/setPat";
import { registerDownloadChangedFilesCommand } from "./commands/downloadChangedFiles";

export function activate(context: vscode.ExtensionContext) {
  console.log('Congratulations, your extension "adopr-helper" is now active!');
  const adoApiVersion = "7.1";
  registerSetPatCommand(context);
  registerDownloadChangedFilesCommand(context, adoApiVersion);
}

export function deactivate() {}
