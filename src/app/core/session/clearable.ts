import { InjectionToken } from '@angular/core';

export interface Clearable {
  clear(): void;
}

export const CLEARABLE_SERVICES = new InjectionToken<Clearable[]>('clearable');
