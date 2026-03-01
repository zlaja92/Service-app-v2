import { Injectable, inject } from '@angular/core';
import { Capacitor, CapacitorHttp } from '@capacitor/core';
import { FirebaseStorage } from '@capacitor-firebase/storage';
import { FirebaseAuthentication } from '@capacitor-firebase/authentication';
import { getStorage, ref, getDownloadURL, listAll } from 'firebase/storage';
import { LoggerService } from '../logger/logger.service';
import { environment } from '../../../environments/environment';

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
      return this.listFolderViaRestApi(path);
    }

    const storage = getStorage();
    const folderRef = ref(storage, path);
    const result = await listAll(folderRef);
    const folders = result.prefixes.map((p) => p.name);
    const files = result.items.map((item) => ({
      name: item.name,
      fullPath: item.fullPath,
    }));
    return { folders, files };
  }

  /**
   * Lists folder contents via Firebase Storage REST API (native HTTP).
   * Native plugin's listFiles() doesn't return folder prefixes,
   * so we call the REST API directly with delimiter=/ to get both files and folders.
   */
  private async listFolderViaRestApi(path: string): Promise<{ folders: string[]; files: { name: string; fullPath: string }[] }> {
    const bucket = environment.firebase.storageBucket;
    const prefix = path.endsWith('/') ? path : `${path}/`;

    const tokenResult = await FirebaseAuthentication.getIdToken();

    const url = `https://firebasestorage.googleapis.com/v0/b/${bucket}/o?prefix=${encodeURIComponent(prefix)}&delimiter=${encodeURIComponent('/')}`;

    const response = await CapacitorHttp.get({
      url,
      headers: { Authorization: `Bearer ${tokenResult.token}` },
    });

    const data = typeof response.data === 'string' ? JSON.parse(response.data) : response.data;

    const rawPrefixes: string[] = data.prefixes ?? [];
    const folders = rawPrefixes.map((p) => {
      const trimmed = p.endsWith('/') ? p.slice(0, -1) : p;
      return trimmed.split('/').pop() ?? trimmed;
    });

    const rawItems: { name: string }[] = data.items ?? [];
    const files = rawItems.map((item) => ({
      name: item.name.split('/').pop() ?? item.name,
      fullPath: item.name,
    }));

    return { folders, files };
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
