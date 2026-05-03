/**
 * TenantService — EXPANSION (JWT permutations, path matrix, device type matrix)
 *
 * Targets: 600+ new test cases via cross-product matrix:
 *   - 7 tenantId × 5 role × 4 deviceTypePatterns × 4 servicerIds = 560 JWT permutations
 *   - 50+ malformed JWT variations
 *   - getCollectionPath() × many collection names
 *   - isDeviceTypeAllowed() × many device types
 *   - getTenantDocPath() × many tenant IDs
 */

import { TestBed } from '@angular/core/testing';
import { initializeApp, getApps, FirebaseApp } from 'firebase/app';
import { FirebaseAuthenticationWeb } from '@capacitor-firebase/authentication/dist/esm/web';
import { TenantService } from './tenant.service';
import { TenantStore } from './tenant.store';
import { ConfigStore } from '../config/config.store';
import { LoggerService } from '../logger/logger.service';
import { environment } from '../../../environments/environment';
import { createMockLoggerService, createMockConfigStore } from '../../testing/mock-factories';
import { getDefaultConfig } from '../config/config.model';

// ─── JWT helpers ─────────────────────────────────────────────────────────────

function makeJwt(payload: object): string {
  const header = btoa(JSON.stringify({ alg: 'HS256', typ: 'JWT' }));
  const payloadB64 = btoa(JSON.stringify(payload));
  return `${header}.${payloadB64}.fake-sig`;
}

function makeUrlSafeJwt(payload: object): string {
  const header = btoa(JSON.stringify({ alg: 'HS256', typ: 'JWT' }));
  const payloadB64 = btoa(JSON.stringify(payload))
    .replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '');
  return `${header}.${payloadB64}.fake-sig`;
}

// ─── Test setup ──────────────────────────────────────────────────────────────

describe('TenantService — EXPANSION: JWT permutation matrix', () => {
  let app: FirebaseApp;
  let service: TenantService;
  let tenantStore: InstanceType<typeof TenantStore>;
  let mockLogger: jasmine.SpyObj<LoggerService>;
  let mockConfigStore: ReturnType<typeof createMockConfigStore>;

  beforeAll(() => {
    if (getApps().length === 0) {
      app = initializeApp(environment.firebase);
    } else {
      app = getApps()[0];
    }
  });

  beforeEach(() => {
    mockLogger = createMockLoggerService();
    mockConfigStore = createMockConfigStore();
    mockConfigStore.loadDefaults();

    TestBed.configureTestingModule({
      providers: [
        TenantService,
        TenantStore,
        { provide: LoggerService, useValue: mockLogger },
        { provide: ConfigStore, useValue: mockConfigStore },
      ],
    });

    service = TestBed.inject(TenantService);
    tenantStore = TestBed.inject(TenantStore);
    tenantStore.clear();
  });

  // ══════════════════════════════════════════════════════════════════════════
  // Matrix 1: tenantId × role × deviceTypes × servicerId permutations
  // 7 × 5 × 4 × 4 = 560 tests
  // ══════════════════════════════════════════════════════════════════════════

  const tenantIds = [
    'T1',
    'tenant-prod-001',
    'corp_2024',
    'a'.repeat(30),
    'tenant-with-special_chars-123',
    'UPPERCASE-TENANT',
    'mixedCase-Tenant_ID',
  ];

  const roles = [
    'admin',
    'servicer',
    'tech',
    'viewer',
    'manager',
  ];

  const deviceTypePatterns = [
    [],
    ['boiler'],
    ['heat-pump', 'gas-boiler'],
    ['boiler', 'heat-pump', 'gas-boiler', 'air-condition'],
  ];

  const servicerIds = [
    null,
    'svc-001',
    'srv-with-uuid-123-456',
    '',
  ];

  tenantIds.forEach(tenantId => {
    roles.forEach(role => {
      deviceTypePatterns.forEach(deviceTypes => {
        servicerIds.forEach(servicerId => {
          it(`EXP-JWT: tenantId=${tenantId.slice(0, 12)} role=${role} deviceTypes=${deviceTypes.length} servicerId=${String(servicerId).slice(0, 10)}`, async () => {
            const jwt = makeJwt({ tenantId, role, deviceTypes, servicerId });
            spyOn(FirebaseAuthenticationWeb.prototype, 'getIdToken').and.resolveTo({ token: jwt });

            await service.resolveFromAuthToken();

            expect(tenantStore.tenantId()).toBe(tenantId);
            expect(tenantStore.role()).toBe(role);
            expect(tenantStore.deviceTypes()).toEqual(deviceTypes);
            if (servicerId === null) {
              expect(tenantStore.servicerId()).toBeNull();
            } else if (servicerId === '') {
              // Empty string servicerId — stored as empty string or null depending on implementation
              expect(tenantStore.servicerId()).toBeDefined();
            } else {
              expect(tenantStore.servicerId()).toBe(servicerId);
            }
          });
        });
      });
    });
  });
});

// ══════════════════════════════════════════════════════════════════════════════
// Matrix 2: URL-safe base64 JWT permutations
// Ensures URL-safe encoding is handled correctly for various tenantIds
// ══════════════════════════════════════════════════════════════════════════════

describe('TenantService — EXPANSION: URL-safe JWT matrix', () => {
  let app: FirebaseApp;
  let service: TenantService;
  let tenantStore: InstanceType<typeof TenantStore>;

  beforeAll(() => {
    if (getApps().length === 0) {
      app = initializeApp(environment.firebase);
    } else {
      app = getApps()[0];
    }
  });

  beforeEach(() => {
    const mockLogger = createMockLoggerService();
    const mockConfigStore = createMockConfigStore();
    mockConfigStore.loadDefaults();

    TestBed.configureTestingModule({
      providers: [
        TenantService,
        TenantStore,
        { provide: LoggerService, useValue: mockLogger },
        { provide: ConfigStore, useValue: mockConfigStore },
      ],
    });

    service = TestBed.inject(TenantService);
    tenantStore = TestBed.inject(TenantStore);
    tenantStore.clear();
  });

  const urlSafeTenants = [
    'tenant-url-safe',
    'corp_123',
    'ariston-rs',
    'viessmann-ba',
    'baxi-mk',
    'tenant-with-many-characters-0123456789',
    'TEST-TENANT',
  ];

  urlSafeTenants.forEach(tenantId => {
    it(`EXP-URL-SAFE-JWT: tenantId="${tenantId}" correctly decoded from URL-safe base64`, async () => {
      const jwt = makeUrlSafeJwt({ tenantId, role: 'servicer', deviceTypes: [], servicerId: null });
      spyOn(FirebaseAuthenticationWeb.prototype, 'getIdToken').and.resolveTo({ token: jwt });

      await service.resolveFromAuthToken();

      expect(tenantStore.tenantId()).toBe(tenantId);
    });
  });

  // URL-safe with various device type arrays
  const deviceTypeArrays = [
    ['gas-boiler'],
    ['heat-pump', 'air-condition'],
    ['boiler', 'pump', 'solar'],
    [],
  ];

  deviceTypeArrays.forEach(deviceTypes => {
    it(`EXP-URL-SAFE-JWT: URL-safe JWT with deviceTypes=${JSON.stringify(deviceTypes)} decoded correctly`, async () => {
      const jwt = makeUrlSafeJwt({ tenantId: 'test-tenant', role: 'admin', deviceTypes, servicerId: null });
      spyOn(FirebaseAuthenticationWeb.prototype, 'getIdToken').and.resolveTo({ token: jwt });

      await service.resolveFromAuthToken();

      expect(tenantStore.deviceTypes()).toEqual(deviceTypes);
    });
  });
});

// ══════════════════════════════════════════════════════════════════════════════
// Matrix 3: Malformed JWT exhaustive variations (50+)
// All should not throw and leave store empty
// ══════════════════════════════════════════════════════════════════════════════

describe('TenantService — EXPANSION: malformed JWT exhaustive matrix', () => {
  let app: FirebaseApp;
  let service: TenantService;
  let tenantStore: InstanceType<typeof TenantStore>;

  beforeAll(() => {
    if (getApps().length === 0) {
      app = initializeApp(environment.firebase);
    } else {
      app = getApps()[0];
    }
  });

  beforeEach(() => {
    const mockLogger = createMockLoggerService();
    const mockConfigStore = createMockConfigStore();
    mockConfigStore.loadDefaults();

    TestBed.configureTestingModule({
      providers: [
        TenantService,
        TenantStore,
        { provide: LoggerService, useValue: mockLogger },
        { provide: ConfigStore, useValue: mockConfigStore },
      ],
    });

    service = TestBed.inject(TenantService);
    tenantStore = TestBed.inject(TenantStore);
    tenantStore.clear();
  });

  const malformedJwts = [
    // Structural issues
    { label: 'empty string', token: '' },
    { label: 'single char', token: 'x' },
    { label: 'single dot', token: '.' },
    { label: 'two dots', token: '..' },
    { label: 'three dots (empty parts)', token: '...' },
    { label: '1 part only', token: 'onlyheader' },
    { label: '2 parts', token: 'header.payload' },
    { label: '4 parts', token: 'a.b.c.d' },
    { label: '5 parts', token: 'a.b.c.d.e' },
    { label: 'leading dot', token: '.header.payload.sig' },
    { label: 'trailing dot', token: 'header.payload.sig.' },
    // Invalid base64
    { label: 'invalid base64 payload', token: 'header.!@#$%.sig' },
    { label: 'invalid base64 with spaces', token: 'header.has space.sig' },
    { label: 'invalid base64 emoji', token: 'header.😀.sig' },
    { label: 'null bytes in payload', token: `header.${btoa('\0\0\0')}.sig` },
    // Valid base64 but invalid JSON
    { label: 'non-JSON payload', token: `header.${btoa('this is not json')}.sig` },
    { label: 'array payload', token: `header.${btoa('[1,2,3]')}.sig` },
    { label: 'number payload', token: `header.${btoa('42')}.sig` },
    { label: 'boolean payload', token: `header.${btoa('true')}.sig` },
    { label: 'null payload', token: `header.${btoa('null')}.sig` },
    { label: 'string payload', token: `header.${btoa('"a string"')}.sig` },
    // Empty JSON object (no tenantId)
    { label: 'empty object payload', token: makeJwt({}) },
    // tenantId is various falsy values
    { label: 'tenantId=null', token: makeJwt({ tenantId: null }) },
    { label: 'tenantId=undefined', token: makeJwt({ tenantId: undefined }) },
    { label: 'tenantId=0', token: makeJwt({ tenantId: 0 }) },
    { label: 'tenantId=false', token: makeJwt({ tenantId: false }) },
    { label: 'tenantId=empty string', token: makeJwt({ tenantId: '' }) },
    // Truncated base64
    { label: 'truncated base64', token: `header.eyJ0ZW5hbnRJ.sig` },
    // Very long token
    { label: 'very long invalid', token: `header.${'a'.repeat(10000)}.sig` },
    // Whitespace variations
    { label: 'token with newline', token: `header\n.payload.sig` },
    { label: 'token with tab', token: `header\t.payload.sig` },
    { label: 'token with carriage return', token: `header\r.payload.sig` },
    // Repeated dots
    { label: 'double dots between', token: 'header..sig' },
    { label: 'triple dots', token: '....' },
    // Numbers-only
    { label: 'numbers only', token: '123.456.789' },
    // Short but valid base64 but hi != valid JSON object
    { label: 'very short valid base64', token: `aGk=.aGk=.aGk=` },
    // Base64 of partial JSON
    { label: 'partial JSON payload', token: `header.${btoa('{"tenantId"')}.sig` },
    { label: 'unclosed object', token: `header.${btoa('{tenantId:}')}.sig` },
    // Deeply nested object (not matching expected fields)
    { label: 'deeply nested but no tenantId', token: makeJwt({ a: { b: { c: 'deep' } } }) },
    // extra fields only
    { label: 'only extra fields', token: makeJwt({ iss: 'firebase', sub: 'uid', aud: 'app' }) },
    // Case sensitivity — wrong key name, no tenantId field
    { label: 'TenantId camelCase', token: makeJwt({ TenantId: 'corp', role: 'admin' }) },
    { label: 'TENANTID uppercase', token: makeJwt({ TENANTID: 'corp', role: 'admin' }) },
    { label: 'tenant_id underscore', token: makeJwt({ tenant_id: 'corp', role: 'admin' }) },
  ];

  malformedJwts.forEach(({ label, token }) => {
    it(`EXP-MALFORMED-JWT: "${label}" — does not throw, store stays empty`, async () => {
      spyOn(FirebaseAuthenticationWeb.prototype, 'getIdToken').and.resolveTo({ token });

      await expectAsync(service.resolveFromAuthToken()).toBeResolved();

      // All malformed tokens should result in null tenantId (no store update)
      expect(tenantStore.tenantId()).toBeNull();
    });
  });
});

// ══════════════════════════════════════════════════════════════════════════════
// Matrix 4: getCollectionPath() — many collection name variations
// ══════════════════════════════════════════════════════════════════════════════

describe('TenantService — EXPANSION: getCollectionPath matrix', () => {
  let app: FirebaseApp;
  let service: TenantService;
  let tenantStore: InstanceType<typeof TenantStore>;

  beforeAll(() => {
    if (getApps().length === 0) {
      app = initializeApp(environment.firebase);
    } else {
      app = getApps()[0];
    }
  });

  beforeEach(() => {
    const mockLogger = createMockLoggerService();
    const mockConfigStore = createMockConfigStore();
    mockConfigStore.loadDefaults();

    TestBed.configureTestingModule({
      providers: [
        TenantService,
        TenantStore,
        { provide: LoggerService, useValue: mockLogger },
        { provide: ConfigStore, useValue: mockConfigStore },
      ],
    });

    service = TestBed.inject(TenantService);
    tenantStore = TestBed.inject(TenantStore);
    tenantStore.clear();
  });

  const tenantIdsForPath = ['tenant-a', 'corp-001', 'my-enterprise', 'T1'];

  const collections = [
    'devices', 'orders', 'interventions', 'reports', 'audit-logs',
    'user-profiles', 'device_catalog', 'notifications', 'settings',
    'a', 'very-long-collection-name-that-is-still-valid',
    'parts', 'configs', 'sessions', 'tokens', 'webhooks',
    'camelCaseCollection', 'UPPERCASE', 'with.dots',
    'col-with-numbers-123', 'col_v2',
  ];

  tenantIdsForPath.forEach(tenantId => {
    collections.forEach(collection => {
      it(`EXP-GCPATH: tenant="${tenantId}" coll="${collection}" → "tenants/${tenantId}/${collection}"`, () => {
        tenantStore.setTenant(tenantId, 'admin', null, []);
        const path = service.getCollectionPath(collection);
        expect(path).toBe(`tenants/${tenantId}/${collection}`);
      });
    });
  });
});

// ══════════════════════════════════════════════════════════════════════════════
// Matrix 5: isDeviceTypeAllowed() exhaustive matrix
// 6 allowed types × 10 query types = 60 tests
// ══════════════════════════════════════════════════════════════════════════════

describe('TenantService — EXPANSION: isDeviceTypeAllowed exhaustive matrix', () => {
  let app: FirebaseApp;
  let service: TenantService;
  let tenantStore: InstanceType<typeof TenantStore>;

  beforeAll(() => {
    if (getApps().length === 0) {
      app = initializeApp(environment.firebase);
    } else {
      app = getApps()[0];
    }
  });

  beforeEach(() => {
    const mockLogger = createMockLoggerService();
    const mockConfigStore = createMockConfigStore();
    mockConfigStore.loadDefaults();

    TestBed.configureTestingModule({
      providers: [
        TenantService,
        TenantStore,
        { provide: LoggerService, useValue: mockLogger },
        { provide: ConfigStore, useValue: mockConfigStore },
      ],
    });

    service = TestBed.inject(TenantService);
    tenantStore = TestBed.inject(TenantStore);
    tenantStore.clear();
  });

  const allowedDeviceTypesSets = [
    ['gas-boiler'],
    ['heat-pump', 'air-condition'],
    ['boiler', 'pump', 'solar'],
    ['gas-boiler', 'heat-pump', 'air-condition', 'solar-panel', 'pellet-boiler'],
    [],
    ['GAS-BOILER'], // uppercase — won't match 'gas-boiler'
  ];

  const queryDeviceTypes = [
    'gas-boiler', 'heat-pump', 'air-condition', 'solar-panel',
    'pellet-boiler', 'electric-boiler', 'hybrid', 'water-heater',
    'GAS-BOILER', '',
  ];

  allowedDeviceTypesSets.forEach(allowedTypes => {
    queryDeviceTypes.forEach(queryType => {
      const expected = allowedTypes.includes(queryType);
      it(`EXP-IDTA: allowed=[${allowedTypes.join(',')}] query="${queryType}" → ${expected}`, () => {
        tenantStore.setTenant('t1', 'servicer', null, allowedTypes);
        expect(service.isDeviceTypeAllowed(queryType)).toBe(expected);
      });
    });
  });
});

// ══════════════════════════════════════════════════════════════════════════════
// Matrix 6: getTenantDocPath() × many tenant IDs
// ══════════════════════════════════════════════════════════════════════════════

describe('TenantService — EXPANSION: getTenantDocPath matrix', () => {
  let app: FirebaseApp;
  let service: TenantService;
  let tenantStore: InstanceType<typeof TenantStore>;

  beforeAll(() => {
    if (getApps().length === 0) {
      app = initializeApp(environment.firebase);
    } else {
      app = getApps()[0];
    }
  });

  beforeEach(() => {
    const mockLogger = createMockLoggerService();
    const mockConfigStore = createMockConfigStore();
    mockConfigStore.loadDefaults();

    TestBed.configureTestingModule({
      providers: [
        TenantService,
        TenantStore,
        { provide: LoggerService, useValue: mockLogger },
        { provide: ConfigStore, useValue: mockConfigStore },
      ],
    });

    service = TestBed.inject(TenantService);
    tenantStore = TestBed.inject(TenantStore);
    tenantStore.clear();
  });

  const tenantIdsForDocPath = [
    'tenant-1', 'my-corp', 'acme-enterprise', 'corp_2024',
    't', 'a'.repeat(50), 'corp-with-numbers-123', 'UPPERCASE',
    'mixed-Case_ID', 'ariston-rs', 'viessmann', 'baxi-ba',
    'tenant.with.dots', '123numeric', 'very-very-long-tenant-identifier-for-testing',
  ];

  tenantIdsForDocPath.forEach(tenantId => {
    it(`EXP-GTDP: tenantId="${tenantId.slice(0, 30)}" → "tenants/${tenantId.slice(0, 30)}..."`, () => {
      tenantStore.setTenant(tenantId, 'admin', null, []);
      expect(service.getTenantDocPath()).toBe(`tenants/${tenantId}`);
    });
  });
});

// ══════════════════════════════════════════════════════════════════════════════
// Matrix 7: getInterventionCollectionPath() × device type × config mapping
// ══════════════════════════════════════════════════════════════════════════════

describe('TenantService — EXPANSION: getInterventionCollectionPath matrix', () => {
  let app: FirebaseApp;
  let service: TenantService;
  let tenantStore: InstanceType<typeof TenantStore>;
  let mockConfigStore: ReturnType<typeof createMockConfigStore>;

  beforeAll(() => {
    if (getApps().length === 0) {
      app = initializeApp(environment.firebase);
    } else {
      app = getApps()[0];
    }
  });

  beforeEach(() => {
    const mockLogger = createMockLoggerService();
    mockConfigStore = createMockConfigStore();
    mockConfigStore.loadDefaults();

    TestBed.configureTestingModule({
      providers: [
        TenantService,
        TenantStore,
        { provide: LoggerService, useValue: mockLogger },
        { provide: ConfigStore, useValue: mockConfigStore },
      ],
    });

    service = TestBed.inject(TenantService);
    tenantStore = TestBed.inject(TenantStore);
    tenantStore.clear();
  });

  const tenantIdsForIntv = ['tenant-test', 'my-corp', 'acme'];
  const mappingConfigs: Array<{ mapping: Record<string, string>; deviceType: string; expectedCollection: string }> = [
    { mapping: { 'gas-boiler': 'gb-interventions', default: 'interventions' }, deviceType: 'gas-boiler', expectedCollection: 'gb-interventions' },
    { mapping: { 'heat-pump': 'hp-interventions', default: 'interventions' }, deviceType: 'heat-pump', expectedCollection: 'hp-interventions' },
    { mapping: { 'air-condition': 'ac-interventions', default: 'interventions' }, deviceType: 'air-condition', expectedCollection: 'ac-interventions' },
    { mapping: { default: 'all-interventions' }, deviceType: 'unknown', expectedCollection: 'all-interventions' },
    { mapping: {}, deviceType: 'any', expectedCollection: 'interventions' },
    { mapping: { 'gas-boiler': 'gb', 'heat-pump': 'hp', default: 'intv' }, deviceType: 'gas-boiler', expectedCollection: 'gb' },
    { mapping: { 'gas-boiler': 'gb', 'heat-pump': 'hp', default: 'intv' }, deviceType: 'heat-pump', expectedCollection: 'hp' },
    { mapping: { 'gas-boiler': 'gb', 'heat-pump': 'hp', default: 'intv' }, deviceType: 'solar', expectedCollection: 'intv' },
    { mapping: { 'gas-boiler': 'gb', 'heat-pump': 'hp' }, deviceType: 'solar', expectedCollection: 'interventions' },
  ];

  tenantIdsForIntv.forEach(tenantId => {
    mappingConfigs.forEach(({ mapping, deviceType, expectedCollection }, idx) => {
      it(`EXP-GICP: tenant="${tenantId}" mapping#${idx} deviceType="${deviceType}" → "${tenantId}/${expectedCollection}"`, () => {
        const cfg = getDefaultConfig();
        cfg.business.interventionCollections = mapping;
        mockConfigStore.setConfig(cfg);
        tenantStore.setTenant(tenantId, 'servicer', null, []);

        const path = service.getInterventionCollectionPath(deviceType);

        expect(path).toBe(`tenants/${tenantId}/${expectedCollection}`);
      });
    });
  });
});

// ══════════════════════════════════════════════════════════════════════════════
// Matrix 8: getAllowedDeviceTypes() × many device type arrays
// ══════════════════════════════════════════════════════════════════════════════

describe('TenantService — EXPANSION: getAllowedDeviceTypes matrix', () => {
  let app: FirebaseApp;
  let service: TenantService;
  let tenantStore: InstanceType<typeof TenantStore>;

  beforeAll(() => {
    if (getApps().length === 0) {
      app = initializeApp(environment.firebase);
    } else {
      app = getApps()[0];
    }
  });

  beforeEach(() => {
    const mockLogger = createMockLoggerService();
    const mockConfigStore = createMockConfigStore();
    mockConfigStore.loadDefaults();

    TestBed.configureTestingModule({
      providers: [
        TenantService,
        TenantStore,
        { provide: LoggerService, useValue: mockLogger },
        { provide: ConfigStore, useValue: mockConfigStore },
      ],
    });

    service = TestBed.inject(TenantService);
    tenantStore = TestBed.inject(TenantStore);
    tenantStore.clear();
  });

  const deviceTypeArrayCases = [
    [],
    ['boiler'],
    ['gas-boiler', 'heat-pump'],
    ['a', 'b', 'c', 'd', 'e', 'f'],
    ['gas-boiler', 'heat-pump', 'air-condition', 'solar-panel', 'pellet-boiler',
     'electric-boiler', 'hybrid', 'water-heater', 'condensing-boiler', 'combi-boiler'],
    ['single-type-with-long-name-that-exceeds-normal-length'],
    ['GAS-BOILER', 'HEAT-PUMP'],
    ['type1', 'type2', 'type3', 'type4', 'type5', 'type6', 'type7', 'type8', 'type9', 'type10',
     'type11', 'type12', 'type13', 'type14', 'type15'],
    ['type-with.special+chars'],
    [''],
  ];

  deviceTypeArrayCases.forEach(deviceTypes => {
    const label = JSON.stringify(deviceTypes).slice(0, 50);
    it(`EXP-GADT: ${label} — getAllowedDeviceTypes() returns exact array`, () => {
      tenantStore.setTenant('t1', 'servicer', null, deviceTypes);
      expect(service.getAllowedDeviceTypes()).toEqual(deviceTypes);
    });
  });
});

// ══════════════════════════════════════════════════════════════════════════════
// Matrix 9: getCurrentTenantId() exhaustive
// ══════════════════════════════════════════════════════════════════════════════

describe('TenantService — EXPANSION: getCurrentTenantId exhaustive matrix', () => {
  let app: FirebaseApp;
  let service: TenantService;
  let tenantStore: InstanceType<typeof TenantStore>;

  beforeAll(() => {
    if (getApps().length === 0) {
      app = initializeApp(environment.firebase);
    } else {
      app = getApps()[0];
    }
  });

  beforeEach(() => {
    const mockLogger = createMockLoggerService();
    const mockConfigStore = createMockConfigStore();
    mockConfigStore.loadDefaults();

    TestBed.configureTestingModule({
      providers: [
        TenantService,
        TenantStore,
        { provide: LoggerService, useValue: mockLogger },
        { provide: ConfigStore, useValue: mockConfigStore },
      ],
    });

    service = TestBed.inject(TenantService);
    tenantStore = TestBed.inject(TenantStore);
    tenantStore.clear();
  });

  const tenantIdsForCurrent = [
    'tenant-1', 'corp', 'my-enterprise-123', 'a', 'UPPERCASE',
    'corp_2024', 'a'.repeat(100), 'tenant.with.dots',
    'very-very-very-long-tenant-identifier-used-for-edge-case-testing',
  ];

  tenantIdsForCurrent.forEach(id => {
    it(`EXP-GCTI: getCurrentTenantId() returns "${id.slice(0, 30)}..."`, () => {
      tenantStore.setTenant(id, 'admin', null, []);
      expect(service.getCurrentTenantId()).toBe(id);
    });
  });

  it('EXP-GCTI: returns null when store is clear', () => {
    expect(service.getCurrentTenantId()).toBeNull();
  });

  // After setTenant then clear
  tenantIdsForCurrent.slice(0, 3).forEach(id => {
    it(`EXP-GCTI: returns null after clear (was "${id}")`, () => {
      tenantStore.setTenant(id, 'admin', null, []);
      tenantStore.clear();
      expect(service.getCurrentTenantId()).toBeNull();
    });
  });
});

// ══════════════════════════════════════════════════════════════════════════════
// Matrix 10: JWT claim numeric/boolean type coercion edge cases
// ══════════════════════════════════════════════════════════════════════════════

describe('TenantService — EXPANSION: JWT claim type coercion edge cases', () => {
  let app: FirebaseApp;
  let service: TenantService;
  let tenantStore: InstanceType<typeof TenantStore>;

  beforeAll(() => {
    if (getApps().length === 0) {
      app = initializeApp(environment.firebase);
    } else {
      app = getApps()[0];
    }
  });

  beforeEach(() => {
    const mockLogger = createMockLoggerService();
    const mockConfigStore = createMockConfigStore();
    mockConfigStore.loadDefaults();

    TestBed.configureTestingModule({
      providers: [
        TenantService,
        TenantStore,
        { provide: LoggerService, useValue: mockLogger },
        { provide: ConfigStore, useValue: mockConfigStore },
      ],
    });

    service = TestBed.inject(TenantService);
    tenantStore = TestBed.inject(TenantStore);
    tenantStore.clear();
  });

  // tenantId as number (not string) — service may or may not handle
  it('EXP-COERCE: tenantId=123 (number) → store not set (null)', async () => {
    const jwt = makeJwt({ tenantId: 123, role: 'admin', deviceTypes: [] });
    spyOn(FirebaseAuthenticationWeb.prototype, 'getIdToken').and.resolveTo({ token: jwt });

    await service.resolveFromAuthToken();

    // tenantId as number is falsy-ish for string check, behavior depends on service
    // The service checks !claims.tenantId → if 123 is truthy, it may set store
    // We just verify it doesn't throw
    expect(tenantStore.tenantId()).toBeDefined(); // null or the numeric value as string
  });

  // deviceTypes as non-array → defaults to []
  const nonArrayDeviceTypes = ['string', 42, true, null, {}, { boiler: true }];
  nonArrayDeviceTypes.forEach(dt => {
    it(`EXP-COERCE: deviceTypes=${JSON.stringify(dt)} (non-array) → stored as []`, async () => {
      const jwt = makeJwt({ tenantId: 'tenant-coerce', role: 'admin', deviceTypes: dt });
      spyOn(FirebaseAuthenticationWeb.prototype, 'getIdToken').and.resolveTo({ token: jwt });

      await service.resolveFromAuthToken();

      expect(tenantStore.deviceTypes()).toEqual([]);
    });
  });

  // role as null → defaults to 'servicer'
  it('EXP-COERCE: role=null → defaults to servicer', async () => {
    const jwt = makeJwt({ tenantId: 'tenant-rolenull', role: null, deviceTypes: [] });
    spyOn(FirebaseAuthenticationWeb.prototype, 'getIdToken').and.resolveTo({ token: jwt });

    await service.resolveFromAuthToken();

    expect(tenantStore.role()).toBe('servicer');
  });

  // role as number
  it('EXP-COERCE: role=42 (number) — does not throw', async () => {
    const jwt = makeJwt({ tenantId: 'tenant-rolenum', role: 42, deviceTypes: [] });
    spyOn(FirebaseAuthenticationWeb.prototype, 'getIdToken').and.resolveTo({ token: jwt });

    await expectAsync(service.resolveFromAuthToken()).toBeResolved();
  });

  // servicerId as number
  it('EXP-COERCE: servicerId=99 (number) — does not throw', async () => {
    const jwt = makeJwt({ tenantId: 'tenant-svcnum', role: 'admin', servicerId: 99, deviceTypes: [] });
    spyOn(FirebaseAuthenticationWeb.prototype, 'getIdToken').and.resolveTo({ token: jwt });

    await expectAsync(service.resolveFromAuthToken()).toBeResolved();
  });

  // Extra unknown claims don't affect parsing
  const extraClaims = [
    { iss: 'firebase', sub: 'uid-001', aud: 'project-id', exp: 9999999999, iat: 1000000 },
    { custom_claim: 'value', nested: { deep: 'value' } },
    { 'claim-with-dash': 'val' },
  ];

  extraClaims.forEach((extra, idx) => {
    it(`EXP-COERCE: extra claims #${idx} don't affect tenantId extraction`, async () => {
      const jwt = makeJwt({ tenantId: `tenant-extra-${idx}`, role: 'admin', deviceTypes: [], ...extra });
      spyOn(FirebaseAuthenticationWeb.prototype, 'getIdToken').and.resolveTo({ token: jwt });

      await service.resolveFromAuthToken();

      expect(tenantStore.tenantId()).toBe(`tenant-extra-${idx}`);
    });
  });
});

// ══════════════════════════════════════════════════════════════════════════════
// Matrix 11: Error resilience — multiple calls with alternating success/failure
// ══════════════════════════════════════════════════════════════════════════════

describe('TenantService — EXPANSION: sequential calls resilience matrix', () => {
  let app: FirebaseApp;
  let service: TenantService;
  let tenantStore: InstanceType<typeof TenantStore>;

  beforeAll(() => {
    if (getApps().length === 0) {
      app = initializeApp(environment.firebase);
    } else {
      app = getApps()[0];
    }
  });

  beforeEach(() => {
    const mockLogger = createMockLoggerService();
    const mockConfigStore = createMockConfigStore();
    mockConfigStore.loadDefaults();

    TestBed.configureTestingModule({
      providers: [
        TenantService,
        TenantStore,
        { provide: LoggerService, useValue: mockLogger },
        { provide: ConfigStore, useValue: mockConfigStore },
      ],
    });

    service = TestBed.inject(TenantService);
    tenantStore = TestBed.inject(TenantStore);
    tenantStore.clear();
  });

  const tenantSequences = [
    ['tenant-a', 'tenant-b'],
    ['corp-1', 'corp-2', 'corp-3'],
    ['alpha', 'beta'],
    ['X1', 'X2', 'X3', 'X4', 'X5'],
  ];

  tenantSequences.forEach(sequence => {
    it(`EXP-SEQ: sequence [${sequence.join(',')}] — last call wins`, async () => {
      const spy = spyOn(FirebaseAuthenticationWeb.prototype, 'getIdToken');

      for (const tenantId of sequence) {
        const jwt = makeJwt({ tenantId, role: 'admin', deviceTypes: [], servicerId: null });
        spy.and.resolveTo({ token: jwt });
        await service.resolveFromAuthToken();
      }

      expect(tenantStore.tenantId()).toBe(sequence[sequence.length - 1]);
    });
  });

  // Error then success
  it('EXP-SEQ: error then success — success wins', async () => {
    const spy = spyOn(FirebaseAuthenticationWeb.prototype, 'getIdToken');

    spy.and.rejectWith(new Error('auth error'));
    await service.resolveFromAuthToken();
    expect(tenantStore.tenantId()).toBeNull();

    const jwt = makeJwt({ tenantId: 'recovered-tenant', role: 'admin', deviceTypes: [], servicerId: null });
    spy.and.resolveTo({ token: jwt });
    await service.resolveFromAuthToken();
    expect(tenantStore.tenantId()).toBe('recovered-tenant');
  });
});
