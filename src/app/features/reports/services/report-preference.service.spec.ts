import { TestBed } from '@angular/core/testing';

import { ReportPreferenceService } from './report-preference.service';
import { PreferencesService } from '../../../core/storage/preferences.service';
import { LoggerService } from '../../../core/logger/logger.service';
import { createMockLoggerService } from '../../../testing/mock-factories';

describe('ReportPreferenceService', () => {
  let service: ReportPreferenceService;
  let mockPreferences: jasmine.SpyObj<PreferencesService>;
  let mockLogger: jasmine.SpyObj<LoggerService>;

  beforeEach(() => {
    mockPreferences = jasmine.createSpyObj<PreferencesService>(
      'PreferencesService',
      ['get', 'set', 'remove', 'clear'],
    );
    mockLogger = createMockLoggerService();

    TestBed.configureTestingModule({
      providers: [
        ReportPreferenceService,
        { provide: PreferencesService, useValue: mockPreferences },
        { provide: LoggerService, useValue: mockLogger },
      ],
    });

    service = TestBed.inject(ReportPreferenceService);
  });

  // ─── Default state ───────────────────────────────────────────────────────────

  describe('default state (before init)', () => {
    it('should have autoOpen() === false before init is called', () => {
      expect(service.autoOpen()).toBe(false);
    });
  });

  // ─── init() ──────────────────────────────────────────────────────────────────

  describe('init()', () => {
    it('should set autoOpen to true when stored value is "true"', async () => {
      mockPreferences.get.and.resolveTo('true');

      await service.init();

      expect(service.autoOpen()).toBe(true);
    });

    it('should set autoOpen to false when stored value is "false"', async () => {
      mockPreferences.get.and.resolveTo('false');

      await service.init();

      expect(service.autoOpen()).toBe(false);
    });

    it('should set autoOpen to false when stored value is null', async () => {
      mockPreferences.get.and.resolveTo(null);

      await service.init();

      expect(service.autoOpen()).toBe(false);
    });

    it('should set autoOpen to false when preferences.get throws an error', async () => {
      mockPreferences.get.and.rejectWith(new Error('Storage unavailable'));

      await service.init();

      expect(service.autoOpen()).toBe(false);
    });
  });

  // ─── setAutoOpen() ───────────────────────────────────────────────────────────

  describe('setAutoOpen()', () => {
    beforeEach(() => {
      mockPreferences.set.and.resolveTo();
    });

    it('should set autoOpen signal to true when called with true', async () => {
      await service.setAutoOpen(true);

      expect(service.autoOpen()).toBe(true);
    });

    it('should call preferences.set with key "auto_report_preference" and value "true"', async () => {
      await service.setAutoOpen(true);

      expect(mockPreferences.set).toHaveBeenCalledWith('auto_report_preference', 'true');
    });

    it('should set autoOpen signal to false when called with false', async () => {
      // First set to true so there is a real state change to observe
      await service.setAutoOpen(true);
      await service.setAutoOpen(false);

      expect(service.autoOpen()).toBe(false);
    });

    it('should call preferences.set with key "auto_report_preference" and value "false"', async () => {
      await service.setAutoOpen(false);

      expect(mockPreferences.set).toHaveBeenCalledWith('auto_report_preference', 'false');
    });

    it('should call logger.info when setAutoOpen is called with true', async () => {
      await service.setAutoOpen(true);

      expect(mockLogger.info).toHaveBeenCalledWith('Auto-open report saved', { enabled: true });
    });

    it('should call logger.info when setAutoOpen is called with false', async () => {
      await service.setAutoOpen(false);

      expect(mockLogger.info).toHaveBeenCalledWith('Auto-open report saved', { enabled: false });
    });
  });
});
