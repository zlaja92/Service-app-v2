import { TestBed } from '@angular/core/testing';

import { DeviceLookupService } from './device-lookup.service';
import { FirestoreService } from '../../../core/firebase/firestore.service';
import { ConfigStore } from '../../../core/config/config.store';
import { LoggerService } from '../../../core/logger/logger.service';
import { TenantService } from '../../../core/tenant/tenant.service';
import { DeviceType } from '../../../shared/models/device.model';
import { AppConfig, getDefaultConfig } from '../../../core/config/config.model';
import {
  createMockFirestoreService,
  createMockLoggerService,
  createMockTenantService,
  createMockConfigStore,
  MockConfigStore,
} from '../../../testing/mock-factories';

// ─── Helpers ──────────────────────────────────────────────────────────────────

function buildDeviceDoc(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    deviceCode: 'GENUS24',
    deviceName: 'Genus One 24',
    deviceType: DeviceType.GAS_BOILER,
    commissioning: false,
    annualService: true,
    connectedDevice: false,
    firstServiceYear: 2020,
    serviceWindowStart: 3,
    serviceWindowEnd: 9,
    warrantyMonths: 24,
    ...overrides,
  };
}

function buildAppConfig(snModelStart: number, snModelLength: number): AppConfig {
  const cfg = getDefaultConfig();
  cfg.business.snModelStart = snModelStart;
  cfg.business.snModelLength = snModelLength;
  return cfg;
}

// ─── Test suite ───────────────────────────────────────────────────────────────

describe('DeviceLookupService', () => {
  let service: DeviceLookupService;
  let mockFirestore: jasmine.SpyObj<FirestoreService>;
  let mockConfigStore: MockConfigStore;
  let mockTenantService: jasmine.SpyObj<TenantService>;
  let mockLogger: jasmine.SpyObj<LoggerService>;

  beforeEach(() => {
    mockFirestore = createMockFirestoreService();
    mockConfigStore = createMockConfigStore();
    mockTenantService = createMockTenantService();
    mockLogger = createMockLoggerService();

    // Default: config with snModelStart=0, snModelLength=7
    mockConfigStore.setConfig(buildAppConfig(0, 7));

    TestBed.configureTestingModule({
      providers: [
        DeviceLookupService,
        { provide: FirestoreService, useValue: mockFirestore },
        { provide: ConfigStore, useValue: mockConfigStore },
        { provide: TenantService, useValue: mockTenantService },
        { provide: LoggerService, useValue: mockLogger },
      ],
    });

    service = TestBed.inject(DeviceLookupService);
  });

  // ── extractModelCode ───────────────────────────────────────────────────────

  describe('extractModelCode()', () => {
    it('should extract substring from SN using snModelStart and snModelLength from config', () => {
      mockConfigStore.setConfig(buildAppConfig(0, 7));

      const result = service.extractModelCode('GENUS24ABCDEF');

      expect(result).toBe('GENUS24');
    });

    it('should use custom snModelStart offset when extracting model code', () => {
      mockConfigStore.setConfig(buildAppConfig(2, 5));

      const result = service.extractModelCode('XXGENUS24');

      expect(result).toBe('GENUS');
    });

    it('should return truncated string when SN is shorter than start+length', () => {
      mockConfigStore.setConfig(buildAppConfig(0, 10));

      // SN is only 5 chars, but length is 10 — substring truncates at end
      const result = service.extractModelCode('SHORT');

      expect(result).toBe('SHORT');
    });

    it('should return empty string when SN is empty', () => {
      const result = service.extractModelCode('');

      expect(result).toBe('');
    });

    it('should return empty string when start offset is beyond SN length', () => {
      mockConfigStore.setConfig(buildAppConfig(20, 7));

      const result = service.extractModelCode('SHORT');

      expect(result).toBe('');
    });

    it('should use default values (start=0, length=7) when business config is null', () => {
      // Clear config so business() returns undefined
      mockConfigStore.config.set(null);

      const result = service.extractModelCode('GENUS24EXTRA');

      // Default: start=0, length=7
      expect(result).toBe('GENUS24');
    });
  });

  // ── lookup() — full flow ───────────────────────────────────────────────────

  describe('lookup()', () => {
    it('should call extractModelCode and use result as Firestore document id', async () => {
      mockConfigStore.setConfig(buildAppConfig(0, 7));
      const doc = buildDeviceDoc();
      mockFirestore.getTenantDocument.and.resolveTo(doc);
      mockTenantService.isDeviceTypeAllowed.and.returnValue(true);

      await service.lookup('GENUS24ABCDE');

      expect(mockFirestore.getTenantDocument).toHaveBeenCalledWith('devices', 'GENUS24');
    });

    it('should call FirestoreService.getTenantDocument with "devices" collection', async () => {
      const doc = buildDeviceDoc();
      mockFirestore.getTenantDocument.and.resolveTo(doc);
      mockTenantService.isDeviceTypeAllowed.and.returnValue(true);

      await service.lookup('GENUS24ABCDE');

      const [collection] = mockFirestore.getTenantDocument.calls.mostRecent().args;
      expect(collection).toBe('devices');
    });

    it('should map Firestore document data to Device using mapToDevice', async () => {
      const doc = buildDeviceDoc({
        deviceCode: 'GEN24',
        deviceName: 'Genus One 24',
        deviceType: DeviceType.GAS_BOILER,
      });
      mockFirestore.getTenantDocument.and.resolveTo(doc);
      mockTenantService.isDeviceTypeAllowed.and.returnValue(true);

      const device = await service.lookup('GENUS24ABCDE');

      expect(device).not.toBeNull();
      expect(device!.code).toBe('GEN24');
      expect(device!.name).toBe('Genus One 24');
      expect(device!.type).toBe(DeviceType.GAS_BOILER);
    });

    it('should set service.device on successful lookup', async () => {
      const doc = buildDeviceDoc();
      mockFirestore.getTenantDocument.and.resolveTo(doc);
      mockTenantService.isDeviceTypeAllowed.and.returnValue(true);

      await service.lookup('GENUS24ABCDE');

      expect(service.device).not.toBeNull();
      expect(service.device!.name).toBe('Genus One 24');
    });

    it('should return null and NOT set device when type is not in allowedDeviceTypes', async () => {
      const doc = buildDeviceDoc({ deviceType: DeviceType.HEAT_PUMP });
      mockFirestore.getTenantDocument.and.resolveTo(doc);
      mockTenantService.isDeviceTypeAllowed.and.returnValue(false);

      const result = await service.lookup('GENUS24ABCDE');

      expect(result).toBeNull();
      expect(service.device).toBeNull();
    });

    it('should return null when Firestore document is not found', async () => {
      mockFirestore.getTenantDocument.and.resolveTo(null);

      const result = await service.lookup('GENUS24ABCDE');

      expect(result).toBeNull();
    });

    it('should return null when device type is disallowed', async () => {
      const doc = buildDeviceDoc({ deviceType: DeviceType.AIR_CONDITION });
      mockFirestore.getTenantDocument.and.resolveTo(doc);
      mockTenantService.isDeviceTypeAllowed.and.returnValue(false);

      const result = await service.lookup('GENUS24ABCDE');

      expect(result).toBeNull();
    });

    it('should log error and return null when Firestore throws', async () => {
      const error = new Error('Firestore unavailable');
      mockFirestore.getTenantDocument.and.rejectWith(error);

      const result = await service.lookup('GENUS24ABCDE');

      expect(result).toBeNull();
      expect(mockLogger.error).toHaveBeenCalledWith(
        'Device lookup failed',
        jasmine.objectContaining({ sn: 'GENUS24ABCDE' }),
      );
    });

    it('should set isLoading to false after successful lookup', async () => {
      const doc = buildDeviceDoc();
      mockFirestore.getTenantDocument.and.resolveTo(doc);
      mockTenantService.isDeviceTypeAllowed.and.returnValue(true);

      await service.lookup('GENUS24ABCDE');

      expect(service.isLoading).toBeFalse();
    });

    it('should set isLoading to false after failed lookup', async () => {
      mockFirestore.getTenantDocument.and.rejectWith(new Error('err'));

      await service.lookup('GENUS24ABCDE');

      expect(service.isLoading).toBeFalse();
    });

    it('should return null and warn when model code is empty', async () => {
      // Config: start=0, length=0 forces empty model code
      mockConfigStore.setConfig(buildAppConfig(0, 0));

      const result = await service.lookup('GENUS24ABCDE');

      expect(result).toBeNull();
      expect(mockFirestore.getTenantDocument).not.toHaveBeenCalled();
      expect(mockLogger.warn).toHaveBeenCalled();
    });
  });

  // ── lookupSilent() ─────────────────────────────────────────────────────────

  describe('lookupSilent()', () => {
    it('should return device without mutating service.device state', async () => {
      const doc = buildDeviceDoc();
      mockFirestore.getTenantDocument.and.resolveTo(doc);
      mockTenantService.isDeviceTypeAllowed.and.returnValue(true);

      // Set a sentinel device first so we can detect mutation
      service.device = null;
      const result = await service.lookupSilent('GENUS24ABCDE');

      expect(result).not.toBeNull();
      // service.device must remain null — silent lookup does NOT update state
      expect(service.device).toBeNull();
    });

    it('should return device using the same lookup logic as lookup()', async () => {
      const doc = buildDeviceDoc({
        deviceCode: 'GEN24',
        deviceName: 'Genus One 24',
        deviceType: DeviceType.GAS_BOILER,
      });
      mockFirestore.getTenantDocument.and.resolveTo(doc);
      mockTenantService.isDeviceTypeAllowed.and.returnValue(true);

      const result = await service.lookupSilent('GENUS24ABCDE');

      expect(result!.code).toBe('GEN24');
      expect(result!.name).toBe('Genus One 24');
      expect(result!.type).toBe(DeviceType.GAS_BOILER);
    });

    it('should return null when device not found in Firestore', async () => {
      mockFirestore.getTenantDocument.and.resolveTo(null);

      const result = await service.lookupSilent('GENUS24ABCDE');

      expect(result).toBeNull();
    });

    it('should return null when device type is disallowed', async () => {
      const doc = buildDeviceDoc({ deviceType: DeviceType.HEAT_PUMP });
      mockFirestore.getTenantDocument.and.resolveTo(doc);
      mockTenantService.isDeviceTypeAllowed.and.returnValue(false);

      const result = await service.lookupSilent('GENUS24ABCDE');

      expect(result).toBeNull();
    });

    it('should log error and return null when Firestore throws during silent lookup', async () => {
      mockFirestore.getTenantDocument.and.rejectWith(new Error('network error'));

      const result = await service.lookupSilent('GENUS24ABCDE');

      expect(result).toBeNull();
      expect(mockLogger.error).toHaveBeenCalled();
    });

    it('should return null when model code is empty (empty SN)', async () => {
      mockConfigStore.setConfig(buildAppConfig(0, 0));

      const result = await service.lookupSilent('ANYSN');

      expect(result).toBeNull();
      expect(mockFirestore.getTenantDocument).not.toHaveBeenCalled();
    });
  });

  // ── mapToDevice (via lookup) ───────────────────────────────────────────────

  describe('mapToDevice()', () => {
    async function performLookupWithDoc(doc: Record<string, unknown>) {
      mockFirestore.getTenantDocument.and.resolveTo(doc);
      mockTenantService.isDeviceTypeAllowed.and.returnValue(true);
      return service.lookup('GENUS24ABCDE');
    }

    it('should map "Device code" field from Firestore document', async () => {
      const device = await performLookupWithDoc(buildDeviceDoc({ deviceCode: 'MY-CODE' }));

      expect(device!.code).toBe('MY-CODE');
    });

    it('should fallback to model code (id) when "Device code" is missing', async () => {
      const doc = buildDeviceDoc();
      delete doc['deviceCode'];
      const device = await performLookupWithDoc(doc);

      // extractModelCode with start=0, length=7 on 'GENUS24ABCDE' => 'GENUS24'
      expect(device!.code).toBe('GENUS24');
    });

    it('should map "Device Name" field from Firestore document', async () => {
      const device = await performLookupWithDoc(buildDeviceDoc({ deviceName: 'Aqua Thermo Plus' }));

      expect(device!.name).toBe('Aqua Thermo Plus');
    });

    it('should map "Device type" field from Firestore document', async () => {
      const device = await performLookupWithDoc(buildDeviceDoc({ deviceType: DeviceType.BOILER }));

      expect(device!.type).toBe(DeviceType.BOILER);
    });

    it('should fallback to DeviceType.BOILER when "Device type" is missing', async () => {
      const doc = buildDeviceDoc();
      delete doc['deviceType'];
      const device = await performLookupWithDoc(doc);

      expect(device!.type).toBe(DeviceType.BOILER);
    });

    it('should map subType as empty string', async () => {
      const device = await performLookupWithDoc(buildDeviceDoc());

      expect(device!.subType).toBe('');
    });

    it('should map unitCount as 0', async () => {
      const device = await performLookupWithDoc(buildDeviceDoc());

      expect(device!.unitCount).toBe(0);
    });

    it('should map exists as true', async () => {
      const device = await performLookupWithDoc(buildDeviceDoc());

      expect(device!.exists).toBeTrue();
    });

    it('should map optional fields: annualService, commissioning, connectedDevice', async () => {
      const device = await performLookupWithDoc(
        buildDeviceDoc({ commissioning: true, annualService: false, connectedDevice: true }),
      );

      expect(device!.commissioning).toBeTrue();
      expect(device!.annualService).toBeFalse();
      expect(device!.connectedDevice).toBeTrue();
    });

    it('should map warrantyMonths from Firestore document', async () => {
      const device = await performLookupWithDoc(buildDeviceDoc({ warrantyMonths: 36 }));

      expect(device!.warrantyMonths).toBe(36);
    });
  });

  // ── clear() ───────────────────────────────────────────────────────────────

  describe('clear()', () => {
    it('should reset device to null', async () => {
      const doc = buildDeviceDoc();
      mockFirestore.getTenantDocument.and.resolveTo(doc);
      mockTenantService.isDeviceTypeAllowed.and.returnValue(true);
      await service.lookup('GENUS24ABCDE');

      service.clear();

      expect(service.device).toBeNull();
    });

    it('should reset isLoading to false', async () => {
      service.isLoading = true;

      service.clear();

      expect(service.isLoading).toBeFalse();
    });

    it('should reset sn to empty string', async () => {
      service.sn = 'SOME-SN';

      service.clear();

      expect(service.sn).toBe('');
    });
  });

  // ── Edge cases ─────────────────────────────────────────────────────────────

  describe('edge cases', () => {
    it('should handle multiple sequential lookups independently', async () => {
      const doc1 = buildDeviceDoc({ deviceName: 'First Device' });
      const doc2 = buildDeviceDoc({ deviceName: 'Second Device' });

      mockFirestore.getTenantDocument.and.resolveTo(doc1);
      mockTenantService.isDeviceTypeAllowed.and.returnValue(true);
      const first = await service.lookup('GENUS24FIRST');

      mockFirestore.getTenantDocument.and.resolveTo(doc2);
      const second = await service.lookup('GENUS24SECOND');

      expect(first!.name).toBe('First Device');
      expect(second!.name).toBe('Second Device');
      // State reflects the last lookup
      expect(service.device!.name).toBe('Second Device');
    });

    it('should reset device to null at the start of each lookup call', async () => {
      // First lookup succeeds, second fails — device must be null after second
      const doc = buildDeviceDoc();
      mockFirestore.getTenantDocument.and.resolveTo(doc);
      mockTenantService.isDeviceTypeAllowed.and.returnValue(true);
      await service.lookup('GENUS24ABCDE');

      mockFirestore.getTenantDocument.and.resolveTo(null);
      await service.lookup('GENUS24ABCDE');

      expect(service.device).toBeNull();
    });
  });
});
