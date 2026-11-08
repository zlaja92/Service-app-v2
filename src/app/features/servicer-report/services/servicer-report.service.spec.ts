import { TestBed } from '@angular/core/testing';
import { ServicerReportService } from './servicer-report.service';
import { FirestoreService } from '../../../core/firebase/firestore.service';
import { TenantService } from '../../../core/tenant/tenant.service';
import { AuthStore } from '../../../core/auth/auth.store';
import { AuthUser } from '../../../core/auth/auth.model';
import { LoggerService } from '../../../core/logger/logger.service';
import { InterventionService } from '../../device-management/services/intervention.service';
import { InterventionType } from '../../device-management/models/intervention.model';
import { DeviceType } from '../../../shared/models/device.model';
import { ServicerReportFilter } from '../models/servicer-report.model';
import {
  createMockAuthStore,
  createMockFirestoreService,
  createMockLoggerService,
  createMockTenantService,
} from '../../../testing/mock-factories';

describe('ServicerReportService', () => {
  let service: ServicerReportService;
  let firestore: jasmine.SpyObj<FirestoreService>;
  let tenant: jasmine.SpyObj<TenantService>;
  let users: Record<string, Record<string, unknown>>;

  const filter: ServicerReportFilter = { dateFrom: new Date(2026, 0, 1), dateTo: new Date(2026, 11, 31) };

  beforeEach(() => {
    firestore = createMockFirestoreService();
    tenant = createMockTenantService();
    const authStore = createMockAuthStore();
    authStore.setUser({ email: 'servicer@test.rs' } as AuthUser);

    // Heat pump and gas boiler share one collection; heat pump is first in the
    // claims, which the old heuristic always picked.
    tenant.getAllowedDeviceTypes.and.returnValue([DeviceType.HEAT_PUMP, DeviceType.GAS_BOILER]);
    tenant.getInterventionCollectionPath.and.returnValue('tenants/t1/int-heating');

    users = {};
    firestore.getTenantDocument.and.callFake(((_collection: string, sn: string) =>
      Promise.resolve(users[sn] ?? null)) as never);

    TestBed.configureTestingModule({
      providers: [
        ServicerReportService,
        // Real InterventionService: getInterventionLabel uses the intervention model maps.
        InterventionService,
        { provide: FirestoreService, useValue: firestore },
        { provide: TenantService, useValue: tenant },
        { provide: AuthStore, useValue: authStore },
        { provide: LoggerService, useValue: createMockLoggerService() },
      ],
    });
    service = TestBed.inject(ServicerReportService);
  });

  function returnDocs(docs: Record<string, unknown>[]): void {
    firestore.queryTenantCollection.and.resolveTo({
      documents: docs.map((data, i) => ({ id: `doc${i}`, path: `p/doc${i}`, data })),
      lastDocumentPath: null,
    });
  }

  // ── Device type resolution ────────────────────────────────────────────────

  describe('device type of an intervention', () => {
    it('comes from the SN registration for a gas boiler in a shared collection', async () => {
      users['SN-GAS'] = { deviceType: 'gas-boiler', streetName: 'Glavna', homeNumber: '1', city: 'Kragujevac' };
      returnDocs([{ sn: 'SN-GAS', interventionType: InterventionType.COMMISSIONING }]);

      const [item] = await service.getServicerInterventions(filter);

      expect(item.deviceType).toBe(DeviceType.GAS_BOILER);
      expect(item.interventionTypeLabelKey).toBe('intervention_type_commissioning_gas_boiler');
      expect(item.address).toBe('Glavna 1');
      expect(item.city).toBe('Kragujevac');
    });

    it('stays heat pump for a registered heat pump', async () => {
      users['SN-HP'] = { deviceType: 'heat-pump' };
      returnDocs([{ sn: 'SN-HP', interventionType: InterventionType.ANNUAL_SERVICE }]);

      const [item] = await service.getServicerInterventions(filter);

      expect(item.deviceType).toBe(DeviceType.HEAT_PUMP);
      expect(item.interventionTypeLabelKey).toBe('intervention_type_annual_heat_pump');
    });

    it('resolves each SN separately within one result', async () => {
      users['SN-GAS'] = { deviceType: 'gas-boiler' };
      users['SN-HP'] = { deviceType: 'heat-pump' };
      returnDocs([
        { sn: 'SN-GAS', interventionType: InterventionType.INTERVENTION_REPAIR },
        { sn: 'SN-HP', interventionType: InterventionType.INTERVENTION_REPAIR },
      ]);

      const items = await service.getServicerInterventions(filter);

      expect(items.map(i => i.deviceType).sort()).toEqual([DeviceType.GAS_BOILER, DeviceType.HEAT_PUMP].sort());
    });

    it('prefers a deviceType stored on the intervention document', async () => {
      users['SN-X'] = { deviceType: 'heat-pump' };
      returnDocs([{ sn: 'SN-X', interventionType: InterventionType.COMMISSIONING, deviceType: 'gas-boiler' }]);

      const [item] = await service.getServicerInterventions(filter);

      expect(item.deviceType).toBe(DeviceType.GAS_BOILER);
    });

    it('ignores an unknown registration deviceType and falls back to the heuristic', async () => {
      users['SN-BAD'] = { deviceType: 'toaster' };
      returnDocs([{ sn: 'SN-BAD', interventionType: InterventionType.COMMISSIONING }]);

      const [item] = await service.getServicerInterventions(filter);

      expect(item.deviceType).toBe(DeviceType.HEAT_PUMP);
    });

    it('falls back to the heuristic when the SN has no registration', async () => {
      returnDocs([{ sn: 'SN-NONE', interventionType: InterventionType.COMMISSIONING }]);

      const [item] = await service.getServicerInterventions(filter);

      expect(item.deviceType).toBe(DeviceType.HEAT_PUMP);
      expect(item.address).toBe('');
    });

    it('reads each registration only once per SN', async () => {
      users['SN-GAS'] = { deviceType: 'gas-boiler' };
      returnDocs([
        { sn: 'SN-GAS', interventionType: InterventionType.COMMISSIONING },
        { sn: 'SN-GAS', interventionType: InterventionType.ANNUAL_SERVICE },
      ]);

      await service.getServicerInterventions(filter);

      expect(firestore.getTenantDocument.calls.allArgs().filter(a => a[1] === 'SN-GAS').length).toBe(1);
    });
  });

  // ── Intervention type filter options ───────────────────────────────────────

  describe('filterAvailableInterventionTypes()', () => {
    const options = [
      { value: InterventionType.COMMISSIONING },
      { value: InterventionType.ANNUAL_SERVICE },
      { value: InterventionType.INTERVENTION_REPAIR },
      { value: InterventionType.INTERVENTION_NOISE },
      { value: InterventionType.INTERVENTION_REPLACE },
    ];
    const values = (types: string[]) => {
      tenant.getAllowedDeviceTypes.and.returnValue(types);
      return service.filterAvailableInterventionTypes(options).map(o => o.value);
    };

    it('boiler only: no commissioning or annual service', () => {
      expect(values([DeviceType.BOILER])).toEqual([
        InterventionType.INTERVENTION_REPAIR,
        InterventionType.INTERVENTION_NOISE,
        InterventionType.INTERVENTION_REPLACE,
      ]);
    });

    it('gas boiler only: commissioning, annual service and repair', () => {
      expect(values([DeviceType.GAS_BOILER])).toEqual([
        InterventionType.COMMISSIONING,
        InterventionType.ANNUAL_SERVICE,
        InterventionType.INTERVENTION_REPAIR,
      ]);
    });

    it('boiler and heat pump together: all types', () => {
      expect(values([DeviceType.BOILER, DeviceType.HEAT_PUMP])).toEqual(options.map(o => o.value));
    });

    it('keeps the other option fields', () => {
      tenant.getAllowedDeviceTypes.and.returnValue([DeviceType.BOILER]);

      const result = service.filterAvailableInterventionTypes([
        { value: InterventionType.INTERVENTION_REPAIR, labelKey: 'servicer_report_type_repair' },
      ]);

      expect(result).toEqual([{ value: InterventionType.INTERVENTION_REPAIR, labelKey: 'servicer_report_type_repair' }]);
    });

    it('returns nothing when the user has no allowed device types', () => {
      expect(values([])).toEqual([]);
    });
  });
});
