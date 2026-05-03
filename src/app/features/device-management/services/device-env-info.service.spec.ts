import { TestBed } from '@angular/core/testing';
import { ModalController } from '@ionic/angular/standalone';

import { DeviceEnvInfoService } from './device-env-info.service';
import { InterventionService } from './intervention.service';
import { LoggerService } from '../../../core/logger/logger.service';
import { DeviceEnvInfoModalComponent } from '../components/device-env-info-modal/device-env-info-modal.component';
import { DeviceType } from '../../../shared/models/device.model';
import {
  createMockModalController,
  createMockLoggerService,
} from '../../../testing/mock-factories';

// ─── Helpers ─────────────────────────────────────────────────────────────────

function buildIntervention(
  envInfo?: Record<string, string> | null,
  overrides: Record<string, unknown> = {},
): { id: string; data: Record<string, unknown> } {
  const data: Record<string, unknown> = { sn: 'SN001', ...overrides };
  if (envInfo !== undefined) {
    data['envInfo'] = envInfo;
  }
  return { id: 'int-' + Math.random().toString(36).slice(2), data };
}

function buildModalElement(
  role: string,
  data?: Record<string, string>,
): HTMLIonModalElement {
  return {
    present: jasmine.createSpy('present').and.resolveTo(),
    dismiss: jasmine.createSpy('dismiss').and.resolveTo(true),
    onDidDismiss: jasmine.createSpy('onDidDismiss').and.resolveTo({ data, role }),
  } as unknown as HTMLIonModalElement;
}

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('DeviceEnvInfoService', () => {
  let service: DeviceEnvInfoService;
  let mockModalController: jasmine.SpyObj<ModalController>;
  let mockInterventionService: jasmine.SpyObj<InterventionService>;
  let mockLogger: jasmine.SpyObj<LoggerService>;

  beforeEach(() => {
    mockModalController = createMockModalController();
    mockInterventionService = jasmine.createSpyObj<InterventionService>(
      'InterventionService',
      ['getInterventionsBySn'],
    );
    mockLogger = createMockLoggerService();

    TestBed.configureTestingModule({
      providers: [
        DeviceEnvInfoService,
        { provide: ModalController, useValue: mockModalController },
        { provide: InterventionService, useValue: mockInterventionService },
        { provide: LoggerService, useValue: mockLogger },
      ],
    });

    service = TestBed.inject(DeviceEnvInfoService);
  });

  // ── collectEnvInfo() ─────────────────────────────────────────────────────────

  describe('collectEnvInfo()', () => {
    it('TC-DEI-01: should open DeviceEnvInfoModal with correct deviceType and readOnly=false', async () => {
      const modal = buildModalElement('cancel');
      mockModalController.create.and.resolveTo(modal);

      await service.collectEnvInfo(DeviceType.GAS_BOILER, 'SN001', null);

      expect(mockModalController.create).toHaveBeenCalledOnceWith(
        jasmine.objectContaining({
          component: DeviceEnvInfoModalComponent,
          componentProps: jasmine.objectContaining({
            deviceType: DeviceType.GAS_BOILER,
            readOnly: false,
          }),
        }),
      );
    });

    it('TC-DEI-02: should return saved data when modal dismissed with role "save"', async () => {
      const savedData: Record<string, string> = { temperature: '65', pressure: '1.5' };
      const modal = buildModalElement('save', savedData);
      mockModalController.create.and.resolveTo(modal);

      const result = await service.collectEnvInfo(DeviceType.GAS_BOILER, 'SN001', null);

      expect(result).toEqual(savedData);
    });

    it('TC-DEI-03: should return null when modal dismissed with role "cancel"', async () => {
      const modal = buildModalElement('cancel');
      mockModalController.create.and.resolveTo(modal);

      const result = await service.collectEnvInfo(DeviceType.GAS_BOILER, 'SN001', null);

      expect(result).toBeNull();
    });

    it('TC-DEI-04: should pass prefill data to modal componentProps', async () => {
      const prefill: Record<string, string> = { temperature: '70', pressure: '2.0' };
      const modal = buildModalElement('cancel');
      mockModalController.create.and.resolveTo(modal);

      await service.collectEnvInfo(DeviceType.HEAT_PUMP, 'SN002', prefill);

      expect(mockModalController.create).toHaveBeenCalledOnceWith(
        jasmine.objectContaining({
          componentProps: jasmine.objectContaining({
            prefillData: prefill,
          }),
        }),
      );
    });

    it('TC-DEI-05: should return null when dismissed with role "save" but data is undefined', async () => {
      const modal = buildModalElement('save', undefined);
      mockModalController.create.and.resolveTo(modal);

      const result = await service.collectEnvInfo(DeviceType.GAS_BOILER, 'SN001', null);

      expect(result).toBeNull();
    });

    it('TC-DEI-06: should call logger.info with sn and deviceType on successful save', async () => {
      const savedData: Record<string, string> = { key: 'value' };
      const modal = buildModalElement('save', savedData);
      mockModalController.create.and.resolveTo(modal);

      await service.collectEnvInfo(DeviceType.BOILER, 'SN-LOG-01', null);

      expect(mockLogger.info).toHaveBeenCalledWith(
        'Env info collected',
        jasmine.objectContaining({ sn: 'SN-LOG-01', deviceType: DeviceType.BOILER }),
      );
    });

    it('TC-DEI-07: should call logger.info with sn on cancellation', async () => {
      const modal = buildModalElement('cancel');
      mockModalController.create.and.resolveTo(modal);

      await service.collectEnvInfo(DeviceType.GAS_BOILER, 'SN-CANCEL-01', null);

      expect(mockLogger.info).toHaveBeenCalledWith(
        'Env info collection cancelled',
        jasmine.objectContaining({ sn: 'SN-CANCEL-01' }),
      );
    });
  });

  // ── viewEnvInfo() ────────────────────────────────────────────────────────────

  describe('viewEnvInfo()', () => {
    it('TC-DEI-08: should open modal in readOnly mode with envInfo as prefillData', async () => {
      const envInfo: Record<string, string> = { temperature: '65' };
      const modal = buildModalElement('backdrop');
      mockModalController.create.and.resolveTo(modal);

      await service.viewEnvInfo(DeviceType.HEAT_PUMP, envInfo);

      expect(mockModalController.create).toHaveBeenCalledOnceWith(
        jasmine.objectContaining({
          component: DeviceEnvInfoModalComponent,
          componentProps: jasmine.objectContaining({
            deviceType: DeviceType.HEAT_PUMP,
            prefillData: envInfo,
            readOnly: true,
          }),
        }),
      );
      expect(modal.present).toHaveBeenCalled();
    });

    it('TC-DEI-09: should return void (undefined) on dismiss', async () => {
      const modal = buildModalElement('backdrop');
      mockModalController.create.and.resolveTo(modal);

      const result = await service.viewEnvInfo(DeviceType.AIR_CONDITION, { key: 'val' });

      expect(result).toBeUndefined();
    });
  });

  // ── getLastEnvInfo() ─────────────────────────────────────────────────────────

  describe('getLastEnvInfo()', () => {
    it('TC-DEI-10: should return envInfo from most recent intervention that has one', async () => {
      const olderEnvInfo = { temperature: '60' };
      const newerEnvInfo = { temperature: '70', pressure: '2.5' };

      mockInterventionService.getInterventionsBySn.and.resolveTo([
        buildIntervention(olderEnvInfo),
        buildIntervention(newerEnvInfo),
      ]);

      const result = await service.getLastEnvInfo('SN001', 'gas-boiler');

      // reverse traversal => last element (index 1) is checked first
      expect(result).toEqual(newerEnvInfo);
    });

    it('TC-DEI-11: should return null when no interventions have envInfo', async () => {
      mockInterventionService.getInterventionsBySn.and.resolveTo([
        buildIntervention(null),
        buildIntervention(undefined),
      ]);

      const result = await service.getLastEnvInfo('SN001', 'gas-boiler');

      expect(result).toBeNull();
    });

    it('TC-DEI-12: should return null when interventions array is empty', async () => {
      mockInterventionService.getInterventionsBySn.and.resolveTo([]);

      const result = await service.getLastEnvInfo('SN001', 'gas-boiler');

      expect(result).toBeNull();
    });

    it('TC-DEI-13: should traverse from newest to oldest (reverse order) and return first match', async () => {
      const firstEnvInfo = { temperature: '50' };
      const lastEnvInfo = { temperature: '80' };

      mockInterventionService.getInterventionsBySn.and.resolveTo([
        buildIntervention(firstEnvInfo),  // index 0 — oldest
        buildIntervention(null),           // index 1 — no envInfo
        buildIntervention(lastEnvInfo),    // index 2 — newest, first found in reverse
      ]);

      const result = await service.getLastEnvInfo('SN001', 'gas-boiler');

      expect(result).toEqual(lastEnvInfo);
    });

    it('TC-DEI-14: should skip interventions with empty envInfo object', async () => {
      const validEnvInfo = { pressure: '1.8' };

      mockInterventionService.getInterventionsBySn.and.resolveTo([
        buildIntervention(validEnvInfo),
        buildIntervention({}),  // empty object — should be skipped
      ]);

      const result = await service.getLastEnvInfo('SN001', 'gas-boiler');

      // empty object is skipped, falls through to validEnvInfo at index 0
      expect(result).toEqual(validEnvInfo);
    });

    it('TC-DEI-15: should call getInterventionsBySn with correct sn and deviceType', async () => {
      mockInterventionService.getInterventionsBySn.and.resolveTo([]);

      await service.getLastEnvInfo('SN-FILTER-TEST', 'heat-pump');

      expect(mockInterventionService.getInterventionsBySn).toHaveBeenCalledOnceWith(
        'SN-FILTER-TEST',
        'heat-pump',
      );
    });
  });
});
