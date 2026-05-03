import { Injectable, inject } from '@angular/core';
import { FirebaseFunctions } from '@capacitor-firebase/functions';
import { LoggerService } from '../logger/logger.service';

@Injectable({ providedIn: 'root' })
export class ServerTimeService {
  private readonly logger = inject(LoggerService);

  async getServerTime(): Promise<Date | null> {
    try {
      const result = await FirebaseFunctions.callByName<unknown, { timestamp: number }>({
        name: 'getServerTime',
      });

      const timestamp = result.data.timestamp;
      if (typeof timestamp !== 'number' || !Number.isFinite(timestamp)) {
        this.logger.error('ServerTimeService: invalid response', { data: result.data });
        return null;
      }

      return new Date(timestamp);
    } catch (error) {
      this.logger.error('ServerTimeService: failed to fetch', { error: String(error) });
      return null;
    }
  }
}
