/**
 * InterventionReportService Unit Tests
 *
 * SCOPE
 * =====
 * Tests the public `open(sn, device, data)` method, exercising all private helpers
 * (buildParameterSections, buildConsent, resolveCallAccepted, str, formatDate,
 * showError) indirectly through the public surface.
 *
 * MOCK STRATEGY
 * =============
 * InterventionService:  jasmine.createSpyObj (getRegistration, getInterventionLabel,
 *                        getInterventionsBySn) — no factory in mock-factories.ts
 * ServicerService:      createMockServicerService()
 * StorageService:       createMockStorageService()
 * ReportService:        createMockReportService()
 * LoggerService:        createMockLoggerService()
 * ToastController:      createMockToastController()
 * TranslocoService:     createMockTranslocoService() (key-as-is pass-through)
 *                        — one test overrides translate to verify real mapping
 *
 * Context capture pattern:
 *   mockReportService.generate.and.callFake((type, ctx) => { capturedCtx = ctx; })
 */

/* eslint-disable @typescript-eslint/no-explicit-any */

import { TestBed } from '@angular/core/testing';
import { ToastController } from '@ionic/angular/standalone';
import { TranslocoService } from '@jsverse/transloco';

import { InterventionReportService } from './intervention-report.service';
import { InterventionService } from '../../device-management/services/intervention.service';
import { ServicerService } from '../../../core/servicer/servicer.service';
import { StorageService } from '../../../core/firebase/storage.service';
import { LoggerService } from '../../../core/logger/logger.service';
import { ReportService } from './report.service';
import { Device, DeviceType } from '../../../shared/models/device.model';
import { InterventionReportContext } from '../models/report.model';
import {
  createMockServicerService,
  createMockStorageService,
  createMockReportService,
  createMockLoggerService,
  createMockToastController,
  createMockTranslocoService,
} from '../../../testing/mock-factories';
import { Servicer } from '../../../core/servicer/servicer.model';

// ─── Helper factories ─────────────────────────────────────────────────────────

function createMockDevice(overrides: Partial<Device> = {}): Device {
  return {
    code: 'GENUS24',
    name: 'Genus One 24',
    type: DeviceType.GAS_BOILER,
    subType: 'standard',
    unitCount: 1,
    exists: true,
    annualService: false,
    ...overrides,
  };
}

function createMockInterventionService(): jasmine.SpyObj<InterventionService> {
  const mock = jasmine.createSpyObj<InterventionService>('InterventionService', [
    'getRegistration',
    'getInterventionLabel',
    'getInterventionsBySn',
  ]);
  mock.getRegistration.and.resolveTo(null);
  mock.getInterventionLabel.and.returnValue(null);
  mock.getInterventionsBySn.and.resolveTo([]);
  return mock;
}

/** Minimal valid intervention data — no spare parts, no optional fields */
function baseData(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    interventionType: 'commissioning',
    ...overrides,
  };
}

// ─── Main describe ─────────────────────────────────────────────────────────────

describe('InterventionReportService', () => {
  let service: InterventionReportService;
  let mockInterventionService: jasmine.SpyObj<InterventionService>;
  let mockServicerService: jasmine.SpyObj<ServicerService>;
  let mockStorageService: jasmine.SpyObj<StorageService>;
  let mockReportService: jasmine.SpyObj<ReportService>;
  let mockLoggerService: jasmine.SpyObj<LoggerService>;
  let mockToastCtrl: jasmine.SpyObj<ToastController>;
  let mockTransloco: jasmine.SpyObj<TranslocoService>;

  /** Context captured via reportService.generate callFake */
  let capturedCtx: InterventionReportContext | undefined;

  beforeEach(() => {
    mockInterventionService = createMockInterventionService();
    mockServicerService = createMockServicerService();
    mockStorageService = createMockStorageService();
    mockReportService = createMockReportService();
    mockLoggerService = createMockLoggerService();
    mockToastCtrl = createMockToastController();
    mockTransloco = createMockTranslocoService();

    capturedCtx = undefined;
    // Default: capture the context and resolve successfully
    mockReportService.generate.and.callFake(
      (_type: string, ctx: InterventionReportContext) => {
        capturedCtx = ctx;
        return Promise.resolve();
      },
    );

    TestBed.configureTestingModule({
      providers: [
        InterventionReportService,
        { provide: InterventionService, useValue: mockInterventionService },
        { provide: ServicerService,     useValue: mockServicerService },
        { provide: StorageService,      useValue: mockStorageService },
        { provide: ReportService,       useValue: mockReportService },
        { provide: LoggerService,       useValue: mockLoggerService },
        { provide: ToastController,     useValue: mockToastCtrl },
        { provide: TranslocoService,    useValue: mockTransloco },
      ],
    });

    service = TestBed.inject(InterventionReportService);
  });

  // ===========================================================================
  // TC-IRS01 — happy path: generate called with 'intervention-receipt' and full ctx
  // ===========================================================================

  describe('TC-IRS01: generate() called with correct type and complete ctx', () => {
    it('calls reportService.generate with type "intervention-receipt"', async () => {
      const device = createMockDevice();
      await service.open('SN123', device, baseData());
      expect(mockReportService.generate).toHaveBeenCalledTimes(1);
      const [type] = mockReportService.generate.calls.first().args as [string, unknown];
      expect(type).toBe('intervention-receipt');
    });

    it('ctx contains all required top-level properties', async () => {
      const device = createMockDevice();
      await service.open('SN123', device, baseData());
      expect(capturedCtx).toBeDefined();
      expect(capturedCtx!.company).toBeDefined();
      expect(capturedCtx!.user).toBeDefined();
      expect(capturedCtx!.device).toBeDefined();
      expect(capturedCtx!.intervention).toBeDefined();
      expect(capturedCtx!.parameterSections).toBeDefined();
    });
  });

  // ===========================================================================
  // TC-IRS02 — company source: addedBy present → getByEmail; getCurrent NOT called
  // ===========================================================================

  describe('TC-IRS02: company source when addedBy is present', () => {
    it('calls getByEmail(addedBy) and NOT getCurrent()', async () => {
      const company: Servicer = { company: 'TechServ', email: 'tech@serv.com' };
      mockServicerService.getByEmail.and.resolveTo(company);

      const device = createMockDevice();
      await service.open('SN1', device, baseData({ addedBy: 'tech@serv.com' }));

      expect(mockServicerService.getByEmail).toHaveBeenCalledWith('tech@serv.com');
      expect(mockServicerService.getCurrent).not.toHaveBeenCalled();
      expect(capturedCtx!.company).toEqual(company);
    });
  });

  // ===========================================================================
  // TC-IRS03 — company source: no addedBy → getCurrent; getByEmail NOT called
  // ===========================================================================

  describe('TC-IRS03: company source when addedBy is absent', () => {
    it('calls getCurrent() and NOT getByEmail()', async () => {
      const company: Servicer = { company: 'DefaultCo', email: 'default@co.com' };
      mockServicerService.getCurrent.and.resolveTo(company);

      const device = createMockDevice();
      await service.open('SN1', device, baseData());

      expect(mockServicerService.getCurrent).toHaveBeenCalledTimes(1);
      expect(mockServicerService.getByEmail).not.toHaveBeenCalled();
      expect(capturedCtx!.company).toEqual(company);
    });
  });

  // ===========================================================================
  // TC-IRS04 — company: null result → ctx.company is {}
  // ===========================================================================

  describe('TC-IRS04: ctx.company is {} when servicer resolves to null', () => {
    it('company is empty object when getCurrent returns null', async () => {
      mockServicerService.getCurrent.and.resolveTo(null);
      const device = createMockDevice();
      await service.open('SN1', device, baseData());
      expect(capturedCtx!.company).toEqual({});
    });

    it('company is empty object when getByEmail returns null', async () => {
      mockServicerService.getByEmail.and.resolveTo(null);
      const device = createMockDevice();
      await service.open('SN1', device, baseData({ addedBy: 'missing@co.com' }));
      expect(capturedCtx!.company).toEqual({});
    });
  });

  // ===========================================================================
  // TC-IRS05 — parts: sparePart1..4 mapped via str()
  // ===========================================================================

  describe('TC-IRS05: spare parts mapping', () => {
    it('maps sparePart1..4 into ctx.intervention.parts array', async () => {
      const device = createMockDevice();
      const data = baseData({
        sparePart1: 'Filter A',
        sparePart2: 'Pump B',
        sparePart3: null,
        sparePart4: undefined,
      });
      await service.open('SN1', device, data);
      expect(capturedCtx!.intervention.parts).toEqual(['Filter A', 'Pump B', '', '']);
    });

    it('all parts are empty strings when none provided', async () => {
      const device = createMockDevice();
      await service.open('SN1', device, baseData());
      expect(capturedCtx!.intervention.parts).toEqual(['', '', '', '']);
    });
  });

  // ===========================================================================
  // TC-IRS06 — signaturePath: present → getFileUrl called; url in ctx
  // ===========================================================================

  describe('TC-IRS06: signaturePath present', () => {
    it('calls storageService.getFileUrl with the path and puts url in ctx', async () => {
      mockStorageService.getFileUrl.and.resolveTo('https://storage.example.com/sig.png');
      const device = createMockDevice();
      await service.open('SN1', device, baseData({ signaturePath: 'signatures/abc.png' }));
      expect(mockStorageService.getFileUrl).toHaveBeenCalledWith('signatures/abc.png');
      expect(capturedCtx!.signatureUrl).toBe('https://storage.example.com/sig.png');
    });

    it('signatureUrl is undefined when getFileUrl returns null', async () => {
      mockStorageService.getFileUrl.and.resolveTo(null);
      const device = createMockDevice();
      await service.open('SN1', device, baseData({ signaturePath: 'signatures/abc.png' }));
      expect(capturedCtx!.signatureUrl).toBeUndefined();
    });
  });

  // ===========================================================================
  // TC-IRS07 — signaturePath absent → getFileUrl NOT called, signatureUrl undefined
  // ===========================================================================

  describe('TC-IRS07: signaturePath absent', () => {
    it('does not call getFileUrl and signatureUrl is undefined', async () => {
      const device = createMockDevice();
      await service.open('SN1', device, baseData());
      expect(mockStorageService.getFileUrl).not.toHaveBeenCalled();
      expect(capturedCtx!.signatureUrl).toBeUndefined();
    });
  });

  // ===========================================================================
  // TC-IRS08 — typeLabel: getInterventionLabel returns key → transloco.translate called
  // ===========================================================================

  describe('TC-IRS08: typeLabel via getInterventionLabel', () => {
    it('uses transloco.translate of the label key when label is not null', async () => {
      mockInterventionService.getInterventionLabel.and.returnValue('intervention_type_commissioning_gas_boiler');
      (mockTransloco.translate as jasmine.Spy).and.callFake((key: string) => {
        if (key === 'intervention_type_commissioning_gas_boiler') return 'Puštanje u rad';
        return key;
      });
      const device = createMockDevice();
      await service.open('SN1', device, baseData({ interventionType: 'commissioning' }));
      expect(capturedCtx!.intervention.typeLabel).toBe('Puštanje u rad');
    });

    it('falls back to typeRaw when getInterventionLabel returns null', async () => {
      mockInterventionService.getInterventionLabel.and.returnValue(null);
      const device = createMockDevice();
      await service.open('SN1', device, baseData({ interventionType: 'unknown_type' }));
      // When label is null, typeLabelKey = typeRaw = 'unknown_type'
      // Then transloco.translate('unknown_type') is called (key-as-is) → 'unknown_type'
      expect(capturedCtx!.intervention.typeLabel).toBe('unknown_type');
    });
  });

  // ===========================================================================
  // TC-IRS09 — faultDescription: REAL translation proof
  // ===========================================================================

  describe('TC-IRS09: faultDescription with real translation', () => {
    it('translates interventionDescription i18n key to human-readable text', async () => {
      // Override translate so 'intervention_fault_leak' maps to 'Curi voda'
      (mockTransloco.translate as jasmine.Spy).and.callFake((key: string) => {
        if (key === 'intervention_fault_leak') return 'Curi voda';
        return key;
      });
      const device = createMockDevice();
      await service.open('SN1', device, baseData({ interventionDescription: 'intervention_fault_leak' }));
      expect(capturedCtx!.intervention.faultDescription).toBe('Curi voda');
    });

    it('faultDescription is empty string when interventionDescription is absent', async () => {
      const device = createMockDevice();
      await service.open('SN1', device, baseData());
      expect(capturedCtx!.intervention.faultDescription).toBe('');
    });

    it('faultDescription is empty string when interventionDescription is empty string', async () => {
      const device = createMockDevice();
      await service.open('SN1', device, baseData({ interventionDescription: '' }));
      expect(capturedCtx!.intervention.faultDescription).toBe('');
    });
  });

  // ===========================================================================
  // TC-IRS10 — fullName and address built from registration fields
  // ===========================================================================

  describe('TC-IRS10: user fullName and address from registration', () => {
    it('fullName is firstName + lastName trimmed', async () => {
      mockInterventionService.getRegistration.and.resolveTo({
        firstName: 'Petar',
        lastName: 'Petrovic',
      });
      const device = createMockDevice();
      await service.open('SN1', device, baseData());
      expect(capturedCtx!.user.fullName).toBe('Petar Petrovic');
    });

    it('fullName is single name when lastName is missing', async () => {
      mockInterventionService.getRegistration.and.resolveTo({
        firstName: 'Petar',
      });
      const device = createMockDevice();
      await service.open('SN1', device, baseData());
      expect(capturedCtx!.user.fullName).toBe('Petar');
    });

    it('address is streetName + homeNumber trimmed', async () => {
      mockInterventionService.getRegistration.and.resolveTo({
        streetName: 'Knez Mihailova',
        homeNumber: '12',
      });
      const device = createMockDevice();
      await service.open('SN1', device, baseData());
      expect(capturedCtx!.user.address).toBe('Knez Mihailova 12');
    });

    it('address is empty string when registration is null', async () => {
      mockInterventionService.getRegistration.and.resolveTo(null);
      const device = createMockDevice();
      await service.open('SN1', device, baseData());
      expect(capturedCtx!.user.fullName).toBe('');
      expect(capturedCtx!.user.address).toBe('');
    });
  });

  // ===========================================================================
  // TC-IRS11 — connectedSn: HEAT_PUMP → reg['connectedDevice']; other → undefined
  // ===========================================================================

  describe('TC-IRS11: connectedSn device type logic', () => {
    it('connectedSn is set from registration when device type is HEAT_PUMP', async () => {
      mockInterventionService.getRegistration.and.resolveTo({
        connectedDevice: 'HP-BOILER-SN999',
      });
      const device = createMockDevice({ type: DeviceType.HEAT_PUMP });
      await service.open('SN1', device, baseData());
      expect(capturedCtx!.device.connectedSn).toBe('HP-BOILER-SN999');
    });

    it('connectedSn is undefined when device type is GAS_BOILER', async () => {
      mockInterventionService.getRegistration.and.resolveTo({
        connectedDevice: 'HP-BOILER-SN999',
      });
      const device = createMockDevice({ type: DeviceType.GAS_BOILER });
      await service.open('SN1', device, baseData());
      expect(capturedCtx!.device.connectedSn).toBeUndefined();
    });

    it('connectedSn is undefined when device type is BOILER', async () => {
      const device = createMockDevice({ type: DeviceType.BOILER });
      await service.open('SN1', device, baseData());
      expect(capturedCtx!.device.connectedSn).toBeUndefined();
    });

    it('connectedSn is undefined when device type is AIR_CONDITION', async () => {
      const device = createMockDevice({ type: DeviceType.AIR_CONDITION });
      await service.open('SN1', device, baseData());
      expect(capturedCtx!.device.connectedSn).toBeUndefined();
    });
  });

  // ===========================================================================
  // TC-IRS12 — parameterSections: empty/absent envInfo → []
  // ===========================================================================

  describe('TC-IRS12: parameterSections from envInfo', () => {
    it('returns empty array when envInfo is absent', async () => {
      const device = createMockDevice({ type: DeviceType.GAS_BOILER });
      await service.open('SN1', device, baseData());
      expect(capturedCtx!.parameterSections).toEqual([]);
    });

    it('returns empty array when envInfo is an empty object', async () => {
      const device = createMockDevice({ type: DeviceType.GAS_BOILER });
      await service.open('SN1', device, baseData({ envInfo: {} }));
      expect(capturedCtx!.parameterSections).toEqual([]);
    });

    it('returns sections when GAS_BOILER envInfo has data (select field)', async () => {
      // gasType is a select field in GAS_BOILER — stored as i18n key
      const envInfo = { gasType: 'env_info_opt_gas_natural' };
      const device = createMockDevice({ type: DeviceType.GAS_BOILER });
      // transloco pass-through: label = 'env_info_gas_type', value = translated key
      await service.open('SN1', device, baseData({ envInfo }));
      expect(capturedCtx!.parameterSections!.length).toBeGreaterThan(0);
      const section = capturedCtx!.parameterSections![0];
      expect(section.rows.length).toBeGreaterThan(0);
      // value should be the translated key (pass-through in mock)
      expect(section.rows[0].value).toBe('env_info_opt_gas_natural');
    });

    it('returns sections with number+unit when GAS_BOILER envInfo has numeric field', async () => {
      // voltage is a number field with unit 'V'
      const envInfo = { voltage: '230' };
      const device = createMockDevice({ type: DeviceType.GAS_BOILER });
      await service.open('SN1', device, baseData({ envInfo }));
      expect(capturedCtx!.parameterSections!.length).toBeGreaterThan(0);
      const rows = capturedCtx!.parameterSections![0].rows;
      const voltageRow = rows.find(r => r.label === 'env_info_voltage');
      expect(voltageRow).toBeDefined();
      expect(voltageRow!.value).toBe('230 V');
    });

    it('skips fields with empty string value', async () => {
      // Only provide one non-empty field; others are empty
      const envInfo = { gasType: '', voltage: '220' };
      const device = createMockDevice({ type: DeviceType.GAS_BOILER });
      await service.open('SN1', device, baseData({ envInfo }));
      const allRows = capturedCtx!.parameterSections!.flatMap(s => s.rows);
      const gasTypeRow = allRows.find(r => r.label === 'env_info_gas_type');
      expect(gasTypeRow).toBeUndefined();
    });

    it('returns empty array for BOILER device type (no env-info fields defined)', async () => {
      const envInfo = { someField: 'someValue' };
      const device = createMockDevice({ type: DeviceType.BOILER });
      await service.open('SN1', device, baseData({ envInfo }));
      expect(capturedCtx!.parameterSections).toEqual([]);
    });

    it('returns sections for HEAT_PUMP with electrical envInfo data', async () => {
      const envInfo = { outdoorFuse: 'env_info_opt_c16a' };
      const device = createMockDevice({ type: DeviceType.HEAT_PUMP });
      await service.open('SN1', device, baseData({ envInfo }));
      expect(capturedCtx!.parameterSections!.length).toBeGreaterThan(0);
    });

    it('excludes freon section for HEAT_PUMP monoblock subType', async () => {
      const envInfo = {
        outdoorFuse: 'env_info_opt_c16a',
        pipeLength: '10',   // freon section field
        sysWaterPressure: '2', // systemOp section field
      };
      const device = createMockDevice({ type: DeviceType.HEAT_PUMP, subType: 'monoblock' });
      await service.open('SN1', device, baseData({ envInfo }));
      const sectionKeys = capturedCtx!.parameterSections!.map(s => s.title);
      // env_info_section_freon should not appear (key as-is from mock transloco)
      expect(sectionKeys).not.toContain('env_info_section_freon');
    });
  });

  // ===========================================================================
  // TC-IRS13 — consent: BOILER → boiler-disclaimer, GAS_BOILER/HP → service-consent,
  //            AIR_CONDITION/other → undefined
  // ===========================================================================

  describe('TC-IRS13: buildConsent device type routing', () => {
    it('BOILER → consent.type = "boiler-disclaimer" and accepted = null', async () => {
      const device = createMockDevice({ type: DeviceType.BOILER });
      await service.open('SN1', device, baseData());
      expect(capturedCtx!.consent).toEqual({ type: 'boiler-disclaimer', accepted: null });
    });

    it('GAS_BOILER → consent.type = "service-consent"', async () => {
      const device = createMockDevice({ type: DeviceType.GAS_BOILER });
      await service.open('SN1', device, baseData({ callAccepted: true }));
      expect(capturedCtx!.consent!.type).toBe('service-consent');
    });

    it('HEAT_PUMP → consent.type = "service-consent"', async () => {
      const device = createMockDevice({ type: DeviceType.HEAT_PUMP });
      await service.open('SN1', device, baseData({ callAccepted: false }));
      expect(capturedCtx!.consent!.type).toBe('service-consent');
    });

    it('AIR_CONDITION → consent is undefined', async () => {
      const device = createMockDevice({ type: DeviceType.AIR_CONDITION });
      await service.open('SN1', device, baseData());
      expect(capturedCtx!.consent).toBeUndefined();
    });
  });

  // ===========================================================================
  // TC-IRS14 — resolveCallAccepted: data.callAccepted boolean → used directly
  // ===========================================================================

  describe('TC-IRS14: resolveCallAccepted — data.callAccepted present', () => {
    it('uses data.callAccepted = true directly in consent.accepted', async () => {
      const device = createMockDevice({ type: DeviceType.GAS_BOILER });
      await service.open('SN1', device, baseData({ callAccepted: true }));
      expect(capturedCtx!.consent!.accepted).toBe(true);
      // getInterventionsBySn should NOT be called when callAccepted is in data
      expect(mockInterventionService.getInterventionsBySn).not.toHaveBeenCalled();
    });

    it('uses data.callAccepted = false directly in consent.accepted', async () => {
      const device = createMockDevice({ type: DeviceType.HEAT_PUMP });
      await service.open('SN1', device, baseData({ callAccepted: false }));
      expect(capturedCtx!.consent!.accepted).toBe(false);
    });
  });

  // ===========================================================================
  // TC-IRS15 — resolveCallAccepted: non-eligible type → null (no getInterventionsBySn call)
  // ===========================================================================

  describe('TC-IRS15: resolveCallAccepted — non-eligible device type', () => {
    it('BOILER: consent.accepted is null and getInterventionsBySn not called', async () => {
      const device = createMockDevice({ type: DeviceType.BOILER });
      await service.open('SN1', device, baseData());
      // BOILER has boiler-disclaimer, not service-consent — accepted = null
      expect(capturedCtx!.consent!.accepted).toBeNull();
      expect(mockInterventionService.getInterventionsBySn).not.toHaveBeenCalled();
    });

    it('AIR_CONDITION: consent is undefined and getInterventionsBySn not called', async () => {
      const device = createMockDevice({ type: DeviceType.AIR_CONDITION });
      await service.open('SN1', device, baseData());
      expect(capturedCtx!.consent).toBeUndefined();
      expect(mockInterventionService.getInterventionsBySn).not.toHaveBeenCalled();
    });
  });

  // ===========================================================================
  // TC-IRS16 — resolveCallAccepted: GAS_BOILER without callAccepted in data
  //            → reverse search via getInterventionsBySn
  // ===========================================================================

  describe('TC-IRS16: resolveCallAccepted — reverse search via getInterventionsBySn', () => {
    it('finds the last intervention with boolean callAccepted (true)', async () => {
      mockInterventionService.getInterventionsBySn.and.resolveTo([
        { id: 'i1', data: { callAccepted: 'nope' } },
        { id: 'i2', data: { callAccepted: true } },
        { id: 'i3', data: {} },
      ]);
      const device = createMockDevice({ type: DeviceType.GAS_BOILER });
      // No callAccepted in data — triggers reverse search; last boolean is i2=true
      await service.open('SN1', device, baseData());
      expect(mockInterventionService.getInterventionsBySn).toHaveBeenCalledWith('SN1', DeviceType.GAS_BOILER);
      expect(capturedCtx!.consent!.accepted).toBe(true);
    });

    it('finds the last intervention with boolean callAccepted (false)', async () => {
      mockInterventionService.getInterventionsBySn.and.resolveTo([
        { id: 'i1', data: { callAccepted: true } },
        { id: 'i2', data: { callAccepted: false } },
      ]);
      const device = createMockDevice({ type: DeviceType.HEAT_PUMP });
      await service.open('SN1', device, baseData());
      // Reverse search: last is i2 (index 1), first boolean found going backwards = false
      expect(capturedCtx!.consent!.accepted).toBe(false);
    });

    it('returns null when no intervention has a boolean callAccepted', async () => {
      mockInterventionService.getInterventionsBySn.and.resolveTo([
        { id: 'i1', data: { callAccepted: 'yes' } },
        { id: 'i2', data: {} },
      ]);
      const device = createMockDevice({ type: DeviceType.GAS_BOILER });
      await service.open('SN1', device, baseData());
      expect(capturedCtx!.consent!.accepted).toBeNull();
    });

    it('returns null when getInterventionsBySn returns empty array', async () => {
      mockInterventionService.getInterventionsBySn.and.resolveTo([]);
      const device = createMockDevice({ type: DeviceType.GAS_BOILER });
      await service.open('SN1', device, baseData());
      expect(capturedCtx!.consent!.accepted).toBeNull();
    });

    it('returns null and calls logger.warn when getInterventionsBySn throws', async () => {
      mockInterventionService.getInterventionsBySn.and.rejectWith(new Error('Firestore error'));
      const device = createMockDevice({ type: DeviceType.GAS_BOILER });
      // open() itself must NOT throw even when getInterventionsBySn throws inside resolveCallAccepted
      await expectAsync(service.open('SN1', device, baseData())).toBeResolved();
      expect(mockLoggerService.warn).toHaveBeenCalled();
      expect(capturedCtx!.consent!.accepted).toBeNull();
    });
  });

  // ===========================================================================
  // TC-IRS17 — error: reportService.generate rejects → open() does NOT throw,
  //            logger.error called, toastCtrl.create called with 'danger'
  // ===========================================================================

  describe('TC-IRS17: error handling when generate() rejects', () => {
    beforeEach(() => {
      mockReportService.generate.and.rejectWith(new Error('PDF failed'));
    });

    it('open() resolves without throwing', async () => {
      const device = createMockDevice();
      await expectAsync(service.open('SN1', device, baseData())).toBeResolved();
    });

    it('logger.error is called with error info', async () => {
      const device = createMockDevice();
      await service.open('SN1', device, baseData());
      expect(mockLoggerService.error).toHaveBeenCalledWith(
        'Report generation failed',
        jasmine.objectContaining({ error: jasmine.any(String) }),
      );
    });

    it('toastCtrl.create is called with report_error message and danger color', async () => {
      // transloco pass-through: 'report_error' → 'report_error'
      const device = createMockDevice();
      await service.open('SN1', device, baseData());
      expect(mockToastCtrl.create).toHaveBeenCalledWith(
        jasmine.objectContaining({
          message: 'report_error',
          color: 'danger',
        }),
      );
    });

    it('toast.present() is called', async () => {
      const mockToast = {
        present: jasmine.createSpy('present').and.resolveTo(),
        dismiss: jasmine.createSpy('dismiss').and.resolveTo(true),
        onDidDismiss: jasmine.createSpy('onDidDismiss').and.resolveTo({ data: undefined, role: 'backdrop' }),
      } as unknown as HTMLIonToastElement;
      mockToastCtrl.create.and.resolveTo(mockToast);

      const device = createMockDevice();
      await service.open('SN1', device, baseData());
      expect(mockToast.present).toHaveBeenCalledTimes(1);
    });
  });

  // ===========================================================================
  // TC-IRS18 — no loadingAlert: service does NOT call any loading-related method
  // ===========================================================================

  describe('TC-IRS18: service does not own/manage a loader', () => {
    it('service has no loadingAlert property or method', () => {
      // InterventionReportService must NOT own a LoadingAlertService reference
      // (the caller owns the loader per architectural decision)
      const serviceAny = service as any;
      expect(serviceAny.loadingAlert).toBeUndefined();
      expect(serviceAny.loadingAlertService).toBeUndefined();
    });
  });

  // ===========================================================================
  // TC-IRS19 — device fields passed to ctx.device
  // ===========================================================================

  describe('TC-IRS19: ctx.device fields from device argument', () => {
    it('ctx.device.name, type, subType, sn are set correctly', async () => {
      const device = createMockDevice({
        name: 'Nuos Primo 100',
        type: DeviceType.HEAT_PUMP,
        subType: 'split',
      });
      await service.open('HP-SN-001', device, baseData());
      expect(capturedCtx!.device.name).toBe('Nuos Primo 100');
      expect(capturedCtx!.device.type).toBe(DeviceType.HEAT_PUMP);
      expect(capturedCtx!.device.subType).toBe('split');
      expect(capturedCtx!.device.sn).toBe('HP-SN-001');
    });
  });

  // ===========================================================================
  // TC-IRS20 — intervention.servicer equals the addedBy email (str)
  // ===========================================================================

  describe('TC-IRS20: intervention.servicer is addedBy email', () => {
    it('servicer is set to addedBy value from data', async () => {
      const device = createMockDevice();
      await service.open('SN1', device, baseData({ addedBy: 'tech@example.com' }));
      expect(capturedCtx!.intervention.servicer).toBe('tech@example.com');
    });

    it('servicer is empty string when addedBy is absent', async () => {
      const device = createMockDevice();
      await service.open('SN1', device, baseData());
      expect(capturedCtx!.intervention.servicer).toBe('');
    });
  });

  // ===========================================================================
  // TC-IRS21 — intervention.note
  // ===========================================================================

  describe('TC-IRS21: intervention.note', () => {
    it('note is set from data.note', async () => {
      const device = createMockDevice();
      await service.open('SN1', device, baseData({ note: 'Check pressure valve' }));
      expect(capturedCtx!.intervention.note).toBe('Check pressure valve');
    });

    it('note is empty string when absent', async () => {
      const device = createMockDevice();
      await service.open('SN1', device, baseData());
      expect(capturedCtx!.intervention.note).toBe('');
    });
  });

  // ===========================================================================
  // TC-IRS22 — intervention.date from addedDate Timestamp
  // ===========================================================================

  describe('TC-IRS22: intervention.date formatted from addedDate', () => {
    it('formats date as dd.mm.yyyy from a Timestamp-like object', async () => {
      // Provide a Timestamp-compatible object with toDate() method
      const mockTimestamp = {
        toDate: () => new Date(2026, 5, 7), // June 7, 2026
      };
      const device = createMockDevice();
      await service.open('SN1', device, baseData({ addedDate: mockTimestamp }));
      // Serbian date format ends with a trailing dot: 07.06.2026.
      expect(capturedCtx!.intervention.date).toBe('07.06.2026.');
    });

    it('date is empty string when addedDate is absent', async () => {
      const device = createMockDevice();
      await service.open('SN1', device, baseData());
      expect(capturedCtx!.intervention.date).toBe('');
    });
  });

  // ===========================================================================
  // TC-IRS23 — user.city and user.phone from registration
  // ===========================================================================

  describe('TC-IRS23: user city and phone from registration', () => {
    it('sets city and phone from registration fields', async () => {
      mockInterventionService.getRegistration.and.resolveTo({
        city: 'Beograd',
        phoneNumber: '+381601234567',
      });
      const device = createMockDevice();
      await service.open('SN1', device, baseData());
      expect(capturedCtx!.user.city).toBe('Beograd');
      expect(capturedCtx!.user.phone).toBe('+381601234567');
    });
  });

  // ===========================================================================
  // TC-IRS24 — GAS_BOILER consent.accepted from data.callAccepted false
  // ===========================================================================

  describe('TC-IRS24: GAS_BOILER consent.accepted = false when data.callAccepted = false', () => {
    it('accepted is false', async () => {
      const device = createMockDevice({ type: DeviceType.GAS_BOILER });
      await service.open('SN1', device, baseData({ callAccepted: false }));
      expect(capturedCtx!.consent).toEqual({ type: 'service-consent', accepted: false });
    });
  });
});
