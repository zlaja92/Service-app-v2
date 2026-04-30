import { Injectable, inject } from '@angular/core';
import { Capacitor, CapacitorHttp } from '@capacitor/core';
import { FirebaseStorage } from '@capacitor-firebase/storage';
import { getStorage, ref, getDownloadURL, listAll } from 'firebase/storage';
import { LoggerService } from '../logger/logger.service';

@Injectable({ providedIn: 'root' })
export class StorageService {
  private logger = inject(LoggerService);
  private isNative = Capacitor.isNativePlatform();

  async getFileUrl(path: string): Promise<string> {
    if (this.isNative) {
      const result = await FirebaseStorage.getDownloadUrl({ path });
      return result.downloadUrl;
    }
    const storage = getStorage();
    const fileRef = ref(storage, path);
    return getDownloadURL(fileRef);
  }

  async listFolder(path: string): Promise<{ folders: string[]; files: { name: string; fullPath: string }[] }> {
    if (this.isNative) {
      const result = await FirebaseStorage.listFiles({ path });
      const files = result.items
        .filter((item) => item.name !== '_folders.txt')
        .map((item) => ({ name: item.name, fullPath: item.path }));

      const folders = await this.readFoldersFile(path);
      return { folders, files };
    }

    const storage = getStorage();
    const folderRef = ref(storage, path);
    const result = await listAll(folderRef);
    const folders = result.prefixes.map((p) => p.name);
    const files = result.items
      .filter((item) => item.name !== '_folders.txt')
      .map((item) => ({ name: item.name, fullPath: item.fullPath }));
    return { folders, files };
  }

  private async readFoldersFile(path: string): Promise<string[]> {
    try {
      const url = await this.getFileUrl(`${path}/_folders.txt`);
      const response = await CapacitorHttp.get({ url });
      const text = typeof response.data === 'string' ? response.data : '';
      return text.split('\n').map((s) => s.trim()).filter((s) => s.length > 0);
    } catch {
      return [];
    }
  }

  async uploadFile(storagePath: string, fileUri: string): Promise<void> {
    if (this.isNative) {
      return new Promise<void>((resolve, reject) => {
        FirebaseStorage.uploadFile(
          { path: storagePath, uri: fileUri, metadata: { contentType: 'image/jpeg' } },
          (event, error) => {
            if (error) {
              this.logger.error('Storage upload error', { storagePath, error: String(error) });
              reject(error);
              return;
            }
            if (event?.completed) {
              resolve();
            }
          },
        );
      });
    }

    // Web: fetch blob from URI and upload
    const response = await fetch(fileUri);
    const blob = await response.blob();
    return new Promise<void>((resolve, reject) => {
      FirebaseStorage.uploadFile(
        { path: storagePath, blob, metadata: { contentType: 'image/jpeg' } },
        (event, error) => {
          if (error) {
            this.logger.error('Storage upload error', { storagePath, error: String(error) });
            reject(error);
            return;
          }
          if (event?.completed) {
            resolve();
          }
        },
      );
    });
  }

  async resolveFileUrl(folder: string, fileName: string, extensions: string[]): Promise<string> {
    for (const ext of extensions) {
      try {
        const url = await this.getFileUrl(`${folder}/${fileName}.${ext}`);
        return url;
      } catch {
        continue;
      }
    }

    this.logger.debug('No file found for any extension', { folder, fileName, extensions });
    return '';
  }
}
