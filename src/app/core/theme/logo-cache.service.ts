import { Injectable, inject } from '@angular/core';
import { Preferences } from '@capacitor/preferences';
import { Capacitor, CapacitorHttp } from '@capacitor/core';
import { LoggerService } from '../logger/logger.service';

const LOGO_CACHE_KEY = 'logo_cache';

interface LogoCache {
  configVersion: number;
  logoUrl: string;
  dataUrl: string;
}

@Injectable({ providedIn: 'root' })
export class LogoCacheService {
  private logger = inject(LoggerService);

  /**
   * Returns logo as a base64 data URL, using cache when possible.
   * Cache is invalidated when config version changes.
   *
   * On native (iOS/Android): fetch goes through Capacitor's native HTTP → no CORS.
   * On web (dev): falls back to direct URL if download fails due to CORS.
   */
  async getLogoDataUrl(logoUrl: string, configVersion: number): Promise<string | null> {
    if (!logoUrl) {
      this.logger.debug('No logo URL provided, skipping logo cache');
      return null;
    }

    const cached = await this.getCachedLogo();

    if (cached && cached.configVersion === configVersion && cached.logoUrl === logoUrl) {
      this.logger.debug('Using cached logo', { configVersion });
      return cached.dataUrl;
    }

    this.logger.info('Downloading logo', { logoUrl, configVersion });

    try {
      const dataUrl = await this.downloadAsBase64(logoUrl);
      await this.saveCachedLogo({ configVersion, logoUrl, dataUrl });
      this.logger.info('Logo cached successfully', { configVersion });
      return dataUrl;
    } catch (error) {
      this.logger.warn('Failed to download logo', { error: String(error) });

      // On web (dev), CORS may block the download — fall back to cached or direct URL
      if (cached) {
        this.logger.info('Using previously cached logo as fallback');
        return cached.dataUrl;
      }

      if (!Capacitor.isNativePlatform()) {
        this.logger.info('Web platform: falling back to direct URL');
        return logoUrl;
      }

      return null;
    }
  }

  private async downloadAsBase64(url: string): Promise<string> {
    if (Capacitor.isNativePlatform()) {
      const response = await CapacitorHttp.get({
        url,
        responseType: 'arraybuffer',
      });
      const contentType = response.headers['Content-Type'] ?? 'image/png';
      return `data:${contentType};base64,${response.data}`;
    }

    const response = await fetch(url);

    if (!response.ok) {
      throw new Error(`Logo download failed: ${response.status} ${response.statusText}`);
    }

    const blob = await response.blob();
    return this.blobToDataUrl(blob);
  }

  private blobToDataUrl(blob: Blob): Promise<string> {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onloadend = () => resolve(reader.result as string);
      reader.onerror = () => reject(new Error('Failed to convert logo to base64'));
      reader.readAsDataURL(blob);
    });
  }

  private async getCachedLogo(): Promise<LogoCache | null> {
    try {
      const { value } = await Preferences.get({ key: LOGO_CACHE_KEY });
      if (!value) return null;
      return JSON.parse(value) as LogoCache;
    } catch {
      return null;
    }
  }

  private async saveCachedLogo(cache: LogoCache): Promise<void> {
    try {
      await Preferences.set({
        key: LOGO_CACHE_KEY,
        value: JSON.stringify(cache),
      });
    } catch (error) {
      this.logger.warn('Failed to save logo to cache', { error: String(error) });
    }
  }
}
