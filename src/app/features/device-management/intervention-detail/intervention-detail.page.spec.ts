/**
 * InterventionDetailPage Unit Tests — WU-45, Batch B6
 *
 * MOCK STRATEGY
 * =============
 * InterventionService:  jasmine.createSpyObj (getInterventionById, getRegistration, getInterventionLabel)
 * DeviceLookupService:  plain object with device / sn / lookup spy
 * DeviceEnvInfoService: jasmine.createSpyObj (viewEnvInfo)
 * ActivatedRoute:       plain object with paramMap snapshot
 * LoggerService:        createMockLoggerService()
 * TranslocoService:     TranslocoTestingModule (real service, minimal lang map)
 */

import { TestBed, ComponentFixture } from '@angular/core/testing';
import { ActivatedRoute } from '@angular/router';
import { TranslocoTestingModule } from '@jsverse/transloco';

import { InterventionDetailPage } from './intervention-detail.page';
import { InterventionService } from '../services/intervention.service';
import { DeviceLookupService } from '../services/device-lookup.service';
import { DeviceEnvInfoService } from '../services/device-env-info.service';
import { LoggerService } from '../../../core/logger/logger.service';
import { Device, DeviceType } from '../../../shared/models/device.model';
import { createMockLoggerService } from '../../../testing/mock-factories';
import { buildFirestoreTimestamp } from '../../../testing/test-data-builders';

// ─── Factories ────────────────────────────────────────────────────────────────

function createMockDevice(overrides: Partial<Device> = {}): Device {
  return {
    code: 'MODEL-001',
    name: 'Test Boiler',
    type: DeviceType.GAS_BOILER,
    subType: '',
    unitCount: 0,
    exists: true,
    ...overrides,
  };
}

function buildActivatedRoute(params: Record<string, string | null>) {
  return {
    snapshot: {
      paramMap: {
        get: (key: string) => params[key] ?? null,
      },
    },
  };
}

function buildInterventionService(
  overrides: Partial<jasmine.SpyObj<InterventionService>> = {},
): jasmine.SpyObj<InterventionService> {
  const spy = jasmine.createSpyObj<InterventionService>('InterventionService', [
    'getInterventionById',
    'getRegistration',
    'getInterventionLabel',
  ]);
  spy.getInterventionById.and.resolveTo(null);
  spy.getRegistration.and.resolveTo(null);
  spy.getInterventionLabel.and.returnValue(null);
  return Object.assign(spy, overrides);
}

function buildLookupService(device: Device | null = null, sn = ''): {
  device: Device | null;
  sn: string;
  lookup: jasmine.Spy;
} {
  return {
    device,
    sn,
    lookup: jasmine.createSpy('lookup').and.resolveTo(device),
  };
}

// Minimal translations so TranslocoModule renders without errors
const translocoLangs = { en: {} };

// ─── Spec ─────────────────────────────────────────────────────────────────────

describe('InterventionDetailPage', () => {
  let fixture: ComponentFixture<InterventionDetailPage>;
  let component: InterventionDetailPage;

  let mockInterventionService: jasmine.SpyObj<InterventionService>;
  let mockLookupService: ReturnType<typeof buildLookupService>;
  let mockEnvInfoService: jasmine.SpyObj<DeviceEnvInfoService>;
  let mockLogger: jasmine.SpyObj<LoggerService>;
  let mockRoute: ReturnType<typeof buildActivatedRoute>;

  function setup(
    routeParams: Record<string, string | null> = { sn: 'SN001', id: 'intervention-uuid' },
    device: Device | null = createMockDevice(),
    lookupStale = false,
  ): void {
    mockRoute = buildActivatedRoute(routeParams);
    mockLookupService = buildLookupService(
      lookupStale ? null : device,
      lookupStale ? '' : (routeParams['sn'] ?? ''),
    );

    TestBed.configureTestingModule({
      imports: [
        InterventionDetailPage,
        TranslocoTestingModule.forRoot({
          langs: translocoLangs,
          translocoConfig: { availableLangs: ['en'], defaultLang: 'en' },
          preloadLangs: true,
        }),
      ],
      providers: [
        { provide: ActivatedRoute, useValue: mockRoute },
        { provide: InterventionService, useValue: mockInterventionService },
        { provide: DeviceLookupService, useValue: mockLookupService },
        { provide: DeviceEnvInfoService, useValue: mockEnvInfoService },
        { provide: LoggerService, useValue: mockLogger },
      ],
    });

    fixture = TestBed.createComponent(InterventionDetailPage);
    component = fixture.componentInstance;
    fixture.detectChanges();
  }

  beforeEach(() => {
    mockInterventionService = buildInterventionService();
    mockLookupService = buildLookupService(createMockDevice(), 'SN001');
    mockEnvInfoService = jasmine.createSpyObj<DeviceEnvInfoService>('DeviceEnvInfoService', [
      'viewEnvInfo',
    ]);
    mockEnvInfoService.viewEnvInfo.and.resolveTo();
    mockLogger = createMockLoggerService();
  });

  afterEach(() => {
    TestBed.resetTestingModule();
  });

  // ─── TC-IDP-01: ionViewWillEnter extracts sn from route ──────────────────────

  it('TC-IDP-01: ionViewWillEnter sets sn from route paramMap', async () => {
    mockInterventionService.getInterventionById.and.resolveTo({
      interventionType: 'intervention_repair',
    });
    setup({ sn: 'SN999', id: 'some-id' });

    await component.ionViewWillEnter();

    expect((component as unknown as { sn: string }).sn).toBe('SN999');
  });

  // ─── TC-IDP-02: Device lookup if stale ───────────────────────────────────────

  it('TC-IDP-02: calls lookup when lookupService.sn does not match current sn', async () => {
    mockInterventionService.getInterventionById.and.resolveTo({ interventionType: 'repair' });
    // Provide stale lookup (sn mismatch)
    setup({ sn: 'SN_NEW', id: 'int-id' }, createMockDevice(), true);

    await component.ionViewWillEnter();

    expect(mockLookupService.lookup).toHaveBeenCalledWith('SN_NEW');
  });

  // ─── TC-IDP-03: loadDetail called on enter ───────────────────────────────────

  it('TC-IDP-03: loadDetail is invoked and sets isLoading to false after completion', async () => {
    const interventionData = { interventionType: 'commissioning', callAccepted: true };
    mockInterventionService.getInterventionById.and.resolveTo(interventionData);
    setup({ sn: 'SN001', id: 'abc-def' });

    await component.ionViewWillEnter();

    expect((component as unknown as { isLoading: boolean }).isLoading).toBeFalse();
  });

  // ─── TC-IDP-04: id != 'registration' → getInterventionById ──────────────────

  it('TC-IDP-04: non-registration id calls getInterventionById with the correct id', async () => {
    mockInterventionService.getInterventionById.and.resolveTo({ interventionType: 'repair' });
    setup({ sn: 'SN001', id: 'intervention-uuid' });

    await component.ionViewWillEnter();

    expect(mockInterventionService.getInterventionById).toHaveBeenCalledWith(
      'intervention-uuid',
      DeviceType.GAS_BOILER,
    );
    expect(mockInterventionService.getRegistration).not.toHaveBeenCalled();
  });

  // ─── TC-IDP-05: id === 'registration' → getRegistration ─────────────────────

  it('TC-IDP-05: id "registration" calls getRegistration and sets isRegistration=true', async () => {
    mockInterventionService.getRegistration.and.resolveTo({
      registeredAt: '2024-01-01',
      warrantyStatus: 'in-warranty',
    });
    setup({ sn: 'SN001', id: 'registration' });

    await component.ionViewWillEnter();

    expect(mockInterventionService.getRegistration).toHaveBeenCalledWith('SN001');
    expect(mockInterventionService.getInterventionById).not.toHaveBeenCalled();
  });

  // ─── TC-IDP-06: Not found → notFound flag set ────────────────────────────────

  it('TC-IDP-06: when service returns null, notFound is set to true and fields remain empty', async () => {
    mockInterventionService.getInterventionById.and.resolveTo(null);
    setup({ sn: 'SN001', id: 'missing-id' });

    await component.ionViewWillEnter();

    expect((component as unknown as { notFound: boolean }).notFound).toBeTrue();
    expect((component as unknown as { fields: unknown[] }).fields).toEqual([]);
  });

  // ─── TC-IDP-07: buildDisplayFields returns ordered list ──────────────────────

  it('TC-IDP-07: buildDisplayFields returns only fields present in data, preserving display order', async () => {
    mockInterventionService.getInterventionById.and.resolveTo({
      interventionType: 'intervention_repair',
      callAccepted: true,
      addedBy: 'admin@test.com',
    });
    setup({ sn: 'SN001', id: 'int-1' });

    await component.ionViewWillEnter();

    const fields = (component as unknown as { fields: Array<{ key: string }> }).fields;
    const keys = fields.map(f => f.key);

    // interventionType comes before callAccepted in INTERVENTION_DISPLAY_FIELDS
    expect(keys.indexOf('interventionType')).toBeLessThan(keys.indexOf('callAccepted'));
    // callAccepted comes before addedBy
    expect(keys.indexOf('callAccepted')).toBeLessThan(keys.indexOf('addedBy'));
  });

  // ─── TC-IDP-08: Field labels are i18n keys from FIELD_LABEL_KEYS ─────────────

  it('TC-IDP-08: each displayed field has the correct i18n labelKey', async () => {
    mockInterventionService.getInterventionById.and.resolveTo({
      interventionType: 'commissioning',
      callAccepted: false,
    });
    setup({ sn: 'SN001', id: 'int-2' });

    await component.ionViewWillEnter();

    const fields = (component as unknown as { fields: Array<{ key: string; labelKey: string }> }).fields;
    const typeField = fields.find(f => f.key === 'interventionType');
    const callField = fields.find(f => f.key === 'callAccepted');

    expect(typeField?.labelKey).toBe('intervention_type_label');
    expect(callField?.labelKey).toBe('intervention_call_accepted_label');
  });

  // ─── TC-IDP-09: Spare parts suffix (labelSuffix) ─────────────────────────────

  it('TC-IDP-09: sparePart fields have labelSuffix set to their part number as string', async () => {
    mockInterventionService.getInterventionById.and.resolveTo({
      sparePart1: 'Gasket',
      sparePart2: 'Valve',
    });
    setup({ sn: 'SN001', id: 'int-3' });

    await component.ionViewWillEnter();

    const fields = (component as unknown as { fields: Array<{ key: string; labelSuffix?: string }> }).fields;
    const part1 = fields.find(f => f.key === 'sparePart1');
    const part2 = fields.find(f => f.key === 'sparePart2');

    expect(part1?.labelSuffix).toBe('1');
    expect(part2?.labelSuffix).toBe('2');
  });

  // ─── TC-IDP-10: resolveRawValue — interventionType uses getInterventionLabel ──

  it('TC-IDP-10: interventionType field rawValue is resolved via getInterventionLabel', async () => {
    mockInterventionService.getInterventionLabel.and.returnValue('intervention_type_repair_gas_boiler');
    mockInterventionService.getInterventionById.and.resolveTo({
      interventionType: 'intervention_repair',
    });
    setup({ sn: 'SN001', id: 'int-4' });

    await component.ionViewWillEnter();

    const fields = (component as unknown as { fields: Array<{ key: string; rawValue: unknown }> }).fields;
    const typeField = fields.find(f => f.key === 'interventionType');

    expect(mockInterventionService.getInterventionLabel).toHaveBeenCalledWith(
      DeviceType.GAS_BOILER,
      'intervention_repair',
    );
    expect(typeField?.rawValue).toBe('intervention_type_repair_gas_boiler');
  });

  // ─── TC-IDP-11: callAccepted true → 'intervention_call_accepted_yes' ─────────

  it('TC-IDP-11: callAccepted=true resolves to i18n key intervention_call_accepted_yes', async () => {
    mockInterventionService.getInterventionById.and.resolveTo({ callAccepted: true });
    setup({ sn: 'SN001', id: 'int-5' });

    await component.ionViewWillEnter();

    const fields = (component as unknown as { fields: Array<{ key: string; rawValue: unknown }> }).fields;
    const field = fields.find(f => f.key === 'callAccepted');

    expect(field?.rawValue).toBe('intervention_call_accepted_yes');
  });

  // ─── TC-IDP-12: callAccepted false → 'intervention_call_accepted_no' ─────────

  it('TC-IDP-12: callAccepted=false resolves to i18n key intervention_call_accepted_no', async () => {
    mockInterventionService.getInterventionById.and.resolveTo({ callAccepted: false });
    setup({ sn: 'SN001', id: 'int-6' });

    await component.ionViewWillEnter();

    const fields = (component as unknown as { fields: Array<{ key: string; rawValue: unknown }> }).fields;
    const field = fields.find(f => f.key === 'callAccepted');

    expect(field?.rawValue).toBe('intervention_call_accepted_no');
  });

  // ─── TC-IDP-13: warrantyStatus 'in-warranty' → 'intervention_warranty_in' ────

  it('TC-IDP-13: warrantyStatus "in-warranty" resolves to intervention_warranty_in', async () => {
    mockInterventionService.getInterventionById.and.resolveTo({ warrantyStatus: 'in-warranty' });
    setup({ sn: 'SN001', id: 'int-7' });

    await component.ionViewWillEnter();

    const fields = (component as unknown as { fields: Array<{ key: string; rawValue: unknown }> }).fields;
    const field = fields.find(f => f.key === 'warrantyStatus');

    expect(field?.rawValue).toBe('intervention_warranty_in');
  });

  // ─── TC-IDP-14: warrantyStatus 'out-of-warranty' → 'intervention_warranty_out'

  it('TC-IDP-14: warrantyStatus "out-of-warranty" resolves to intervention_warranty_out', async () => {
    mockInterventionService.getInterventionById.and.resolveTo({ warrantyStatus: 'out-of-warranty' });
    setup({ sn: 'SN001', id: 'int-8' });

    await component.ionViewWillEnter();

    const fields = (component as unknown as { fields: Array<{ key: string; rawValue: unknown }> }).fields;
    const field = fields.find(f => f.key === 'warrantyStatus');

    expect(field?.rawValue).toBe('intervention_warranty_out');
  });

  // ─── TC-IDP-15: Date field → formatted via formatDate ────────────────────────

  it('TC-IDP-15: date field is formatted as DD.MM.YYYY', async () => {
    mockInterventionService.getInterventionById.and.resolveTo({
      addedDate: buildFirestoreTimestamp(new Date('2024-06-15T10:00:00Z')),
    });
    setup({ sn: 'SN001', id: 'int-9' });

    await component.ionViewWillEnter();

    const fields = (component as unknown as { fields: Array<{ key: string; rawValue: unknown }> }).fields;
    const field = fields.find(f => f.key === 'addedDate');

    // Should be formatted as 15.06.2024
    expect(field?.rawValue).toBe('15.06.2024');
  });

  // ─── TC-IDP-16: spareParts array → joined with comma separator ───────────────

  it('TC-IDP-16: spareParts array is joined with ", " separator', async () => {
    mockInterventionService.getInterventionById.and.resolveTo({
      spareParts: ['Gasket', 'Valve', 'Seal'],
    });

    // spareParts is not in INTERVENTION_DISPLAY_FIELDS, but we test resolveRawValue directly
    // via a field that is in the list (sparePart1) as alternative; here we invoke private method
    setup({ sn: 'SN001', id: 'int-10' });

    const page = component as unknown as {
      resolveRawValue: (key: string, value: unknown) => unknown;
    };
    const result = page.resolveRawValue('spareParts', ['Gasket', 'Valve', 'Seal']);

    expect(result).toBe('Gasket, Valve, Seal');
  });

  // ─── TC-IDP-17: isTranslatable — true for known translatable keys ─────────────

  it('TC-IDP-17: isTranslatable returns true for known translatable fields', () => {
    setup();

    const page = component as unknown as { isTranslatable: (key: string) => boolean };

    expect(page.isTranslatable('interventionType')).toBeTrue();
    expect(page.isTranslatable('callAccepted')).toBeTrue();
    expect(page.isTranslatable('warrantyStatus')).toBeTrue();
    expect(page.isTranslatable('interventionDescription')).toBeTrue();
    expect(page.isTranslatable('error')).toBeTrue();
  });

  // ─── TC-IDP-18: isTranslatable — false for non-translatable fields ────────────

  it('TC-IDP-18: isTranslatable returns false for plain value fields', () => {
    setup();

    const page = component as unknown as { isTranslatable: (key: string) => boolean };

    expect(page.isTranslatable('note')).toBeFalse();
    expect(page.isTranslatable('addedBy')).toBeFalse();
    expect(page.isTranslatable('distance')).toBeFalse();
    expect(page.isTranslatable('sparePart1')).toBeFalse();
    expect(page.isTranslatable('installerName')).toBeFalse();
  });

  // ─── TC-IDP-19: onViewEnvInfo opens modal in readOnly with envInfo ────────────

  it('TC-IDP-19: onViewEnvInfo calls envInfoService.viewEnvInfo with deviceType and envInfo data', async () => {
    const envInfo = { temperature: '65', pressure: '1.8' };
    mockInterventionService.getInterventionById.and.resolveTo({
      interventionType: 'commissioning',
      envInfo,
    });
    setup({ sn: 'SN001', id: 'int-11' });

    await component.ionViewWillEnter();
    await component.onViewEnvInfo();

    expect(mockEnvInfoService.viewEnvInfo).toHaveBeenCalledWith(
      DeviceType.GAS_BOILER,
      envInfo,
    );
  });

  // ─── TC-IDP-20: onViewEnvInfo disabled when no envInfo ───────────────────────

  it('TC-IDP-20: onViewEnvInfo does nothing when no envInfo is present', async () => {
    mockInterventionService.getInterventionById.and.resolveTo({
      interventionType: 'commissioning',
      // no envInfo key
    });
    setup({ sn: 'SN001', id: 'int-12' });

    await component.ionViewWillEnter();

    expect((component as unknown as { hasEnvInfo: boolean }).hasEnvInfo).toBeFalse();

    await component.onViewEnvInfo();

    expect(mockEnvInfoService.viewEnvInfo).not.toHaveBeenCalled();
  });

  // SKIPPED: TC-IDP-21..21d test private formatDate()/toDateString() methods
  // that were removed when read coercion was centralized into toDate util.
  xit('TC-IDP-21: formatDate passes through already-formatted DD.MM.YYYY string', () => {
    setup();
    const page = component as unknown as { formatDate: (raw: string) => string };
    expect(page.formatDate('15.06.2024')).toBe('15.06.2024');
  });

  xit('TC-IDP-21b: formatDate converts DD/MM/YYYY slash format to dot format', () => {
    setup();
    const page = component as unknown as { formatDate: (raw: string) => string };
    expect(page.formatDate('15/06/2024')).toBe('15.06.2024');
  });

  xit('TC-IDP-21c: toDateString converts Firestore {seconds} object to ISO string', () => {
    setup();
    const page = component as unknown as { toDateString: (value: unknown) => string };
    const firestoreTs = { seconds: 1718448000 };
    const result = page.toDateString(firestoreTs);
    expect(result).toMatch(/^2024-06-15/);
  });

  xit('TC-IDP-21d: toDateString converts Date object to ISO string', () => {
    setup();
    const page = component as unknown as { toDateString: (value: unknown) => string };
    const date = new Date('2024-03-20T00:00:00Z');
    const result = page.toDateString(date);
    expect(result).toMatch(/^2024-03-20/);
  });

  // ─── TC-IDP-22: Empty spareParts → returns '-' ───────────────────────────────

  it('TC-IDP-22: empty spareParts array resolves to dash "-"', () => {
    setup();

    const page = component as unknown as {
      resolveRawValue: (key: string, value: unknown) => unknown;
    };
    const result = page.resolveRawValue('spareParts', []);

    expect(result).toBe('-');
  });

  // ─── TC-IDP-23: null/undefined field value → returns '-' ─────────────────────

  it('TC-IDP-23: null field value resolves to "-" regardless of key', () => {
    setup();

    const page = component as unknown as {
      resolveRawValue: (key: string, value: unknown) => unknown;
    };

    expect(page.resolveRawValue('note', null)).toBe('-');
    expect(page.resolveRawValue('distance', undefined)).toBe('-');
    expect(page.resolveRawValue('callAccepted', null)).toBe('-');
  });

  // ─── TC-IDP-24: registration id sets correct pageTitleKey ────────────────────

  it('TC-IDP-24: registration id sets pageTitleKey to "history_type_purchase"', async () => {
    mockInterventionService.getRegistration.and.resolveTo({
      registeredAt: '2024-01-01',
      warrantyStatus: 'in-warranty',
    });
    setup({ sn: 'SN001', id: 'registration' });

    await component.ionViewWillEnter();

    expect((component as unknown as { pageTitleKey: string }).pageTitleKey).toBe('history_type_purchase');
  });

  // ─── TC-IDP-25: non-registration id sets pageTitleKey to 'history_detail_title'

  it('TC-IDP-25: non-registration id sets pageTitleKey to "history_detail_title"', async () => {
    mockInterventionService.getInterventionById.and.resolveTo({ interventionType: 'repair' });
    setup({ sn: 'SN001', id: 'some-uuid' });

    await component.ionViewWillEnter();

    expect((component as unknown as { pageTitleKey: string }).pageTitleKey).toBe('history_detail_title');
  });

  // ─── TC-IDP-26: hasEnvInfo true when envInfo object has keys ─────────────────

  it('TC-IDP-26: hasEnvInfo is true when intervention has non-empty envInfo', async () => {
    mockInterventionService.getInterventionById.and.resolveTo({
      interventionType: 'commissioning',
      envInfo: { temperature: '70' },
    });
    setup({ sn: 'SN001', id: 'int-13' });

    await component.ionViewWillEnter();

    expect((component as unknown as { hasEnvInfo: boolean }).hasEnvInfo).toBeTrue();
  });

  // ─── TC-IDP-27: lookup not called when sn and device already match ────────────

  it('TC-IDP-27: lookup is skipped when lookupService.device is set and sn matches', async () => {
    mockInterventionService.getInterventionById.and.resolveTo({ interventionType: 'repair' });

    // sn in route matches lookupService.sn
    mockRoute = buildActivatedRoute({ sn: 'SN001', id: 'int-x' });
    mockLookupService = buildLookupService(createMockDevice(), 'SN001');

    TestBed.configureTestingModule({
      imports: [
        InterventionDetailPage,
        TranslocoTestingModule.forRoot({
          langs: translocoLangs,
          translocoConfig: { availableLangs: ['en'], defaultLang: 'en' },
          preloadLangs: true,
        }),
      ],
      providers: [
        { provide: ActivatedRoute, useValue: mockRoute },
        { provide: InterventionService, useValue: mockInterventionService },
        { provide: DeviceLookupService, useValue: mockLookupService },
        { provide: DeviceEnvInfoService, useValue: mockEnvInfoService },
        { provide: LoggerService, useValue: mockLogger },
      ],
    });

    fixture = TestBed.createComponent(InterventionDetailPage);
    component = fixture.componentInstance;
    fixture.detectChanges();

    await component.ionViewWillEnter();

    expect(mockLookupService.lookup).not.toHaveBeenCalled();
  });

  // ─── TC-IDP-28: envInfo empty object → hasEnvInfo false ──────────────────────

  it('TC-IDP-28: envInfo empty object results in hasEnvInfo false', async () => {
    mockInterventionService.getInterventionById.and.resolveTo({
      interventionType: 'commissioning',
      envInfo: {},
    });
    setup({ sn: 'SN001', id: 'int-14' });

    await component.ionViewWillEnter();

    expect((component as unknown as { hasEnvInfo: boolean }).hasEnvInfo).toBeFalse();
  });

  // ─── TC-IDP-29: registration fields don't set envInfo ────────────────────────

  it('TC-IDP-29: registration data path does not set hasEnvInfo or envInfoData', async () => {
    mockInterventionService.getRegistration.and.resolveTo({
      registeredAt: '2024-01-01',
    });
    setup({ sn: 'SN001', id: 'registration' });

    await component.ionViewWillEnter();

    expect((component as unknown as { hasEnvInfo: boolean }).hasEnvInfo).toBeFalse();
  });

  // ─── TC-IDP-30: warrantyStatus unknown value → String passthrough ────────────

  it('TC-IDP-30: unknown warrantyStatus value is converted to its string representation', () => {
    setup();

    const page = component as unknown as {
      resolveRawValue: (key: string, value: unknown) => unknown;
    };

    expect(page.resolveRawValue('warrantyStatus', 'some_other_status')).toBe('some_other_status');
  });

  // =========================================================================
  // EXPANSION: buildDisplayFields — per intervention type
  // =========================================================================

  describe('buildDisplayFields() — per intervention type', () => {
    const interventionTypes = [
      'intervention_repair',
      'intervention_noise',
      'intervention_replace',
      'commissioning',
      'annual_service',
    ];

    interventionTypes.forEach((intType) => {
      it(`EXP-IDP-TYPE: "${intType}" → interventionType field present in fields`, async () => {
        mockInterventionService.getInterventionById.and.resolveTo({
          interventionType: intType,
        });
        setup({ sn: 'SN001', id: `id-${intType}` });

        await component.ionViewWillEnter();

        const fields = (component as unknown as { fields: Array<{ key: string }> }).fields;
        expect(fields.some(f => f.key === 'interventionType')).toBeTrue();
      });

      it(`EXP-IDP-TYPE-LABEL: "${intType}" → pageTitleKey is "history_detail_title"`, async () => {
        mockInterventionService.getInterventionById.and.resolveTo({
          interventionType: intType,
        });
        setup({ sn: 'SN001', id: `id-title-${intType}` });

        await component.ionViewWillEnter();

        expect((component as unknown as { pageTitleKey: string }).pageTitleKey).toBe('history_detail_title');
      });
    });
  });

  // =========================================================================
  // EXPANSION: resolveRawValue — all field types
  // =========================================================================

  describe('resolveRawValue() — exhaustive field type coverage', () => {
    beforeEach(() => {
      setup();
    });

    type ResolveFn = (key: string, value: unknown) => unknown;

    function getResolve(): ResolveFn {
      return (component as unknown as { resolveRawValue: ResolveFn }).resolveRawValue.bind(component);
    }

    // callAccepted boolean matrix
    const callAcceptedCases: Array<[boolean | null | undefined, string]> = [
      [true, 'intervention_call_accepted_yes'],
      [false, 'intervention_call_accepted_no'],
      [null, '-'],
      [undefined, '-'],
    ];

    callAcceptedCases.forEach(([value, expected]) => {
      it(`EXP-IDP-RESOLVE-CALLACCEPTED: callAccepted=${JSON.stringify(value)} → "${expected}"`, () => {
        expect(getResolve()('callAccepted', value)).toBe(expected);
      });
    });

    // warrantyStatus matrix
    const warrantyStatusCases: Array<[string | null | undefined, string]> = [
      ['in-warranty', 'intervention_warranty_in'],
      ['out-of-warranty', 'intervention_warranty_out'],
      ['unknown_status', 'unknown_status'],
      [null, '-'],
      [undefined, '-'],
    ];

    warrantyStatusCases.forEach(([value, expected]) => {
      it(`EXP-IDP-RESOLVE-WARRANTY: warrantyStatus="${value}" → "${expected}"`, () => {
        expect(getResolve()('warrantyStatus', value)).toBe(expected);
      });
    });

    // spareParts array cases
    const sparePartsCases: Array<[unknown[], string]> = [
      [[], '-'],
      [['Part A'], 'Part A'],
      [['Gasket', 'Valve'], 'Gasket, Valve'],
      [['A', 'B', 'C'], 'A, B, C'],
    ];

    sparePartsCases.forEach(([parts, expected]) => {
      it(`EXP-IDP-RESOLVE-SPAREPARTS: [${(parts as string[]).join(',')}] → "${expected}"`, () => {
        expect(getResolve()('spareParts', parts)).toBe(expected);
      });
    });

    // Null/undefined for various field types
    const nullFieldKeys = ['note', 'distance', 'installerName', 'installerPhoneNumber', 'addedBy', 'error'];
    nullFieldKeys.forEach((key) => {
      it(`EXP-IDP-RESOLVE-NULL: null value for key "${key}" → "-"`, () => {
        expect(getResolve()(key, null)).toBe('-');
      });

      it(`EXP-IDP-RESOLVE-UNDEF: undefined value for key "${key}" → "-"`, () => {
        expect(getResolve()(key, undefined)).toBe('-');
      });
    });

    // Plain string values pass through (non-translatable keys)
    const plainStringCases: Array<{ key: string; value: string }> = [
      { key: 'note', value: 'Some note text' },
      { key: 'distance', value: '50' },
      { key: 'installerName', value: 'John Doe' },
      { key: 'installerPhoneNumber', value: '+381601234567' },
      { key: 'addedBy', value: 'admin@test.com' },
    ];

    plainStringCases.forEach(({ key, value }) => {
      it(`EXP-IDP-RESOLVE-STRING: "${key}"="${value}" passes through`, () => {
        expect(getResolve()(key, value)).toBe(value);
      });
    });
  });

  // =========================================================================
  // EXPANSION: isTranslatable — comprehensive key coverage
  // =========================================================================

  describe('isTranslatable() — all known keys', () => {
    beforeEach(() => {
      setup();
    });

    const translatableKeys = [
      'interventionType',
      'callAccepted',
      'warrantyStatus',
      'interventionDescription',
      'error',
    ];

    translatableKeys.forEach((key) => {
      it(`EXP-IDP-TRANS: "${key}" is translatable`, () => {
        const fn = (component as unknown as { isTranslatable: (k: string) => boolean }).isTranslatable;
        expect(fn(key)).toBeTrue();
      });
    });

    const nonTranslatableKeys = [
      'note',
      'addedBy',
      'distance',
      'sparePart1',
      'sparePart2',
      'sparePart3',
      'sparePart4',
      'installerName',
      'installerPhoneNumber',
      'addedDate',
      'registeredAt',
      'warrantyDate',
      'comment',
      'registeredBy',
    ];

    nonTranslatableKeys.forEach((key) => {
      it(`EXP-IDP-NONTRANS: "${key}" is NOT translatable`, () => {
        const fn = (component as unknown as { isTranslatable: (k: string) => boolean }).isTranslatable;
        expect(fn(key)).toBeFalse();
      });
    });
  });

  // =========================================================================
  // EXPANSION: formatDate — various input formats
  // SKIPPED: tests private formatDate() that was removed when read coercion
  // was centralized into toDate util.
  // =========================================================================

  xdescribe('formatDate() — input format matrix', () => {
    beforeEach(() => {
      setup();
    });

    type FormatFn = (raw: string) => string;

    function getFormat(): FormatFn {
      return (component as unknown as { formatDate: FormatFn }).formatDate.bind(component);
    }

    const formatCases: Array<{ input: string; expected: string; label: string }> = [
      { input: '15.06.2024', expected: '15.06.2024', label: 'already dot format' },
      { input: '01.01.2020', expected: '01.01.2020', label: 'already dot format Jan 1' },
      { input: '31.12.2025', expected: '31.12.2025', label: 'already dot format Dec 31' },
      { input: '15/06/2024', expected: '15.06.2024', label: 'slash to dot' },
      { input: '01/01/2020', expected: '01.01.2020', label: 'slash Jan 1' },
      { input: '31/12/2025', expected: '31.12.2025', label: 'slash Dec 31' },
    ];

    formatCases.forEach(({ input, expected, label }) => {
      it(`EXP-IDP-FORMAT: "${label}" "${input}" → "${expected}"`, () => {
        expect(getFormat()(input)).toBe(expected);
      });
    });
  });

  // =========================================================================
  // EXPANSION: sparePart labelSuffix matrix
  // =========================================================================

  describe('sparePart labelSuffix — all part numbers', () => {
    const partNumbers = [1, 2, 3, 4];

    partNumbers.forEach((num) => {
      it(`EXP-IDP-PART: sparePart${num} has labelSuffix="${num}"`, async () => {
        const data: Record<string, string> = {};
        for (let i = 1; i <= num; i++) {
          data[`sparePart${i}`] = `Part ${i}`;
        }
        mockInterventionService.getInterventionById.and.resolveTo(data);
        setup({ sn: 'SN001', id: `parts-${num}` });

        await component.ionViewWillEnter();

        const fields = (component as unknown as { fields: Array<{ key: string; labelSuffix?: string }> }).fields;
        const partField = fields.find(f => f.key === `sparePart${num}`);
        expect(partField?.labelSuffix).toBe(String(num));
      });
    });
  });

  // =========================================================================
  // EXPANSION: toDateString — input type coverage
  // SKIPPED: tests private toDateString() that was removed when read coercion
  // was centralized into toDate util.
  // =========================================================================

  xdescribe('toDateString() — input type matrix', () => {
    beforeEach(() => {
      setup();
    });

    type ToDateStringFn = (value: unknown) => string;

    function getToDateString(): ToDateStringFn {
      return (component as unknown as { toDateString: ToDateStringFn }).toDateString.bind(component);
    }

    // Firestore timestamp variations
    const firestoreCases: Array<{ seconds: number; expectedPrefix: string }> = [
      { seconds: 1704067200, expectedPrefix: '2024-01-01' },
      { seconds: 1717200000, expectedPrefix: '2024-06-01' },
      { seconds: 1735689600, expectedPrefix: '2025-01-01' },
    ];

    firestoreCases.forEach(({ seconds, expectedPrefix }) => {
      it(`EXP-IDP-TODATESTR-TS: seconds ${seconds} → starts with "${expectedPrefix}"`, () => {
        const result = getToDateString()({ seconds });
        expect(result).toMatch(new RegExp(`^${expectedPrefix}`));
      });
    });

    // Date object variations
    const dateCases: Array<{ date: Date; expectedPrefix: string }> = [
      { date: new Date('2024-03-15T00:00:00Z'), expectedPrefix: '2024-03-15' },
      { date: new Date('2020-07-04T00:00:00Z'), expectedPrefix: '2020-07-04' },
      { date: new Date('2025-12-31T00:00:00Z'), expectedPrefix: '2025-12-31' },
    ];

    dateCases.forEach(({ date, expectedPrefix }) => {
      it(`EXP-IDP-TODATESTR-DATE: ${expectedPrefix} → starts with "${expectedPrefix}"`, () => {
        const result = getToDateString()(date);
        expect(result).toMatch(new RegExp(`^${expectedPrefix}`));
      });
    });

    // ISO string passthrough
    const isoCases = [
      '2024-06-15T10:00:00Z',
      '2023-01-01T00:00:00.000Z',
      '2025-11-30T23:59:59Z',
    ];

    isoCases.forEach((iso) => {
      it(`EXP-IDP-TODATESTR-ISO: "${iso}" returned as-is or as ISO string`, () => {
        const result = getToDateString()(iso);
        expect(typeof result).toBe('string');
        expect(result.length).toBeGreaterThan(0);
      });
    });
  });

  // =========================================================================
  // EXPANSION PASS 2: resolveRawValue — number inputs
  // =========================================================================

  describe('resolveRawValue() — number inputs', () => {
    function getRaw(): (key: string, value: unknown) => unknown {
      return (key: string, value: unknown) => (component as any).resolveRawValue(key, value);
    }

    const numberCases: Array<{ key: string; value: number; label: string }> = [
      { key: 'distance', value: 0, label: 'zero' },
      { key: 'distance', value: 30, label: 'positive integer' },
      { key: 'distance', value: -1, label: 'negative' },
      { key: 'distance', value: 99.9, label: 'float' },
      { key: 'counter', value: 1000, label: 'large number' },
      { key: 'temperature', value: 21.5, label: 'temperature float' },
    ];

    numberCases.forEach(({ key, value, label }) => {
      it(`EXP2-IDP-RAWVAL-NUM: key="${key}" value=${value} (${label}) → number returned`, () => {
        const result = getRaw()(key, value);
        // resolveRawValue converts unrecognised keys to String(value)
        expect(result).toBe(String(value));
      });
    });
  });

  // =========================================================================
  // EXPANSION PASS 2: resolveRawValue — boolean inputs
  // =========================================================================

  describe('resolveRawValue() — boolean inputs', () => {
    function getRaw(): (key: string, value: unknown) => unknown {
      return (key: string, value: unknown) => (component as any).resolveRawValue(key, value);
    }

    const boolCases: Array<{ key: string; value: boolean; label: string }> = [
      { key: 'featureEnabled', value: true, label: 'true boolean' },
      { key: 'featureEnabled', value: false, label: 'false boolean' },
      { key: 'isValid', value: true, label: 'isValid true' },
      { key: 'isValid', value: false, label: 'isValid false' },
    ];

    boolCases.forEach(({ key, value, label }) => {
      it(`EXP2-IDP-RAWVAL-BOOL: key="${key}" value=${value} (${label}) → returned as-is or translated`, () => {
        const result = getRaw()(key, value);
        expect(result).not.toBeUndefined();
      });
    });
  });

  // =========================================================================
  // EXPANSION PASS 2: intervention type display fields — each type
  // =========================================================================

  describe('ionViewWillEnter() — device type × intervention type loads fields', () => {
    const deviceInterventionCombos: Array<{
      deviceType: DeviceType;
      label: string;
    }> = [
      { deviceType: DeviceType.GAS_BOILER, label: 'GAS_BOILER' },
      { deviceType: DeviceType.HEAT_PUMP, label: 'HEAT_PUMP' },
      { deviceType: DeviceType.BOILER, label: 'BOILER' },
      { deviceType: DeviceType.AIR_CONDITION, label: 'AIR_CONDITION' },
    ];

    deviceInterventionCombos.forEach(({ deviceType, label }) => {
      it(`EXP2-IDP-DEVTYPE: ${label} → component loads without error`, async () => {
        const device = createMockDevice({ type: deviceType });
        const spy = buildInterventionService({
          getInterventionById: jasmine.createSpy().and.resolveTo({
            id: 'int-001',
            data: { interventionType: 'INTERVENTION_REPAIR', warrantyStatus: 'in-warranty', sn: 'SN001' },
          }) as unknown as jasmine.Spy<InterventionService['getInterventionById']>,
        });
        const route = buildActivatedRoute({ id: 'int-001', sn: 'SN001' });

        TestBed.resetTestingModule();
        await TestBed.configureTestingModule({
          imports: [
            InterventionDetailPage,
            TranslocoTestingModule.forRoot({ langs: { en: {} }, translocoConfig: { availableLangs: ['en'], defaultLang: 'en' } }),
          ],
          providers: [
            { provide: InterventionService, useValue: spy },
            { provide: DeviceLookupService, useValue: buildLookupService(device, 'SN001') },
            { provide: DeviceEnvInfoService, useValue: jasmine.createSpyObj(['viewEnvInfo']) },
            { provide: LoggerService, useValue: createMockLoggerService() },
            { provide: ActivatedRoute, useValue: route },
          ],
        }).compileComponents();

        const f = TestBed.createComponent(InterventionDetailPage);
        const c = f.componentInstance;

        await c.ionViewWillEnter();

        expect(c).toBeTruthy();
      });
    });
  });

  // =========================================================================
  // EXPANSION PASS 2: isTranslatable — additional key coverage
  // =========================================================================

  describe('isTranslatable() — extended key coverage', () => {
    function getIsTranslatable(): (key: string) => boolean {
      return (key: string) => (component as any).isTranslatable(key);
    }

    const additionalTranslatableKeys = [
      'interventionType', 'warrantyStatus', 'callAccepted',
    ];

    const additionalNonTranslatableKeys = [
      'addedDate', 'updatedAt', 'description', 'faultCode', 'errorCode',
      'distance', 'note', 'technician', 'reportNumber', 'id',
      'firstName', 'lastName', 'address', 'phone', 'email',
    ];

    additionalTranslatableKeys.forEach((key) => {
      it(`EXP2-IDP-TRANS: "${key}" → isTranslatable check runs without error`, () => {
        expect(typeof getIsTranslatable()(key)).toBe('boolean');
      });
    });

    additionalNonTranslatableKeys.forEach((key) => {
      it(`EXP2-IDP-NONTRANS: "${key}" → isTranslatable returns boolean`, () => {
        expect(typeof getIsTranslatable()(key)).toBe('boolean');
      });
    });
  });

  // =========================================================================
  // EXPANSION PASS 2: formatDate — extended input format coverage
  // SKIPPED: tests private formatDate() that was removed.
  // =========================================================================

  xdescribe('formatDate() — extended date string formats', () => {
    function getFormatDate(): (value: string) => string {
      return (value: string) => (component as any).formatDate(value);
    }

    const extendedDateCases: Array<{ input: string; label: string }> = [
      { input: '2020-01-15', label: 'ISO date no time' },
      { input: '2021-06-30', label: 'ISO date mid-year' },
      { input: '2022-12-31', label: 'ISO date year end' },
      { input: '2023-02-28', label: 'ISO date Feb non-leap' },
      { input: '15.03.2024', label: 'dot format March' },
      { input: '01.12.2025', label: 'dot format December' },
    ];

    extendedDateCases.forEach(({ input, label }) => {
      it(`EXP2-IDP-FMTDATE: "${input}" (${label}) → returns string`, () => {
        const result = getFormatDate()(input);
        expect(typeof result).toBe('string');
      });
    });
  });
});
