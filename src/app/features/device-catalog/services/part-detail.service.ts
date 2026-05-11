import { Injectable, inject } from '@angular/core';
import { FirestoreService } from '../../../core/firebase/firestore.service';
import { StorageService } from '../../../core/firebase/storage.service';
import { ConfigStore } from '../../../core/config/config.store';
import { LoggerService } from '../../../core/logger/logger.service';
import { Clearable } from '../../../core/session/clearable';

interface PriceDoc {
  Price: number;
  [key: string]: unknown;
}

export interface PartDetail {
  partCode: string;
  name: string;
  price: number | null;
  currency: string;
  showPhoto: boolean;
  photoUrl: string;
}

@Injectable({ providedIn: 'root' })
export class PartDetailService implements Clearable {
  private firestoreService = inject(FirestoreService);
  private storageService = inject(StorageService);
  private configStore = inject(ConfigStore);
  private logger = inject(LoggerService);

  isLoading = false;

  clear(): void {
    this.isLoading = false;
  }

  async loadPartDetail(partCode: string, partName: string): Promise<PartDetail> {
    this.isLoading = true;

    try {
      const doc = await this.firestoreService.getTenantDocument<PriceDoc>('priceList', partCode);
      const business = this.configStore.config()?.business;
      const currency = business?.currency ?? 'EUR';
      const exchangeRate = business?.exchangeRate ?? 1;
      const showPhoto = this.configStore.isFeatureEnabled('partPhoto');

      let photoUrl = '';
      if (showPhoto) {
        const folder = business?.partPhotoFolder ?? '';
        if (folder) {
          photoUrl = await this.storageService.resolveFileUrl(folder, partCode, ['png', 'jpg', 'jpeg']);
        }
      }

      const rawPrice = doc?.Price;
      const convertedPrice = typeof rawPrice === 'number'
        ? Math.round(rawPrice * exchangeRate * 100) / 100
        : null;

      const detail: PartDetail = {
        partCode,
        name: partName,
        price: convertedPrice,
        currency,
        showPhoto,
        photoUrl,
      };

      this.logger.debug('Part detail loaded', { partCode, price: detail.price, currency });
      return detail;
    } catch (error) {
      this.logger.error('Failed to load part detail', { partCode, error: String(error) });
      return {
        partCode,
        name: partName,
        price: null,
        currency: 'EUR',
        showPhoto: false,
        photoUrl: '',
      };
    } finally {
      this.isLoading = false;
    }
  }
}
