/**
 * TenantService Unit Tests — WU-13, Batch B1, FAZA D
 *
 * MOCK STRATEGY — IMPORTANT NOTES
 * ================================
 * FirebaseAuthentication from @capacitor-firebase/authentication is a Capacitor
 * Proxy object (BUG-03 documented in src/app/testing/BUGS-FROM-TEST-PLAN.md).
 * The same solution used in WU-14 (auth.service.spec.ts) applies here:
 *   - Initialize Firebase App in beforeAll (required by FirebaseAuthenticationWeb constructor).
 *   - Spy on FirebaseAuthenticationWeb.prototype.getIdToken AFTER the class is loaded
 *     by Capacitor's lazy loader.
 *
 * TenantStore: REAL store via TestBed.inject(TenantStore). TenantService writes to
 * the store and we verify store state directly — this is the correct integration boundary.
 *
 * ConfigStore: mock via createMockConfigStore() from mock-factories — TenantService
 * reads configStore.business().interventionCollections but does not write to ConfigStore.
 *
 * LoggerService: mock via createMockLoggerService() from mock-factories.
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

// ---------------------------------------------------------------------------
// JWT helper — generates syntactically valid JWTs with arbitrary payload
// ---------------------------------------------------------------------------

function makeJwt(payload: object): string {
  const header = btoa(JSON.stringify({ alg: 'HS256', typ: 'JWT' }));
  const payloadB64 = btoa(JSON.stringify(payload));
  const signature = 'fake-signature';
  return `${header}.${payloadB64}.${signature}`;
}

// Edge-case tokens
const TWO_PARTS_TOKEN = 'header.payload';
const INVALID_BASE64_TOKEN = 'header.!@#$.signature';
const NOT_JSON_TOKEN = `header.${btoa('not json text')}.signature`;

// URL-safe base64 chars token — replaces + with - and / with _ in payload
function makeUrlSafeJwt(payload: object): string {
  const header = btoa(JSON.stringify({ alg: 'HS256', typ: 'JWT' }));
  // Encode payload and convert to URL-safe base64 (as Firebase tokens use)
  const payloadB64 = btoa(JSON.stringify(payload))
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=/g, '');
  const signature = 'fake-signature';
  return `${header}.${payloadB64}.${signature}`;
}

// ---------------------------------------------------------------------------
// Main describe
// ---------------------------------------------------------------------------

describe('TenantService', () => {
  let app: FirebaseApp;
  let service: TenantService;
  let tenantStore: InstanceType<typeof TenantStore>;
  let mockLogger: jasmine.SpyObj<LoggerService>;
  let mockConfigStore: ReturnType<typeof createMockConfigStore>;

  // ---------------------------------------------------------------------------
  // Firebase initialization — FirebaseAuthenticationWeb requires DEFAULT Firebase app
  // ---------------------------------------------------------------------------

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

    // Load defaults so business config has interventionCollections defined
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

    // Always start with clean store state
    tenantStore.clear();
  });

  // =========================================================================
  // resolveFromAuthToken() — success paths
  // =========================================================================

  describe('resolveFromAuthToken() — success paths', () => {
    it('TC-TS01: successfully decodes valid JWT and sets tenant store', async () => {
      const jwt = makeJwt({ tenantId: 'tenant-abc', role: 'admin', servicerId: 'svc-1', deviceTypes: ['boiler'] });
      spyOn(FirebaseAuthenticationWeb.prototype, 'getIdToken').and.resolveTo({ token: jwt });

      await service.resolveFromAuthToken();

      expect(tenantStore.tenantId()).toBe('tenant-abc');
    });

    it('TC-TS02: extracts tenantId from JWT claims', async () => {
      const jwt = makeJwt({ tenantId: 'tenant-xyz', role: 'servicer', servicerId: null, deviceTypes: [] });
      spyOn(FirebaseAuthenticationWeb.prototype, 'getIdToken').and.resolveTo({ token: jwt });

      await service.resolveFromAuthToken();

      expect(tenantStore.tenantId()).toBe('tenant-xyz');
    });

    it('TC-TS03: extracts role from JWT claims', async () => {
      const jwt = makeJwt({ tenantId: 'tenant-1', role: 'admin', servicerId: null, deviceTypes: [] });
      spyOn(FirebaseAuthenticationWeb.prototype, 'getIdToken').and.resolveTo({ token: jwt });

      await service.resolveFromAuthToken();

      expect(tenantStore.role()).toBe('admin');
    });

    it('TC-TS04: extracts servicerId from JWT claims', async () => {
      const jwt = makeJwt({ tenantId: 'tenant-1', role: 'servicer', servicerId: 'svc-42', deviceTypes: [] });
      spyOn(FirebaseAuthenticationWeb.prototype, 'getIdToken').and.resolveTo({ token: jwt });

      await service.resolveFromAuthToken();

      expect(tenantStore.servicerId()).toBe('svc-42');
    });

    it('TC-TS05: extracts deviceTypes array from JWT claims', async () => {
      const jwt = makeJwt({ tenantId: 'tenant-1', role: 'servicer', servicerId: null, deviceTypes: ['boiler', 'pump'] });
      spyOn(FirebaseAuthenticationWeb.prototype, 'getIdToken').and.resolveTo({ token: jwt });

      await service.resolveFromAuthToken();

      expect(tenantStore.deviceTypes()).toEqual(['boiler', 'pump']);
    });

    it('TC-TS06: defaults deviceTypes to empty array when missing in claims', async () => {
      // No deviceTypes field in JWT payload
      const jwt = makeJwt({ tenantId: 'tenant-1', role: 'servicer', servicerId: null });
      spyOn(FirebaseAuthenticationWeb.prototype, 'getIdToken').and.resolveTo({ token: jwt });

      await service.resolveFromAuthToken();

      expect(tenantStore.deviceTypes()).toEqual([]);
    });

    it('TC-TS07: returns void (Promise<void>) after successful resolve', async () => {
      const jwt = makeJwt({ tenantId: 'tenant-1', role: 'servicer', servicerId: null, deviceTypes: [] });
      spyOn(FirebaseAuthenticationWeb.prototype, 'getIdToken').and.resolveTo({ token: jwt });

      const result = await service.resolveFromAuthToken();

      expect(result).toBeUndefined();
    });

    it('TC-TS08: role defaults to "servicer" when missing in JWT claims', async () => {
      const jwt = makeJwt({ tenantId: 'tenant-1', servicerId: null, deviceTypes: [] });
      spyOn(FirebaseAuthenticationWeb.prototype, 'getIdToken').and.resolveTo({ token: jwt });

      await service.resolveFromAuthToken();

      expect(tenantStore.role()).toBe('servicer');
    });

    it('TC-TS09: servicerId defaults to null when missing in JWT claims', async () => {
      const jwt = makeJwt({ tenantId: 'tenant-1', role: 'tech', deviceTypes: [] });
      spyOn(FirebaseAuthenticationWeb.prototype, 'getIdToken').and.resolveTo({ token: jwt });

      await service.resolveFromAuthToken();

      expect(tenantStore.servicerId()).toBeNull();
    });

    it('TC-TS10: logs info after successful tenant resolve', async () => {
      const jwt = makeJwt({ tenantId: 'tenant-info', role: 'admin', servicerId: 'svc-info', deviceTypes: ['boiler'] });
      spyOn(FirebaseAuthenticationWeb.prototype, 'getIdToken').and.resolveTo({ token: jwt });

      await service.resolveFromAuthToken();

      expect(mockLogger.info).toHaveBeenCalledWith(
        'Tenant resolved from auth token',
        jasmine.objectContaining({ tenantId: 'tenant-info' })
      );
    });
  });

  // =========================================================================
  // resolveFromAuthToken() — JWT edge cases
  // =========================================================================

  describe('resolveFromAuthToken() — JWT edge cases', () => {
    it('TC-TS11: returns without setting store when token has fewer than 3 parts', async () => {
      spyOn(FirebaseAuthenticationWeb.prototype, 'getIdToken').and.resolveTo({ token: TWO_PARTS_TOKEN });

      await service.resolveFromAuthToken();

      // decodeJwtPayload returns {} for 2-part token → tenantId is null → warn is logged, store not set
      expect(tenantStore.tenantId()).toBeNull();
    });

    it('TC-TS12: handles token with invalid base64 in payload gracefully (does not throw)', async () => {
      spyOn(FirebaseAuthenticationWeb.prototype, 'getIdToken').and.resolveTo({ token: INVALID_BASE64_TOKEN });

      // atob throws on invalid base64 — resolveFromAuthToken must catch and not rethrow
      await expectAsync(service.resolveFromAuthToken()).toBeResolved();
    });

    it('TC-TS13: handles token with valid base64 but non-JSON payload gracefully', async () => {
      spyOn(FirebaseAuthenticationWeb.prototype, 'getIdToken').and.resolveTo({ token: NOT_JSON_TOKEN });

      // JSON.parse throws — resolveFromAuthToken must catch and not rethrow
      await expectAsync(service.resolveFromAuthToken()).toBeResolved();
    });

    it('TC-TS14: URL-safe base64 chars (- and _) are handled correctly in payload', async () => {
      // makeUrlSafeJwt replaces + with - and / with _ (standard JWT encoding)
      const jwt = makeUrlSafeJwt({ tenantId: 'tenant-url-safe', role: 'servicer', servicerId: null, deviceTypes: [] });
      spyOn(FirebaseAuthenticationWeb.prototype, 'getIdToken').and.resolveTo({ token: jwt });

      await service.resolveFromAuthToken();

      // decodeJwtPayload replaces - with + and _ with / before atob — must decode correctly
      expect(tenantStore.tenantId()).toBe('tenant-url-safe');
    });

    it('TC-TS15: JWT without claims (empty object payload) — logs warning, does not set store', async () => {
      // Empty payload: tenantId will be null → warn logged, store not updated
      const jwt = makeJwt({});
      spyOn(FirebaseAuthenticationWeb.prototype, 'getIdToken').and.resolveTo({ token: jwt });

      await service.resolveFromAuthToken();

      expect(tenantStore.tenantId()).toBeNull();
      expect(mockLogger.warn).toHaveBeenCalledWith('No tenantId found in auth claims');
    });

    it('TC-TS16: JWT where tenantId is explicitly null — logs warning, does not set store', async () => {
      const jwt = makeJwt({ tenantId: null, role: 'servicer', servicerId: null, deviceTypes: [] });
      spyOn(FirebaseAuthenticationWeb.prototype, 'getIdToken').and.resolveTo({ token: jwt });

      await service.resolveFromAuthToken();

      expect(tenantStore.tenantId()).toBeNull();
      expect(mockLogger.warn).toHaveBeenCalledWith('No tenantId found in auth claims');
    });
  });

  // =========================================================================
  // resolveFromAuthToken() — error handling
  // =========================================================================

  describe('resolveFromAuthToken() — error handling', () => {
    it('TC-TS17: logs warning when getIdToken rejects', async () => {
      spyOn(FirebaseAuthenticationWeb.prototype, 'getIdToken').and.rejectWith(new Error('auth/network-error'));

      await service.resolveFromAuthToken();

      expect(mockLogger.warn).toHaveBeenCalledWith(
        'Failed to resolve tenant from auth token',
        jasmine.objectContaining({ error: jasmine.stringContaining('auth/network-error') })
      );
    });

    it('TC-TS18: does not throw on any error — graceful degradation', async () => {
      spyOn(FirebaseAuthenticationWeb.prototype, 'getIdToken').and.rejectWith(new Error('unexpected'));

      await expectAsync(service.resolveFromAuthToken()).toBeResolved();
    });

    it('TC-TS19: logs warning when token is null/undefined in result', async () => {
      spyOn(FirebaseAuthenticationWeb.prototype, 'getIdToken').and.resolveTo({ token: undefined as unknown as string });

      await service.resolveFromAuthToken();

      expect(mockLogger.warn).toHaveBeenCalledWith('No auth token available for tenant resolution');
    });

    it('TC-TS20: does not update store when getIdToken fails', async () => {
      spyOn(FirebaseAuthenticationWeb.prototype, 'getIdToken').and.rejectWith(new Error('fail'));

      await service.resolveFromAuthToken();

      expect(tenantStore.tenantId()).toBeNull();
      expect(tenantStore.role()).toBeNull();
      expect(tenantStore.deviceTypes()).toEqual([]);
    });

    it('TC-TS21: multiple resolveFromAuthToken calls with different tokens — last call wins', async () => {
      const spy = spyOn(FirebaseAuthenticationWeb.prototype, 'getIdToken');

      const jwt1 = makeJwt({ tenantId: 'tenant-first', role: 'admin', servicerId: null, deviceTypes: ['boiler'] });
      const jwt2 = makeJwt({ tenantId: 'tenant-second', role: 'servicer', servicerId: 'svc-2', deviceTypes: ['pump'] });

      spy.and.resolveTo({ token: jwt1 });
      await service.resolveFromAuthToken();
      expect(tenantStore.tenantId()).toBe('tenant-first');

      spy.and.resolveTo({ token: jwt2 });
      await service.resolveFromAuthToken();
      expect(tenantStore.tenantId()).toBe('tenant-second');
      expect(tenantStore.role()).toBe('servicer');
      expect(tenantStore.deviceTypes()).toEqual(['pump']);
    });
  });

  // =========================================================================
  // getTenantDocPath()
  // =========================================================================

  describe('getTenantDocPath()', () => {
    it('TC-TS22: with tenantId returns full path tenants/{tenantId}', () => {
      tenantStore.setTenant('my-tenant', 'admin', null, []);

      const path = service.getTenantDocPath();

      expect(path).toBe('tenants/my-tenant');
    });

    it('TC-TS23: without tenantId throws an error', () => {
      // Store is cleared in beforeEach — tenantId is null
      expect(() => service.getTenantDocPath()).toThrowError(
        'Tenant not resolved. Call resolveFromAuthToken() first.'
      );
    });
  });

  // =========================================================================
  // getCollectionPath()
  // =========================================================================

  describe('getCollectionPath()', () => {
    it('TC-TS24: concatenates tenant doc path with collection name', () => {
      tenantStore.setTenant('acme', 'servicer', null, []);

      const path = service.getCollectionPath('interventions');

      expect(path).toBe('tenants/acme/interventions');
    });

    it('TC-TS25: returns path with any collection name provided', () => {
      tenantStore.setTenant('corp', 'admin', null, []);

      expect(service.getCollectionPath('devices')).toBe('tenants/corp/devices');
      expect(service.getCollectionPath('reports')).toBe('tenants/corp/reports');
    });

    it('TC-TS26: throws when no tenant set (delegates to getTenantDocPath)', () => {
      // Store cleared in beforeEach
      expect(() => service.getCollectionPath('interventions')).toThrowError();
    });
  });

  // =========================================================================
  // getInterventionCollectionPath()
  // =========================================================================

  describe('getInterventionCollectionPath()', () => {
    it('TC-TS27: maps device type to interventionCollections config', () => {
      const cfg = getDefaultConfig();
      cfg.business.interventionCollections = {
        'boiler': 'boiler-interventions',
        'pump': 'pump-interventions',
        'default': 'interventions',
      };
      mockConfigStore.setConfig(cfg);
      tenantStore.setTenant('tenant-1', 'servicer', null, []);

      const path = service.getInterventionCollectionPath('boiler');

      expect(path).toBe('tenants/tenant-1/boiler-interventions');
    });

    it('TC-TS28: falls back to "default" mapping when device type is missing', () => {
      const cfg = getDefaultConfig();
      cfg.business.interventionCollections = {
        'default': 'default-interventions',
      };
      mockConfigStore.setConfig(cfg);
      tenantStore.setTenant('tenant-1', 'servicer', null, []);

      const path = service.getInterventionCollectionPath('unknown-device');

      expect(path).toBe('tenants/tenant-1/default-interventions');
    });

    it('TC-TS29: falls back to "interventions" when no mapping exists at all', () => {
      const cfg = getDefaultConfig();
      cfg.business.interventionCollections = {};
      mockConfigStore.setConfig(cfg);
      tenantStore.setTenant('tenant-1', 'servicer', null, []);

      const path = service.getInterventionCollectionPath('boiler');

      expect(path).toBe('tenants/tenant-1/interventions');
    });

    it('TC-TS30: returns full tenant-scoped path', () => {
      const cfg = getDefaultConfig();
      cfg.business.interventionCollections = { default: 'interventions' };
      mockConfigStore.setConfig(cfg);
      tenantStore.setTenant('my-corp', 'admin', null, []);

      const path = service.getInterventionCollectionPath('boiler');

      expect(path).toContain('tenants/my-corp/');
    });
  });

  // =========================================================================
  // isDeviceTypeAllowed()
  // =========================================================================

  describe('isDeviceTypeAllowed()', () => {
    it('TC-TS31: returns true when deviceTypes contains the type', () => {
      tenantStore.setTenant('t1', 'servicer', null, ['boiler', 'pump']);

      expect(service.isDeviceTypeAllowed('boiler')).toBeTrue();
    });

    it('TC-TS32: returns false when deviceTypes does not contain the type', () => {
      tenantStore.setTenant('t1', 'servicer', null, ['boiler', 'pump']);

      expect(service.isDeviceTypeAllowed('air-condition')).toBeFalse();
    });

    it('TC-TS33: returns false when deviceTypes is empty (default-deny behavior)', () => {
      // Empty deviceTypes means no types allowed — source uses .includes() which returns false
      tenantStore.setTenant('t1', 'servicer', null, []);

      expect(service.isDeviceTypeAllowed('boiler')).toBeFalse();
    });

    it('TC-TS34: is case-sensitive — "Boiler" is not the same as "boiler"', () => {
      tenantStore.setTenant('t1', 'servicer', null, ['boiler']);

      expect(service.isDeviceTypeAllowed('Boiler')).toBeFalse();
    });
  });

  // =========================================================================
  // getAllowedDeviceTypes()
  // =========================================================================

  describe('getAllowedDeviceTypes()', () => {
    it('TC-TS35: returns array from tenant store', () => {
      tenantStore.setTenant('t1', 'servicer', null, ['gas-boiler', 'heat-pump']);

      expect(service.getAllowedDeviceTypes()).toEqual(['gas-boiler', 'heat-pump']);
    });

    it('TC-TS36: returns empty array when no device types set', () => {
      // Store cleared in beforeEach — deviceTypes is []
      expect(service.getAllowedDeviceTypes()).toEqual([]);
    });

    it('TC-TS37: returns empty array after store.clear()', () => {
      tenantStore.setTenant('t1', 'servicer', null, ['boiler']);
      tenantStore.clear();

      expect(service.getAllowedDeviceTypes()).toEqual([]);
    });
  });

  // =========================================================================
  // Parameterized: JWT claim combinations
  // =========================================================================

  describe('resolveFromAuthToken() — parameterized JWT claim combinations', () => {
    interface JwtClaimCase {
      label: string;
      payload: object;
      expectedTenantId: string | null;
      expectedRole?: string;
      expectedServicerIdNull?: boolean;
      expectedDeviceTypes?: string[];
    }

    const claimCombinations: JwtClaimCase[] = [
      {
        label: 'all fields present admin',
        payload: { tenantId: 'tenant-A', role: 'admin', servicerId: 'svc-1', deviceTypes: ['boiler'] },
        expectedTenantId: 'tenant-A',
        expectedRole: 'admin',
        expectedDeviceTypes: ['boiler'],
      },
      {
        label: 'all fields present servicer',
        payload: { tenantId: 'tenant-B', role: 'servicer', servicerId: 'svc-2', deviceTypes: ['pump', 'solar'] },
        expectedTenantId: 'tenant-B',
        expectedRole: 'servicer',
        expectedDeviceTypes: ['pump', 'solar'],
      },
      {
        label: 'no servicerId field',
        payload: { tenantId: 'tenant-C', role: 'tech', deviceTypes: ['heat-pump'] },
        expectedTenantId: 'tenant-C',
        expectedRole: 'tech',
        expectedServicerIdNull: true,
        expectedDeviceTypes: ['heat-pump'],
      },
      {
        label: 'no role field defaults to servicer',
        payload: { tenantId: 'tenant-D', servicerId: null, deviceTypes: [] },
        expectedTenantId: 'tenant-D',
        expectedRole: 'servicer',
        expectedDeviceTypes: [],
      },
      {
        label: 'no deviceTypes field defaults to empty array',
        payload: { tenantId: 'tenant-E', role: 'admin', servicerId: null },
        expectedTenantId: 'tenant-E',
        expectedRole: 'admin',
        expectedDeviceTypes: [],
      },
      {
        label: 'many device types',
        payload: {
          tenantId: 'tenant-F',
          role: 'servicer',
          servicerId: null,
          deviceTypes: ['boiler', 'pump', 'solar', 'ac', 'pellet', 'electric', 'hybrid', 'water-heater'],
        },
        expectedTenantId: 'tenant-F',
        expectedDeviceTypes: ['boiler', 'pump', 'solar', 'ac', 'pellet', 'electric', 'hybrid', 'water-heater'],
      },
      {
        label: 'tenant with special chars in id',
        payload: { tenantId: 'corp-123_v2', role: 'admin', servicerId: 'svc-x', deviceTypes: [] },
        expectedTenantId: 'corp-123_v2',
        expectedRole: 'admin',
      },
      {
        label: 'tenant with long id',
        payload: { tenantId: 'a'.repeat(50), role: 'servicer', servicerId: null, deviceTypes: [] },
        expectedTenantId: 'a'.repeat(50),
      },
      {
        label: 'servicerId is empty string',
        payload: { tenantId: 'tenant-G', role: 'servicer', servicerId: '', deviceTypes: [] },
        expectedTenantId: 'tenant-G',
      },
      {
        label: 'extra unknown claims present',
        payload: { tenantId: 'tenant-H', role: 'admin', servicerId: null, deviceTypes: [], iss: 'firebase', sub: 'uid-1', exp: 9999999999 },
        expectedTenantId: 'tenant-H',
        expectedRole: 'admin',
      },
      {
        label: 'deviceTypes is empty array',
        payload: { tenantId: 'tenant-I', role: 'servicer', servicerId: 'svc-i', deviceTypes: [] },
        expectedTenantId: 'tenant-I',
        expectedDeviceTypes: [],
      },
      {
        label: 'deviceTypes is not array (string) — defaults to empty',
        payload: { tenantId: 'tenant-J', role: 'servicer', servicerId: null, deviceTypes: 'boiler' },
        expectedTenantId: 'tenant-J',
        expectedDeviceTypes: [],
      },
      {
        label: 'deviceTypes is null — defaults to empty',
        payload: { tenantId: 'tenant-K', role: 'servicer', servicerId: null, deviceTypes: null },
        expectedTenantId: 'tenant-K',
        expectedDeviceTypes: [],
      },
      {
        label: 'deviceTypes is object — defaults to empty',
        payload: { tenantId: 'tenant-L', role: 'servicer', servicerId: null, deviceTypes: { boiler: true } },
        expectedTenantId: 'tenant-L',
        expectedDeviceTypes: [],
      },
      {
        label: 'role is numeric — stored as-is',
        payload: { tenantId: 'tenant-M', role: 42 as any, servicerId: null, deviceTypes: [] },
        expectedTenantId: 'tenant-M',
      },
      {
        label: 'tenantId is empty string — warns and does not set store',
        payload: { tenantId: '', role: 'servicer', servicerId: null, deviceTypes: [] },
        expectedTenantId: null,
      },
    ];

    claimCombinations.forEach(({ label, payload, expectedTenantId, expectedRole, expectedServicerIdNull, expectedDeviceTypes }) => {
      it(`TC-TSP-${label}: resolveFromAuthToken correctly handles "${label}"`, async () => {
        const jwt = makeJwt(payload);
        spyOn(FirebaseAuthenticationWeb.prototype, 'getIdToken').and.resolveTo({ token: jwt });

        await service.resolveFromAuthToken();

        if (expectedTenantId === null) {
          expect(tenantStore.tenantId()).toBeNull();
        } else {
          expect(tenantStore.tenantId()).toBe(expectedTenantId);
        }

        if (expectedRole !== undefined && expectedTenantId !== null) {
          expect(tenantStore.role()).toBe(expectedRole);
        }

        if (expectedServicerIdNull && expectedTenantId !== null) {
          expect(tenantStore.servicerId()).toBeNull();
        }

        if (expectedDeviceTypes !== undefined && expectedTenantId !== null) {
          expect(tenantStore.deviceTypes()).toEqual(expectedDeviceTypes);
        }
      });
    });
  });

  // =========================================================================
  // Parameterized: malformed JWT variants
  // =========================================================================

  describe('resolveFromAuthToken() — malformed JWT variants', () => {
    const malformedTokens = [
      { label: '2 parts only', token: 'header.payload' },
      { label: '1 part only', token: 'justonepart' },
      { label: '4 parts', token: 'a.b.c.d' },
      { label: '0 parts empty', token: '' },
      { label: 'all dots', token: '...' },
      { label: 'invalid base64 in payload', token: `header.!@#$%^&*.signature` },
      { label: 'not-json payload', token: `header.${btoa('this is not json')}.signature` },
      { label: 'valid base64 but array payload', token: `header.${btoa('[1,2,3]')}.signature` },
      { label: 'valid base64 but number payload', token: `header.${btoa('42')}.signature` },
    ];

    malformedTokens.forEach(({ label, token }) => {
      it(`TC-TSMF-${label}: resolveFromAuthToken() does not throw for "${label}"`, async () => {
        spyOn(FirebaseAuthenticationWeb.prototype, 'getIdToken').and.resolveTo({ token });

        await expectAsync(service.resolveFromAuthToken()).toBeResolved();

        // Store should not be set for malformed tokens
        expect(tenantStore.tenantId()).toBeNull();
      });
    });
  });

  // =========================================================================
  // Parameterized: getCollectionPath() — various collection names
  // =========================================================================

  describe('getCollectionPath() — parameterized collection names', () => {
    const collectionNames = [
      'devices',
      'orders',
      'interventions',
      'reports',
      'audit-logs',
      'user-profiles',
      'device_catalog',
      'parts.catalog',
      'notifications',
      'settings',
      'a',
      'very-long-collection-name-that-is-still-valid',
    ];

    collectionNames.forEach((collection) => {
      it(`TC-TSGCP-${collection}: getCollectionPath("${collection}") returns "tenants/{id}/${collection}"`, () => {
        tenantStore.setTenant('test-tenant', 'admin', null, []);

        const path = service.getCollectionPath(collection);

        expect(path).toBe(`tenants/test-tenant/${collection}`);
      });
    });
  });

  // =========================================================================
  // Parameterized: isDeviceTypeAllowed() — various device types
  // =========================================================================

  describe('isDeviceTypeAllowed() — parameterized device types', () => {
    const allowedTypes = ['gas-boiler', 'heat-pump', 'air-condition', 'solar-panel', 'pellet-boiler'];

    allowedTypes.forEach((type) => {
      it(`TC-TSIDA-ALLOWED-${type}: isDeviceTypeAllowed("${type}") returns true when in store`, () => {
        tenantStore.setTenant('t1', 'servicer', null, allowedTypes);

        expect(service.isDeviceTypeAllowed(type)).toBeTrue();
      });
    });

    const notAllowedTypes = ['electric-boiler', 'hybrid', 'water-heater', 'BOILER', 'gas_boiler', ''];

    notAllowedTypes.forEach((type) => {
      it(`TC-TSIDA-NOTALLOWED-"${type}": isDeviceTypeAllowed("${type}") returns false when NOT in store`, () => {
        tenantStore.setTenant('t1', 'servicer', null, allowedTypes);

        expect(service.isDeviceTypeAllowed(type)).toBeFalse();
      });
    });
  });

  // =========================================================================
  // Parameterized: getTenantDocPath() — various tenant IDs
  // =========================================================================

  describe('getTenantDocPath() — parameterized tenant IDs', () => {
    const tenantIds = [
      'tenant-1',
      'my-corp',
      'acme-enterprise',
      'corp_2024',
      't',
      'a'.repeat(50),
      'corp-with-numbers-123',
      'UPPERCASE',
      'mixed-Case_ID',
    ];

    tenantIds.forEach((tenantId) => {
      it(`TC-TSGTDP-${tenantId.slice(0, 20)}: getTenantDocPath() returns "tenants/${tenantId.slice(0, 20)}..."`, () => {
        tenantStore.setTenant(tenantId, 'admin', null, []);

        expect(service.getTenantDocPath()).toBe(`tenants/${tenantId}`);
      });
    });
  });

  // =========================================================================
  // Parameterized: getInterventionCollectionPath() — multiple device types in config
  // =========================================================================

  describe('getInterventionCollectionPath() — parameterized config mappings', () => {
    const configMappings: Array<{
      label: string;
      mapping: Record<string, string>;
      deviceType: string;
      expectedCollection: string;
    }> = [
      {
        label: 'gas-boiler mapped explicitly',
        mapping: { 'gas-boiler': 'gas-boiler-interventions', default: 'interventions' },
        deviceType: 'gas-boiler',
        expectedCollection: 'gas-boiler-interventions',
      },
      {
        label: 'heat-pump mapped explicitly',
        mapping: { 'heat-pump': 'heat-pump-interventions', default: 'interventions' },
        deviceType: 'heat-pump',
        expectedCollection: 'heat-pump-interventions',
      },
      {
        label: 'unknown type falls back to default',
        mapping: { default: 'default-col' },
        deviceType: 'unknown-device',
        expectedCollection: 'default-col',
      },
      {
        label: 'empty mapping falls back to interventions',
        mapping: {},
        deviceType: 'anything',
        expectedCollection: 'interventions',
      },
      {
        label: 'no default, unknown type falls back to interventions',
        mapping: { 'gas-boiler': 'gb-intv' },
        deviceType: 'heat-pump',
        expectedCollection: 'interventions',
      },
    ];

    configMappings.forEach(({ label, mapping, deviceType, expectedCollection }) => {
      it(`TC-TSGICP-${label}: getInterventionCollectionPath correctly resolves "${label}"`, () => {
        const cfg = getDefaultConfig();
        cfg.business.interventionCollections = mapping;
        mockConfigStore.setConfig(cfg);
        tenantStore.setTenant('tenant-test', 'servicer', null, []);

        const path = service.getInterventionCollectionPath(deviceType);

        expect(path).toBe(`tenants/tenant-test/${expectedCollection}`);
      });
    });
  });

  // =========================================================================
  // Parameterized: getAllowedDeviceTypes() — various device type arrays
  // =========================================================================

  describe('getAllowedDeviceTypes() — parameterized device type arrays', () => {
    const deviceTypeArrays = [
      [],
      ['boiler'],
      ['gas-boiler', 'heat-pump'],
      ['a', 'b', 'c', 'd', 'e'],
      ['gas-boiler', 'heat-pump', 'air-condition', 'solar-panel', 'pellet-boiler', 'electric-boiler', 'hybrid', 'water-heater'],
    ];

    deviceTypeArrays.forEach((deviceTypes) => {
      const label = JSON.stringify(deviceTypes).slice(0, 40);
      it(`TC-TSGADT-${label}: getAllowedDeviceTypes() returns ${label}`, () => {
        tenantStore.setTenant('t1', 'servicer', null, deviceTypes);

        expect(service.getAllowedDeviceTypes()).toEqual(deviceTypes);
      });
    });
  });

  // =========================================================================
  // Parameterized: getCurrentTenantId() — various tenant IDs
  // =========================================================================

  describe('getCurrentTenantId() — parameterized', () => {
    const tenantIds = ['tenant-1', 'corp', 'my-enterprise-123', 'a', null];

    tenantIds.forEach((id) => {
      it(`TC-TSGCTI-${id}: getCurrentTenantId() returns "${id}"`, () => {
        if (id !== null) {
          tenantStore.setTenant(id, 'admin', null, []);
        }
        // if null, store is already cleared in beforeEach

        expect(service.getCurrentTenantId()).toBe(id);
      });
    });
  });
});
