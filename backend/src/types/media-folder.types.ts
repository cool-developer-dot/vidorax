export interface MediaFolderItem {
  id: string;
  name: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface ListMediaFoldersResponse {
  items: MediaFolderItem[];
}

export interface CreateMediaFolderInput {
  name: string;
}

export interface RenameMediaFolderInput {
  name: string;
}

export interface PatchMediaFolderInput {
  /**
   * Logical organization bucket.
   * `null` means virtual "Downloads / Unfiled".
   */
  folderId: string | null;
}

