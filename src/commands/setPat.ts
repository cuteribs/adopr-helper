import * as vscode from "vscode";

export function registerSetPatCommand(context: vscode.ExtensionContext) {
  const setPatCommand = vscode.commands.registerCommand(
    "adopr-helper.setPAT",
    async () => {
      const pat = await vscode.window.showInputBox({
        prompt: "Enter your Azure DevOps Personal Access Token (PAT)",
        ignoreFocusOut: true,
        password: true,
      });
      const configuration = vscode.workspace.getConfiguration(undefined);
      await configuration.update(
        "adopr-helper.pat",
        pat,
        vscode.ConfigurationTarget.Global
      );
      vscode.window.showInformationMessage(
        "Azure DevOps PAT saved successfully."
      );
    }
  );
  context.subscriptions.push(setPatCommand);
}
