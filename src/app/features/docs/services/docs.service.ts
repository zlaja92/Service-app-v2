import { Injectable, inject } from '@angular/core';
import { Browser } from '@capacitor/browser';
import { StorageService } from '../../../core/firebase/storage.service';
import { LoggerService } from '../../../core/logger/logger.service';
import { DocEntry } from '../models/doc.model';

const ROOT_FOLDER = 'Documents';

@Injectable({ providedIn: 'root' })
export class DocsService {
  private storageService = inject(StorageService);
  private logger = inject(LoggerService);

  entries: DocEntry[] = [];
  isLoading = false;
  currentPath = ROOT_FOLDER;

  get isRoot(): boolean {
    return this.currentPath === ROOT_FOLDER;
  }

  get currentFolderName(): string {
    const parts = this.currentPath.split('/');
    return parts[parts.length - 1];
  }

  async loadFolder(path?: string): Promise<void> {
    if (this.isLoading) return;

    this.currentPath = path ?? ROOT_FOLDER;
    this.isLoading = true;
    this.entries = [];

    try {
      const result = await this.storageService.listFolder(this.currentPath);

      const folders: DocEntry[] = result.folders.map((name) => ({
        name,
        fullPath: `${this.currentPath}/${name}`,
        isFolder: true,
      }));

      const files: DocEntry[] = result.files.map((file) => ({
        name: file.name,
        fullPath: file.fullPath,
        isFolder: false,
      }));

      this.entries = [...folders, ...files];

      this.logger.debug('Docs folder loaded', {
        path: this.currentPath,
        folders: folders.length,
        files: files.length,
      });
    } catch (error) {
      this.logger.error('Failed to load docs folder', { path: this.currentPath, error: String(error) });
      this.entries = [];
    } finally {
      this.isLoading = false;
    }
  }

  async openFile(entry: DocEntry): Promise<void> {
    try {
      const url = await this.storageService.getFileUrl(entry.fullPath);
      await Browser.open({ url });
    } catch (error) {
      this.logger.error('Failed to open document', { path: entry.fullPath, error: String(error) });
    }
  }

  goBack(): void {
    const parts = this.currentPath.split('/');
    if (parts.length > 1) {
      parts.pop();
      this.loadFolder(parts.join('/'));
    }
  }

  reset(): void {
    this.entries = [];
    this.isLoading = false;
    this.currentPath = ROOT_FOLDER;
  }
}
