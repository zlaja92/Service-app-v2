import { TestBed } from '@angular/core/testing';
import { TenantStore } from './tenant.store';

describe('TenantStore', () => {
  let store: InstanceType<typeof TenantStore>;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    store = TestBed.inject(TenantStore);
    store.clear();
  });

  describe('Initial State', () => {
    it('TC-T01: should have null tenantId on initialization', () => {
      expect(store.tenantId()).toBeNull();
    });

    it('TC-T02: should have null role on initialization', () => {
      expect(store.role()).toBeNull();
    });

    it('TC-T03: should have null servicerId on initialization', () => {
      expect(store.servicerId()).toBeNull();
    });

    it('TC-T04: should have empty array deviceTypes on initialization', () => {
      expect(store.deviceTypes()).toEqual([]);
    });
  });

  describe('setTenant', () => {
    it('TC-T05: should set all four fields with all args provided', () => {
      store.setTenant('tenant-1', 'admin', 'servicer-1', ['boiler', 'pump']);

      expect(store.tenantId()).toBe('tenant-1');
      expect(store.role()).toBe('admin');
      expect(store.servicerId()).toBe('servicer-1');
      expect(store.deviceTypes()).toEqual(['boiler', 'pump']);
    });

    it('TC-T06: should default deviceTypes to [] when 4th arg is omitted', () => {
      store.setTenant('tenant-2', 'tech', 'servicer-2');

      expect(store.tenantId()).toBe('tenant-2');
      expect(store.role()).toBe('tech');
      expect(store.servicerId()).toBe('servicer-2');
      expect(store.deviceTypes()).toEqual([]);
    });

    it('TC-T07: should accept null for tenantId, role, and servicerId', () => {
      store.setTenant(null, null, null, ['boiler']);

      expect(store.tenantId()).toBeNull();
      expect(store.role()).toBeNull();
      expect(store.servicerId()).toBeNull();
      expect(store.deviceTypes()).toEqual(['boiler']);
    });

    it('TC-T08: should overwrite previous state completely', () => {
      store.setTenant('tenant-1', 'admin', 'servicer-1', ['boiler']);
      store.setTenant('tenant-2', 'tech', 'servicer-2', ['pump', 'valve']);

      expect(store.tenantId()).toBe('tenant-2');
      expect(store.role()).toBe('tech');
      expect(store.servicerId()).toBe('servicer-2');
      expect(store.deviceTypes()).toEqual(['pump', 'valve']);
    });
  });

  describe('clear', () => {
    it('TC-T09: should reset all fields to initial after setTenant', () => {
      store.setTenant('tenant-1', 'admin', 'servicer-1', ['boiler']);
      store.clear();

      expect(store.tenantId()).toBeNull();
      expect(store.role()).toBeNull();
      expect(store.servicerId()).toBeNull();
      expect(store.deviceTypes()).toEqual([]);
    });

    it('TC-T10: should be idempotent on already-clean store', () => {
      store.clear();

      expect(store.tenantId()).toBeNull();
      expect(store.role()).toBeNull();
      expect(store.servicerId()).toBeNull();
      expect(store.deviceTypes()).toEqual([]);
    });
  });

  describe('Signal reactivity', () => {
    it('TC-T11: should update synchronously after setTenant', () => {
      store.setTenant('tenant-sync', 'role-sync', 'servicer-sync', ['device-sync']);

      expect(store.tenantId()).toBe('tenant-sync');
      expect(store.role()).toBe('role-sync');
      expect(store.servicerId()).toBe('servicer-sync');
      expect(store.deviceTypes()).toEqual(['device-sync']);
    });
  });
});
