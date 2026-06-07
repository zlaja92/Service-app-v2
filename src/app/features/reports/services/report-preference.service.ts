import { Injectable, inject, signal } from '@angular/core';
import { PreferencesService } from '../../../core/storage/preferences.service';
import { LoggerService } from '../../../core/logger/logger.service';

const AUTO_OPEN_KEY = 'auto_report_preference';

/**
 * Persists the "auto-open report after saving an intervention" preference in
 * device storage (Capacitor Preferences), the same pattern as dark mode.
 * The toggle lives in the side menu; the save flows read `autoOpen()`.
 */
@Injectable({ providedIn: 'root' })
export class ReportPreferenceService {
  private preferences = inject(PreferencesService);
  private logger = inject(LoggerService);

  /** Whether a report should be opened automatically after each saved intervention. */
  readonly autoOpen = signal(false);

  /** Loads the stored value on startup. Defaults to false on any error. */
  async init(): Promise<void> {
    this.autoOpen.set(await this.getStored());
  }

  async setAutoOpen(enabled: boolean): Promise<void> {
    this.autoOpen.set(enabled);
    await this.preferences.set(AUTO_OPEN_KEY, enabled ? 'true' : 'false');
    this.logger.info('Auto-open report saved', { enabled });
  }

  private async getStored(): Promise<boolean> {
    try {
      return (await this.preferences.get(AUTO_OPEN_KEY)) === 'true';
    } catch {
      return false;
    }
  }
}
