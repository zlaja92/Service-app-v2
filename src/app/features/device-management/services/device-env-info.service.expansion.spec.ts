/**
 * DeviceEnvInfoService — EXPANSION PASS
 *
 * Parametrized boundary matrix tests covering:
 *   - collectEnvInfo() DeviceType variations
 *   - collectEnvInfo() modal role matrix
 *   - collectEnvInfo() prefillData variations
 *   - viewEnvInfo() DeviceType matrix
 *   - getLastEnvInfo() envInfo content variations
 *   - getLastEnvInfo() intervention count matrix
 *   - ModalController error handling
 */

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

// ─── Helpers ──────────────────────────────────────────────────────────────────

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

// ─── Setup factory ────────────────────────────────────────────────────────────

function createTestBedSetup() {
  const mockModalController = createMockModalController();
  const mockInterventionService = jasmine.createSpyObj<InterventionService>(
    'InterventionService',
    ['getInterventionsBySn'],
  );
  const mockLogger = createMockLoggerService();

  TestBed.configureTestingModule({
    providers: [
      DeviceEnvInfoService,
      { provide: ModalController, useValue: mockModalController },
      { provide: InterventionService, useValue: mockInterventionService },
      { provide: LoggerService, useValue: mockLogger },
    ],
  });

  return {
    service: TestBed.inject(DeviceEnvInfoService),
    mockModalController,
    mockInterventionService,
    mockLogger,
  };
}

// ══════════════════════════════════════════════════════════════════════════════
// Suite 1: collectEnvInfo() — DeviceType variations
// ══════════════════════════════════════════════════════════════════════════════

describe('DeviceEnvInfoService — EXPANSION: collectEnvInfo DeviceType matrix', () => {
  let service: DeviceEnvInfoService;
  let mockModalController: jasmine.SpyObj<ModalController>;

  beforeEach(() => {
    ({ service, mockModalController } = createTestBedSetup());
  });

  const allDeviceTypes = [
    DeviceType.GAS_BOILER,
    DeviceType.HEAT_PUMP,
    DeviceType.BOILER,
    DeviceType.AIR_CONDITION,
  ];

  allDeviceTypes.forEach(dt => {
    it(`COLLECT-DEVICE-TYPE: ${dt} — modal opened with correct deviceType`, async () => {
      const modal = buildModalElement('cancel');
      mockModalController.create.and.resolveTo(modal);

      await service.collectEnvInfo(dt, 'SN-TYPE-TEST', null);

      expect(mockModalController.create).toHaveBeenCalledWith(
        jasmine.objectContaining({
          component: DeviceEnvInfoModalComponent,
          componentProps: jasmine.objectContaining({ deviceType: dt }),
        }),
      );
    });

    it(`COLLECT-DEVICE-TYPE: ${dt} — readOnly is always false for collect`, async () => {
      const modal = buildModalElement('cancel');
      mockModalController.create.and.resolveTo(modal);

      await service.collectEnvInfo(dt, 'SN-RO-TEST', null);

      expect(mockModalController.create).toHaveBeenCalledWith(
        jasmine.objectContaining({
          componentProps: jasmine.objectContaining({ readOnly: false }),
        }),
      );
    });
  });
});

// ══════════════════════════════════════════════════════════════════════════════
// Suite 2: collectEnvInfo() — modal role matrix
// ══════════════════════════════════════════════════════════════════════════════

describe('DeviceEnvInfoService — EXPANSION: collectEnvInfo modal role matrix', () => {
  let service: DeviceEnvInfoService;
  let mockModalController: jasmine.SpyObj<ModalController>;
  let mockLogger: jasmine.SpyObj<LoggerService>;

  beforeEach(() => {
    ({ service, mockModalController, mockLogger } = createTestBedSetup());
  });

  const savedData: Record<string, string> = { temperature: '65', pressure: '1.5' };

  it('ROLE: "save" with data → returns saved data', async () => {
    const modal = buildModalElement('save', savedData);
    mockModalController.create.and.resolveTo(modal);
    const result = await service.collectEnvInfo(DeviceType.GAS_BOILER, 'SN-SAVE', null);
    expect(result).toEqual(savedData);
  });

  it('ROLE: "save" without data (undefined) → returns null', async () => {
    const modal = buildModalElement('save', undefined);
    mockModalController.create.and.resolveTo(modal);
    const result = await service.collectEnvInfo(DeviceType.GAS_BOILER, 'SN-SAVE-UNDEF', null);
    expect(result).toBeNull();
  });

  it('ROLE: "cancel" → returns null', async () => {
    const modal = buildModalElement('cancel');
    mockModalController.create.and.resolveTo(modal);
    const result = await service.collectEnvInfo(DeviceType.GAS_BOILER, 'SN-CANCEL', null);
    expect(result).toBeNull();
  });

  it('ROLE: "backdrop" → returns null (treated as cancel)', async () => {
    const modal = buildModalElement('backdrop');
    mockModalController.create.and.resolveTo(modal);
    const result = await service.collectEnvInfo(DeviceType.GAS_BOILER, 'SN-BACKDROP', null);
    expect(result).toBeNull();
  });

  it('ROLE: "gesture" → returns null', async () => {
    const modal = buildModalElement('gesture');
    mockModalController.create.and.resolveTo(modal);
    const result = await service.collectEnvInfo(DeviceType.GAS_BOILER, 'SN-GESTURE', null);
    expect(result).toBeNull();
  });

  it('ROLE: "save" → logger.info called with "Env info collected"', async () => {
    const modal = buildModalElement('save', { key: 'value' });
    mockModalController.create.and.resolveTo(modal);
    await service.collectEnvInfo(DeviceType.GAS_BOILER, 'SN-LOG', null);
    expect(mockLogger.info).toHaveBeenCalledWith(
      'Env info collected',
      jasmine.objectContaining({ sn: 'SN-LOG' }),
    );
  });

  it('ROLE: "cancel" → logger.info called with "Env info collection cancelled"', async () => {
    const modal = buildModalElement('cancel');
    mockModalController.create.and.resolveTo(modal);
    await service.collectEnvInfo(DeviceType.GAS_BOILER, 'SN-CANCEL-LOG', null);
    expect(mockLogger.info).toHaveBeenCalledWith(
      'Env info collection cancelled',
      jasmine.objectContaining({ sn: 'SN-CANCEL-LOG' }),
    );
  });
});

// ══════════════════════════════════════════════════════════════════════════════
// Suite 3: collectEnvInfo() — prefillData variations
// ══════════════════════════════════════════════════════════════════════════════

describe('DeviceEnvInfoService — EXPANSION: collectEnvInfo prefillData matrix', () => {
  let service: DeviceEnvInfoService;
  let mockModalController: jasmine.SpyObj<ModalController>;

  beforeEach(() => {
    ({ service, mockModalController } = createTestBedSetup());
  });

  const prefillDataCases: Array<{ label: string; prefill: Record<string, string> | null }> = [
    { label: 'null prefill', prefill: null },
    { label: 'empty object', prefill: {} },
    { label: 'single field', prefill: { temperature: '65' } },
    { label: 'two fields', prefill: { temperature: '65', pressure: '1.5' } },
    { label: 'many fields', prefill: { temperature: '65', pressure: '1.5', flow: '500', return: '45', mode: 'heating' } },
    { label: 'empty string values', prefill: { temperature: '', pressure: '' } },
    { label: 'numeric string values', prefill: { temperature: '0', pressure: '-1' } },
    { label: 'special char values', prefill: { note: 'Test note with "quotes"' } },
  ];

  prefillDataCases.forEach(({ label, prefill }) => {
    it(`PREFILL: ${label} → passed to modal componentProps.prefillData`, async () => {
      const modal = buildModalElement('cancel');
      mockModalController.create.and.resolveTo(modal);

      await service.collectEnvInfo(DeviceType.GAS_BOILER, 'SN-PREFILL', prefill);

      expect(mockModalController.create).toHaveBeenCalledWith(
        jasmine.objectContaining({
          componentProps: jasmine.objectContaining({ prefillData: prefill }),
        }),
      );
    });
  });
});

// ══════════════════════════════════════════════════════════════════════════════
// Suite 4: viewEnvInfo() — DeviceType × envInfo matrix
// ══════════════════════════════════════════════════════════════════════════════

describe('DeviceEnvInfoService — EXPANSION: viewEnvInfo DeviceType matrix', () => {
  let service: DeviceEnvInfoService;
  let mockModalController: jasmine.SpyObj<ModalController>;

  beforeEach(() => {
    ({ service, mockModalController } = createTestBedSetup());
  });

  const allDeviceTypes = [
    DeviceType.GAS_BOILER,
    DeviceType.HEAT_PUMP,
    DeviceType.BOILER,
    DeviceType.AIR_CONDITION,
  ];

  const envInfoVariations: Array<Record<string, string>> = [
    { temperature: '65' },
    { temperature: '65', pressure: '1.5' },
    { temperature: '65', pressure: '1.5', flow: '500', return: '45' },
    {},
  ];

  allDeviceTypes.forEach(dt => {
    envInfoVariations.forEach((envInfo, idx) => {
      it(`VIEW: ${dt} envInfo[${idx}] → modal opened readOnly=true with prefillData`, async () => {
        const modal = buildModalElement('backdrop');
        mockModalController.create.and.resolveTo(modal);

        await service.viewEnvInfo(dt, envInfo);

        expect(mockModalController.create).toHaveBeenCalledWith(
          jasmine.objectContaining({
            component: DeviceEnvInfoModalComponent,
            componentProps: jasmine.objectContaining({
              deviceType: dt,
              readOnly: true,
              prefillData: envInfo,
            }),
          }),
        );
      });
    });
  });
});

// ══════════════════════════════════════════════════════════════════════════════
// Suite 5: getLastEnvInfo() — intervention count matrix
// ══════════════════════════════════════════════════════════════════════════════

describe('DeviceEnvInfoService — EXPANSION: getLastEnvInfo intervention count matrix', () => {
  let service: DeviceEnvInfoService;
  let mockInterventionService: jasmine.SpyObj<InterventionService>;

  beforeEach(() => {
    ({ service, mockInterventionService } = createTestBedSetup());
  });

  it('COUNT: 0 interventions → null', async () => {
    mockInterventionService.getInterventionsBySn.and.resolveTo([]);
    const result = await service.getLastEnvInfo('SN001', DeviceType.GAS_BOILER);
    expect(result).toBeNull();
  });

  it('COUNT: 1 intervention with envInfo → returns that envInfo', async () => {
    const envInfo = { temperature: '65' };
    mockInterventionService.getInterventionsBySn.and.resolveTo([
      buildIntervention(envInfo),
    ]);
    const result = await service.getLastEnvInfo('SN001', DeviceType.GAS_BOILER);
    expect(result).toEqual(envInfo);
  });

  it('COUNT: 1 intervention without envInfo → null', async () => {
    mockInterventionService.getInterventionsBySn.and.resolveTo([
      buildIntervention(undefined), // no envInfo key
    ]);
    const result = await service.getLastEnvInfo('SN001', DeviceType.GAS_BOILER);
    expect(result).toBeNull();
  });

  it('COUNT: 1 intervention with null envInfo → null', async () => {
    mockInterventionService.getInterventionsBySn.and.resolveTo([
      buildIntervention(null),
    ]);
    const result = await service.getLastEnvInfo('SN001', DeviceType.GAS_BOILER);
    expect(result).toBeNull();
  });

  it('COUNT: 5 interventions, last has envInfo → returns last envInfo', async () => {
    const lastEnvInfo = { temperature: '80', pressure: '2.0' };
    mockInterventionService.getInterventionsBySn.and.resolveTo([
      buildIntervention(undefined),
      buildIntervention(null),
      buildIntervention(undefined),
      buildIntervention(null),
      buildIntervention(lastEnvInfo),
    ]);
    const result = await service.getLastEnvInfo('SN001', DeviceType.GAS_BOILER);
    expect(result).toEqual(lastEnvInfo);
  });

  it('COUNT: 5 interventions, only first has envInfo → traverses all, returns first (last in reverse)', async () => {
    const firstEnvInfo = { temperature: '50' };
    mockInterventionService.getInterventionsBySn.and.resolveTo([
      buildIntervention(firstEnvInfo),
      buildIntervention(undefined),
      buildIntervention(null),
      buildIntervention(undefined),
      buildIntervention(null),
    ]);
    const result = await service.getLastEnvInfo('SN001', DeviceType.GAS_BOILER);
    expect(result).toEqual(firstEnvInfo);
  });

  it('COUNT: 10 interventions, all with envInfo → returns last one', async () => {
    const interventions = Array.from({ length: 10 }, (_, i) => {
      return buildIntervention({ index: String(i) });
    });
    mockInterventionService.getInterventionsBySn.and.resolveTo(interventions);
    const result = await service.getLastEnvInfo('SN001', DeviceType.GAS_BOILER);
    // Reverse traversal → last array item is checked first
    expect(result).toEqual({ index: '9' });
  });

  it('COUNT: 10 interventions, none with envInfo → null', async () => {
    const interventions = Array.from({ length: 10 }, () => buildIntervention(null));
    mockInterventionService.getInterventionsBySn.and.resolveTo(interventions);
    const result = await service.getLastEnvInfo('SN001', DeviceType.GAS_BOILER);
    expect(result).toBeNull();
  });
});

// ══════════════════════════════════════════════════════════════════════════════
// Suite 6: getLastEnvInfo() — envInfo content variations
// ══════════════════════════════════════════════════════════════════════════════

describe('DeviceEnvInfoService — EXPANSION: getLastEnvInfo envInfo content variations', () => {
  let service: DeviceEnvInfoService;
  let mockInterventionService: jasmine.SpyObj<InterventionService>;

  beforeEach(() => {
    ({ service, mockInterventionService } = createTestBedSetup());
  });

  interface EnvInfoCase {
    label: string;
    envInfo: Record<string, string> | null | undefined;
    expectedNull: boolean;
  }

  const envInfoCases: EnvInfoCase[] = [
    { label: 'empty object {}', envInfo: {}, expectedNull: true }, // empty is skipped
    { label: 'null', envInfo: null, expectedNull: true },
    { label: 'undefined (no key)', envInfo: undefined, expectedNull: true },
    { label: 'single key', envInfo: { temperature: '65' }, expectedNull: false },
    { label: 'multiple keys', envInfo: { temperature: '65', pressure: '1.5', flow: '500' }, expectedNull: false },
    { label: 'empty string value', envInfo: { temperature: '' }, expectedNull: false }, // non-empty object
    { label: 'zero as string', envInfo: { temperature: '0' }, expectedNull: false },
    { label: 'numeric value string', envInfo: { level: '100' }, expectedNull: false },
  ];

  envInfoCases.forEach(({ label, envInfo, expectedNull }) => {
    it(`ENV-INFO-CONTENT: ${label} → ${expectedNull ? 'null (skipped)' : 'returned'}`, async () => {
      mockInterventionService.getInterventionsBySn.and.resolveTo([
        buildIntervention(envInfo),
      ]);
      const result = await service.getLastEnvInfo('SN001', DeviceType.GAS_BOILER);
      if (expectedNull) {
        expect(result).toBeNull();
      } else {
        expect(result).not.toBeNull();
        expect(result).toEqual(envInfo!);
      }
    });
  });
});

// ══════════════════════════════════════════════════════════════════════════════
// Suite 7: getLastEnvInfo() — DeviceType variations passed to getInterventionsBySn
// ══════════════════════════════════════════════════════════════════════════════

describe('DeviceEnvInfoService — EXPANSION: getLastEnvInfo deviceType forwarding', () => {
  let service: DeviceEnvInfoService;
  let mockInterventionService: jasmine.SpyObj<InterventionService>;

  beforeEach(() => {
    ({ service, mockInterventionService } = createTestBedSetup());
    mockInterventionService.getInterventionsBySn.and.resolveTo([]);
  });

  const deviceTypeArgs = [
    DeviceType.GAS_BOILER,
    DeviceType.HEAT_PUMP,
    DeviceType.BOILER,
    DeviceType.AIR_CONDITION,
    'custom-device-type', // string literal
    'gas-boiler',
    'heat-pump',
  ];

  deviceTypeArgs.forEach(dt => {
    it(`DEVICE-TYPE-FWD: deviceType="${dt}" → forwarded to getInterventionsBySn`, async () => {
      await service.getLastEnvInfo('SN-DT-TEST', dt as DeviceType);
      expect(mockInterventionService.getInterventionsBySn).toHaveBeenCalledWith('SN-DT-TEST', dt);
    });
  });
});

// ══════════════════════════════════════════════════════════════════════════════
// Suite 8: getLastEnvInfo() — SN variations
// ══════════════════════════════════════════════════════════════════════════════

describe('DeviceEnvInfoService — EXPANSION: getLastEnvInfo SN variations', () => {
  let service: DeviceEnvInfoService;
  let mockInterventionService: jasmine.SpyObj<InterventionService>;

  beforeEach(() => {
    ({ service, mockInterventionService } = createTestBedSetup());
    mockInterventionService.getInterventionsBySn.and.resolveTo([]);
  });

  const snCases = [
    'SN-SIMPLE-001',
    'GENUS24-SERIAL-XXXXX',
    '12345678901234567890',
    'SN WITH SPACES',
    'a', // single char
    'VERY-LONG-SERIAL-NUMBER-1234567890-ABCDEFGHIJKLMNOP',
  ];

  snCases.forEach(sn => {
    it(`SN-FWD: SN="${sn}" → forwarded to getInterventionsBySn correctly`, async () => {
      await service.getLastEnvInfo(sn, DeviceType.GAS_BOILER);
      expect(mockInterventionService.getInterventionsBySn).toHaveBeenCalledWith(sn, DeviceType.GAS_BOILER);
    });
  });
});

// ══════════════════════════════════════════════════════════════════════════════
// Suite 9: viewEnvInfo() — modal behavior
// ══════════════════════════════════════════════════════════════════════════════

describe('DeviceEnvInfoService — EXPANSION: viewEnvInfo modal behavior', () => {
  let service: DeviceEnvInfoService;
  let mockModalController: jasmine.SpyObj<ModalController>;

  beforeEach(() => {
    ({ service, mockModalController } = createTestBedSetup());
  });

  it('VIEW: modal.present() is called', async () => {
    const modal = buildModalElement('backdrop');
    mockModalController.create.and.resolveTo(modal);

    await service.viewEnvInfo(DeviceType.GAS_BOILER, { key: 'value' });

    expect(modal.present).toHaveBeenCalled();
  });

  it('VIEW: returns undefined after dismiss', async () => {
    const modal = buildModalElement('backdrop');
    mockModalController.create.and.resolveTo(modal);

    const result = await service.viewEnvInfo(DeviceType.GAS_BOILER, { key: 'value' });

    expect(result).toBeUndefined();
  });

  it('VIEW: can be called multiple times independently', async () => {
    const modal1 = buildModalElement('backdrop');
    const modal2 = buildModalElement('backdrop');

    mockModalController.create.and.returnValues(
      Promise.resolve(modal1),
      Promise.resolve(modal2),
    );

    await service.viewEnvInfo(DeviceType.GAS_BOILER, { temp: '65' });
    await service.viewEnvInfo(DeviceType.HEAT_PUMP, { temp: '55' });

    expect(mockModalController.create).toHaveBeenCalledTimes(2);
    expect(modal1.present).toHaveBeenCalled();
    expect(modal2.present).toHaveBeenCalled();
  });
});

// ══════════════════════════════════════════════════════════════════════════════
// Suite 10: collectEnvInfo() — SN variations
// ══════════════════════════════════════════════════════════════════════════════

describe('DeviceEnvInfoService — EXPANSION: collectEnvInfo SN variations', () => {
  let service: DeviceEnvInfoService;
  let mockModalController: jasmine.SpyObj<ModalController>;
  let mockLogger: jasmine.SpyObj<LoggerService>;

  beforeEach(() => {
    ({ service, mockModalController, mockLogger } = createTestBedSetup());
  });

  const snCases = [
    'SN-001',
    'GENUS24-12345678',
    'SN WITH SPACES',
    '12345',
    'single',
  ];

  snCases.forEach(sn => {
    it(`COLLECT-SN: SN="${sn}" → logger called with correct sn on save`, async () => {
      const modal = buildModalElement('save', { key: 'value' });
      mockModalController.create.and.resolveTo(modal);

      await service.collectEnvInfo(DeviceType.GAS_BOILER, sn, null);

      expect(mockLogger.info).toHaveBeenCalledWith(
        'Env info collected',
        jasmine.objectContaining({ sn }),
      );
    });
  });
});
