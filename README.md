# Azure DevOps PR Helper

A VS Code extension that helps you download and review changed files from Azure DevOps Pull Requests directly within your workspace.

## Features

This extension provides the following commands to streamline your Azure DevOps PR workflow:

### 🔑 Set Azure DevOps Personal Access Token (PAT)
- Command: `adopr-helper.setPAT`
- Securely store your Azure DevOps PAT for API authentication
- PAT is saved globally in VS Code settings

### 📥 Download Changed Files from PR
- Command: `adopr-helper.downloadChangedFiles`
- Download all changed files from an Azure DevOps Pull Request
- Support for both `dev.azure.com` and legacy `visualstudio.com` URLs
- Creates a `PR_FOLDER` in your workspace with all changed files

## Requirements

- Azure DevOps account with access to the repository
- Personal Access Token (PAT) with at least "Code (read)" permissions
- Active Pull Request in Azure DevOps

## Usage

1. **Set up your PAT:**
   - Open Command Palette (`Ctrl+Shift+P` / `Cmd+Shift+P`)
   - Run `adopr-helper.setPAT`
   - Enter your Azure DevOps Personal Access Token

2. **Download PR files:**
   - Open Command Palette (`Ctrl+Shift+P` / `Cmd+Shift+P`)
   - Run `adopr-helper.downloadChangedFiles`
   - Enter the Azure DevOps Pull Request URL
   - Files will be downloaded to `PR_FOLDER` in your workspace

**Supported PR URL formats:**
- `https://dev.azure.com/{org}/{project}/_git/{repo}/pullrequest/{id}`
- `https://{org}.visualstudio.com/{project}/_git/{repo}/pullrequest/{id}`

## Extension Settings

This extension contributes the following settings:

* `adopr-helper.pat`: Your Azure DevOps Personal Access Token (stored securely)

## Known Issues

- Only supports active Pull Requests (not completed or abandoned)
- Pull Requests with merge conflicts are not supported
- Binary files are filtered out automatically
- Large files may take longer to download

## Security

- Your Personal Access Token is stored securely in VS Code's global settings
- The extension only requests "Code (read)" permissions
- All API calls are made over HTTPS

## Release Notes

### 1.0.0

Initial release of Azure DevOps PR Helper:
- Set and store Azure DevOps Personal Access Token
- Download changed files from Pull Requests
- Support for multiple Azure DevOps URL formats
- Parallel downloading with concurrency control
- File type filtering for supported extensions

---

## Development

This extension is built with TypeScript and uses the VS Code Extension API.

**Project structure:**
- `src/extension.ts` - Main extension entry point
- `src/commands/` - Command implementations
- `src/utils/` - Utility functions for Azure DevOps API

## Contributing

Feel free to submit issues and pull requests to improve this extension.

## License

This extension is released under the MIT License.
