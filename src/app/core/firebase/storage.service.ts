import { Injectable, inject } from '@angular/core';
import { Capacitor, CapacitorHttp } from '@capacitor/core';
import { FirebaseStorage } from '@capacitor-firebase/storage';
import { Directory, Filesystem } from '@capacitor/filesystem';
import { getStorage, ref, getDownloadURL, listAll } from 'firebase/storage';
import { LoggerService } from '../logger/logger.service';
import { TenantService } from '../tenant/tenant.service';

/**
 * Firebase Storage access. Every path is relative to the current tenant's
 * root folder ('{tenantId}/...'), resolved by TenantService — callers never
 * build tenant prefixes, the same way FirestoreService handles documents.
 */
@Injectable({ providedIn: 'root' })
export class StorageService {
  private logger = inject(LoggerService);
  private tenantService = inject(TenantService);
  private isNative = Capacitor.isNativePlatform();

  async getFileUrl(path: string): Promise<string | null> {
    try {
      const fullPath = this.tenantService.getStoragePath(path);
      if (this.isNative) {
        const result = await FirebaseStorage.getDownloadUrl({ path: fullPath });
        return result.downloadUrl;
      }
      const storage = getStorage();
      const fileRef = ref(storage, fullPath);
      return await getDownloadURL(fileRef);
    } catch (error) {
      this.logger.warn('Storage getFileUrl failed', { path, error: String(error) });
      return null;
    }
  }

  async listFolder(relativePath: string): Promise<{ folders: string[]; files: { name: string; fullPath: string }[] }> {
    const path = this.tenantService.getStoragePath(relativePath);
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
      if (!url) return [];
      const response = await CapacitorHttp.get({ url });
      const text = typeof response.data === 'string' ? response.data : '';
      return text.split('\n').map((s) => s.trim()).filter((s) => s.length > 0);
    } catch {
      return [];
    }
  }

  async uploadFile(relativePath: string, fileUri: string, contentType = 'image/jpeg'): Promise<void> {
    const storagePath = this.tenantService.getStoragePath(relativePath);
    if (this.isNative) {
      return new Promise<void>((resolve, reject) => {
        FirebaseStorage.uploadFile(
          { path: storagePath, uri: fileUri, metadata: { contentType } },
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
        { path: storagePath, blob, metadata: { contentType } },
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

  /**
   * Uploads an image given as a data URL (e.g. a signature canvas export).
   * Native: FirebaseStorage needs a file URI, so the base64 is written to a temp
   * file and removed after upload. Web: the data URL is uploaded directly.
   */
  async uploadDataUrl(storagePath: string, dataUrl: string, contentType: string): Promise<void> {
    if (!this.isNative) {
      await this.uploadFile(storagePath, dataUrl, contentType);
      return;
    }

    const base64 = dataUrl.substring(dataUrl.indexOf(',') + 1);
    const tempName = `upload_${Date.now()}.tmp`;
    const written = await Filesystem.writeFile({ path: tempName, data: base64, directory: Directory.Cache });
    try {
      await this.uploadFile(storagePath, written.uri, contentType);
    } finally {
      await Filesystem.deleteFile({ path: tempName, directory: Directory.Cache }).catch(() => undefined);
    }
  }

  async resolveFileUrl(folder: string, fileName: string, extensions: string[]): Promise<string> {
    for (const ext of extensions) {
      const url = await this.getFileUrl(`${folder}/${fileName}.${ext}`);
      if (url) return url;
    }

    this.logger.debug('No file found for any extension', { folder, fileName, extensions });
    return '';
  }
}
