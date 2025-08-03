import * as vscode from "vscode";
import fetch from "node-fetch";
import { createPatch } from 'diff';
import { getDecryptedPAT } from './encryption';

export function parsePrUrl(prUrl: string): {
  organization: string;
  project: string;
  repository: string;
  pullRequestId: string;
} | null {
  const devAzureRegex =
    /https:\/\/dev\.azure\.com\/(.+?)\/(.+?)\/_git\/(.+?)\/pullrequest\/(\d+)/i;
  const visualStudioRegex =
    /https:\/\/(.+?)\.visualstudio\.com\/(.+?)\/_git\/(.+?)\/pullrequest\/(\d+)/i;

  let match = prUrl.match(devAzureRegex);
  if (match) {
    return {
      organization: match[1],
      project: match[2],
      repository: match[3],
      pullRequestId: match[4],
    };
  }

  match = prUrl.match(visualStudioRegex);
  if (match) {
    return {
      organization: match[1],
      project: match[2],
      repository: match[3],
      pullRequestId: match[4],
    };
  }

  return null;
}

export function getSupportedExtensions(): string[] {
  return [
    ".ts",
    ".js",
    ".json",
    ".py",
    ".cs",
    ".sh",
    ".yml",
    ".yaml",
    ".html",
    ".css",
    ".scss",
    ".less",
    ".bat",
    ".ps1",
    ".sql",
    ".vue",
    ".svelte",
    ".tsx",
    ".jsx",
  ];
}

export function isSupportedChange(change: GitChange): boolean {
  // const supportedExtensions = getSupportedExtensions();
  const supportedChangeTypes = ['add', 'edit'];
  return supportedChangeTypes.includes(change.changeType)
    && change.item.gitObjectType === 'blob'
    && change.item.path !== undefined
    && change.item.url !== undefined
    // && supportedExtensions.some(x => change.item.path.toLowerCase().endsWith(x))
    ;
}

export async function fetchPrDetails(url: string, headers: any): Promise<any> {
  const response = await fetch(url, { headers });
  if (!response.ok) {
    throw new Error(`HTTP ${response.status}: ${response.statusText}`);
  }
  return response.json();
}

export async function fetchPrChanges(url: string, headers: any): Promise<GitChange[]> {
  const response = await fetch(url, { headers });
  if (!response.ok) {
    throw new Error(`HTTP ${response.status}: ${response.statusText}`);
  }
  const data: GitCommitDiffs = await response.json();
  return data.changes || [];
}

export async function getBlobContent(blobUrl: string, headers: any): Promise<string | null> {
  const fileHeaders = { ...headers, Accept: "text/plain" };
  const fileResponse = await fetch(blobUrl, { headers: fileHeaders });

  if (!fileResponse.ok) {
    vscode.window.showWarningMessage(`Failed to download blob content: HTTP ${fileResponse.status}`);
    return null;
  }

  return fileResponse.text();
}

export async function getFilePatch(fileItem: GitItem, baseUrl: string, adoApiVersion: string, headers: any): Promise<{ fileName: string; oldContent: string | null; patch: string }> {
  const fileName = fileItem.path.replace(/^\//, "");
  let oldContent: string | null = null;
  let newContent: string | null = null;

  if (fileItem.originalObjectId) {
    const url = `${baseUrl}/blobs/${fileItem.originalObjectId}?api-version=${adoApiVersion}`;
    oldContent = await getBlobContent(url, headers);
  }

  if (fileItem.objectId) {
    const url = `${baseUrl}/blobs/${fileItem.objectId}?api-version=${adoApiVersion}`;
    newContent = await getBlobContent(url, headers);
  }

  const patch = createPatch(fileName, oldContent || "", newContent || "");
  return { fileName, oldContent, patch };
}

export async function saveFile(fileContent: string, filePath: string, downloadFolder: vscode.Uri): Promise<void> {
  const fullFilePath = vscode.Uri.joinPath(downloadFolder, filePath.replace(/^\//, ""));

  // Ensure parent directories exist
  await vscode.workspace.fs.createDirectory(
    fullFilePath.with({
      path: fullFilePath.path.substring(0, fullFilePath.path.lastIndexOf("/")),
    })
  );

  await vscode.workspace.fs.writeFile(fullFilePath, Buffer.from(fileContent, "utf8"));
}

// Azure DevOps API interfaces
export interface AdoProject {
  id: string;
  name: string;
  description?: string;
  url: string;
  visibility: 'private' | 'public';
}

export interface AdoRepo {
  id: string;
  name: string;
  url: string;
  project: {
    id: string;
    name: string;
  };
  defaultBranch: string;
  size: number;
}

// Fetch projects from Azure DevOps organization
export async function fetchProjects(organization: string, pat: string): Promise<AdoProject[]> {
  const headers = {
    Authorization: `Basic ${Buffer.from(`:${pat}`).toString("base64")}`,
    Accept: "application/json",
  };

  const url = `https://dev.azure.com/${organization}/_apis/projects?api-version=7.1`;
  const response = await fetch(url, { headers });

  if (!response.ok) {
    throw new Error(`HTTP ${response.status}: ${response.statusText}`);
  }

  const data = await response.json();
  return data.value || [];
}

// Fetch repositories from Azure DevOps project
export async function fetchRepositories(organization: string, projectIdOrName: string, pat: string): Promise<AdoRepo[]> {
  const headers = {
    Authorization: `Basic ${Buffer.from(`:${pat}`).toString("base64")}`,
    Accept: "application/json",
  };

  const url = `https://dev.azure.com/${organization}/${projectIdOrName}/_apis/git/repositories?api-version=7.1`;
  const response = await fetch(url, { headers });

  if (!response.ok) {
    throw new Error(`HTTP ${response.status}: ${response.statusText}`);
  }

  const data = await response.json();
  return data.value || [];
}
