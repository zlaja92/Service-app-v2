import { Injectable } from '@angular/core';
import { CapacitorHttp, HttpResponse, HttpOptions } from '@capacitor/core';

@Injectable({ providedIn: 'root' })
export class CapacitorHttpService {
  async get(options: HttpOptions): Promise<HttpResponse> {
    return CapacitorHttp.get(options);
  }
}
