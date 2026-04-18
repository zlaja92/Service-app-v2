import { Injectable, inject } from '@angular/core';
import { FirebaseAuthentication } from '@capacitor-firebase/authentication';
import { CapacitorHttpService } from '../http/capacitor-http.service';
import { LoggerService } from '../logger/logger.service';
import { environment } from '../../../environments/environment';

@Injectable({ providedIn: 'root' })
export class ServerTimeService {
  private readonly httpService = inject(CapacitorHttpService);
  private readonly logger = inject(LoggerService);

  async getServerTime(): Promise<Date | null> {
    try {
      const tokenResult = await FirebaseAuthentication.getIdToken();

      const response = await this.httpService.get({
        url: `${environment.cloudFunctionBaseUrl}/getServerTime`,
        headers: { Authorization: `Bearer ${tokenResult.token}` },
        responseType: 'text',
      });

      if (response.status < 200 || response.status >= 300) {
        this.logger.error('ServerTimeService: request failed', { status: response.status });
        return null;
      }

      let data: Record<string, unknown>;
      if (typeof response.data === 'object' && response.data !== null) {
        data = response.data;
      } else if (typeof response.data === 'string') {
        if (response.data.trim().startsWith('<')) {
          this.logger.error('ServerTimeService: received HTML instead of JSON (endpoint may not be deployed)');
          return null;
        }
        data = JSON.parse(response.data);
      } else {
        this.logger.error('ServerTimeService: unexpected response type', { type: typeof response.data });
        return null;
      }

      const timestamp = data['timestamp'];
      if (!timestamp || typeof timestamp !== 'number') {
        this.logger.error('ServerTimeService: invalid response', { data });
        return null;
      }

      return new Date(timestamp);
    } catch (error) {
      this.logger.error('ServerTimeService: failed to fetch', { error: String(error) });
      return null;
    }
  }
}
