interface GitCommitDiffs {
    changes: GitChange[];
}

interface GitChange {
    item: GitItem;
    changeType: 'add' | 'edit' | 'delete' | 'rename' | 'move' | string;
}

interface GitItem {
    objectId: string | undefined;
    originalObjectId: string | undefined;
    gitObjectType: 'blob' | 'tree' | string;
    commitId: string;
    path: string;
    isFolder: true | undefined;
    url: string;
}
