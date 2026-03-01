import { Injectable, inject } from '@angular/core';
import { getStorage, ref, getDownloadURL } from 'firebase/storage';
import { LoggerService } from '../logger/logger.service';

@Injectable({ providedIn: 'root' })
export class StorageService {
  private logger = inject(LoggerService);

  private async getDownloadUrl(path: string): Promise<string> {
    const storage = getStorage();
    const fileRef = ref(storage, path);
    return getDownloadURL(fileRef);
  }

  async resolveFileUrl(folder: string, fileName: string, extensions: string[]): Promise<string> {
    for (const ext of extensions) {
      try {
        const url = await this.getDownloadUrl(`${folder}/${fileName}.${ext}`);
        return url;
      } catch {
        continue;
      }
    }

    this.logger.debug('No file found for any extension', { folder, fileName, extensions });
    return '';
  }
}
