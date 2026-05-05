import { TestBed, fakeAsync, tick } from '@angular/core/testing';
import { ActivatedRoute, Router, provideRouter } from '@angular/router';
import { ToastController } from '@ionic/angular/standalone';
import { TranslocoTestingModule } from '@jsverse/transloco';

import { InterventionHistoryPage } from './intervention-history.page';
import { DeviceLookupService } from '../services/device-lookup.service';
import { InterventionService } from '../services/intervention.service';
import { LoggerService } from '../../../core/logger/logger.service';
import { InterventionType } from '../models/intervention.model';
import { Device, DeviceType } from '../../../shared/models/device.model';
import {
  createMockToastController,
  createMockLoggerService,
} from '../../../testing/mock-factories';
import { buildFirestoreTimestamp } from '../../../testing/test-data-builders';

// ─── Helpers ──────────────────────────────────────────────────────────────────

function createMockDevice(overrides: Partial<Device> = {}): Device {
  return {
    code: 'GENUS24',
    name: 'Genus One 24',
    type: DeviceType.GAS_BOILER,
    subType: '',
    unitCount: 0,
    exists: true,
    commissioning: false,
    ...overrides,
  };
}

function createMockActivatedRoute(sn: string): { snapshot: { paramMap: { get: (key: string) => string | null } } } {
  return {
    snapshot: {
      paramMap: {
        get: (key: string) => (key === 'sn' ? sn : null),
      },
    },
  };
}

function createInterventionDoc(
  id: string,
  interventionType: string,
  addedDate: unknown = buildFirestoreTimestamp(new Date('2024-06-01T10:00:00Z')),
): { id: string; data: Record<string, unknown> } {
  return {
    id,
    data: {
      interventionType,
      addedDate,
      sn: 'TEST-SN-001',
    },
  };
}

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('InterventionHistoryPage', () => {
  let page: InterventionHistoryPage;
  let mockLookupService: jasmine.SpyObj<DeviceLookupService>;
  let mockInterventionService: jasmine.SpyObj<InterventionService>;
  let router: Router;
  let mockToastController: jasmine.SpyObj<ToastController>;
  let mockLogger: jasmine.SpyObj<LoggerService>;

  const TEST_SN = 'TEST-SN-001';

  // Minimal translations for TranslocoTestingModule
  const translocoLangs = { en: {} };

  beforeEach(() => {
    mockLookupService = jasmine.createSpyObj<DeviceLookupService>(
      'DeviceLookupService',
      ['lookup'],
      { device: null, sn: '' },
    );
    mockLookupService.lookup.and.resolveTo(null);

    mockInterventionService = jasmine.createSpyObj<InterventionService>(
      'InterventionService',
      ['getInterventionsBySn', 'getRegistration'],
    );
    mockInterventionService.getInterventionsBySn.and.resolveTo([]);
    mockInterventionService.getRegistration.and.resolveTo(null);

    mockToastController = createMockToastController();
    mockLogger = createMockLoggerService();

    TestBed.configureTestingModule({
      imports: [
        InterventionHistoryPage,
        TranslocoTestingModule.forRoot({
          langs: translocoLangs,
          translocoConfig: { availableLangs: ['en'], defaultLang: 'en' },
          preloadLangs: true,
        }),
      ],
      providers: [
        provideRouter([]),
        { provide: ActivatedRoute, useValue: createMockActivatedRoute(TEST_SN) },
        { provide: DeviceLookupService, useValue: mockLookupService },
        { provide: InterventionService, useValue: mockInterventionService },
        { provide: ToastController, useValue: mockToastController },
        { provide: LoggerService, useValue: mockLogger },
      ],
    });

    page = TestBed.createComponent(InterventionHistoryPage).componentInstance;
    router = TestBed.inject(Router);
    spyOn(router, 'navigate').and.resolveTo(true);
  });

  afterEach(() => {
    TestBed.resetTestingModule();
  });

  // ─── Lifecycle ───────────────────────────────────────────────────────────────

  describe('ionViewWillEnter()', () => {
    it('TC-IH-01: should extract SN from route snapshot paramMap', fakeAsync(() => {
      // Arrange
      (Object.getOwnPropertyDescriptor(mockLookupService, 'device')!.get as jasmine.Spy).and.returnValue(
        createMockDevice(),
      );
      (Object.getOwnPropertyDescriptor(mockLookupService, 'sn')!.get as jasmine.Spy).and.returnValue(TEST_SN);

      // Act
      page.ionViewWillEnter();
      tick();

      // Assert
      expect((page as unknown as { sn: string }).sn).toBe(TEST_SN);
    }));

    it('TC-IH-02: should call lookup when device is null (stale)', fakeAsync(() => {
      // Arrange: device is null so lookup should be triggered
      (Object.getOwnPropertyDescriptor(mockLookupService, 'device')!.get as jasmine.Spy).and.returnValue(null);
      (Object.getOwnPropertyDescriptor(mockLookupService, 'sn')!.get as jasmine.Spy).and.returnValue('');

      // Act
      page.ionViewWillEnter();
      tick();

      // Assert
      expect(mockLookupService.lookup).toHaveBeenCalledWith(TEST_SN);
    }));

    it('TC-IH-03: should NOT call lookup when device already cached for same SN', fakeAsync(() => {
      // Arrange: device exists and sn matches
      (Object.getOwnPropertyDescriptor(mockLookupService, 'device')!.get as jasmine.Spy).and.returnValue(
        createMockDevice(),
      );
      (Object.getOwnPropertyDescriptor(mockLookupService, 'sn')!.get as jasmine.Spy).and.returnValue(TEST_SN);

      // Act
      page.ionViewWillEnter();
      tick();

      // Assert
      expect(mockLookupService.lookup).not.toHaveBeenCalled();
    }));

    it('TC-IH-04: should call loadHistory after initialize', fakeAsync(() => {
      // Arrange: device is available so loadHistory will be called
      const device = createMockDevice();
      (Object.getOwnPropertyDescriptor(mockLookupService, 'device')!.get as jasmine.Spy).and.returnValue(device);
      (Object.getOwnPropertyDescriptor(mockLookupService, 'sn')!.get as jasmine.Spy).and.returnValue(TEST_SN);

      // Act
      page.ionViewWillEnter();
      tick();

      // Assert: getInterventionsBySn is called from loadHistory
      expect(mockInterventionService.getInterventionsBySn).toHaveBeenCalledWith(TEST_SN, device.type);
    }));
  });

  // ─── loadHistory ─────────────────────────────────────────────────────────────

  describe('loadHistory()', () => {
    it('TC-IH-05: should build commissioning-header item when device.commissioning is true and registration exists', fakeAsync(() => {
      // Arrange
      const device = createMockDevice({ commissioning: true });
      (Object.getOwnPropertyDescriptor(mockLookupService, 'device')!.get as jasmine.Spy).and.returnValue(device);
      (Object.getOwnPropertyDescriptor(mockLookupService, 'sn')!.get as jasmine.Spy).and.returnValue(TEST_SN);
      mockInterventionService.getRegistration.and.resolveTo({ dateOfPurchase: buildFirestoreTimestamp(new Date('2024-01-15')) });

      // Act
      page.ionViewWillEnter();
      tick();

      // Assert
      const items = (page as unknown as { items: unknown[] }).items;
      expect(items.length).toBeGreaterThan(0);
      const header = items[0] as { source: string; typeLabelKey: string; clickable: boolean };
      expect(header.source).toBe('commissioning-header');
      expect(header.typeLabelKey).toBe('history_type_commissioning');
      expect(header.clickable).toBeTrue();
    }));

    it('TC-IH-06: should build registration header item when device.commissioning is false', fakeAsync(() => {
      // Arrange
      const device = createMockDevice({ commissioning: false });
      (Object.getOwnPropertyDescriptor(mockLookupService, 'device')!.get as jasmine.Spy).and.returnValue(device);
      (Object.getOwnPropertyDescriptor(mockLookupService, 'sn')!.get as jasmine.Spy).and.returnValue(TEST_SN);
      mockInterventionService.getRegistration.and.resolveTo({ dateOfPurchase: buildFirestoreTimestamp(new Date('2024-01-15')) });

      // Act
      page.ionViewWillEnter();
      tick();

      // Assert
      const items = (page as unknown as { items: unknown[] }).items;
      const header = items[0] as { source: string; typeLabelKey: string; clickable: boolean };
      expect(header.source).toBe('registration');
      expect(header.typeLabelKey).toBe('history_type_purchase');
      expect(header.clickable).toBeFalse();
    }));

    it('TC-IH-07: should map interventions to display items', fakeAsync(() => {
      // Arrange
      const device = createMockDevice();
      (Object.getOwnPropertyDescriptor(mockLookupService, 'device')!.get as jasmine.Spy).and.returnValue(device);
      (Object.getOwnPropertyDescriptor(mockLookupService, 'sn')!.get as jasmine.Spy).and.returnValue(TEST_SN);
      mockInterventionService.getInterventionsBySn.and.resolveTo([
        createInterventionDoc('int-001', InterventionType.ANNUAL_SERVICE, buildFirestoreTimestamp(new Date('2024-03-10T12:00:00Z'))),
        createInterventionDoc('int-002', InterventionType.INTERVENTION_REPAIR, buildFirestoreTimestamp(new Date('2024-06-20T08:00:00Z'))),
      ]);

      // Act
      page.ionViewWillEnter();
      tick();

      // Assert: interventions should be present in items (registration is null so no header)
      const items = (page as unknown as { items: unknown[] }).items;
      expect(items.length).toBe(2);
    }));

    it('TC-IH-08: should filter COMMISSIONING type out from intervention list', fakeAsync(() => {
      // Arrange
      const device = createMockDevice({ commissioning: true });
      (Object.getOwnPropertyDescriptor(mockLookupService, 'device')!.get as jasmine.Spy).and.returnValue(device);
      (Object.getOwnPropertyDescriptor(mockLookupService, 'sn')!.get as jasmine.Spy).and.returnValue(TEST_SN);
      mockInterventionService.getRegistration.and.resolveTo({ dateOfPurchase: buildFirestoreTimestamp(new Date('2024-01-15')) });
      mockInterventionService.getInterventionsBySn.and.resolveTo([
        createInterventionDoc('comm-001', InterventionType.COMMISSIONING, buildFirestoreTimestamp(new Date('2024-01-20T10:00:00Z'))),
        createInterventionDoc('repair-001', InterventionType.INTERVENTION_REPAIR, buildFirestoreTimestamp(new Date('2024-06-01T10:00:00Z'))),
      ]);

      // Act
      page.ionViewWillEnter();
      tick();

      // Assert: only header + 1 repair, no commissioning row
      const items = (page as unknown as { items: unknown[] }).items as Array<{ id: string; source: string }>;
      const commissioningRows = items.filter(i => i.id === 'comm-001');
      expect(commissioningRows.length).toBe(0);
      // repair is present
      const repairRows = items.filter(i => i.id === 'repair-001');
      expect(repairRows.length).toBe(1);
    }));

    it('TC-IH-09: should format date via formatDate — ISO string becomes dd.MM.yyyy', fakeAsync(() => {
      // Arrange
      const device = createMockDevice({ commissioning: false });
      (Object.getOwnPropertyDescriptor(mockLookupService, 'device')!.get as jasmine.Spy).and.returnValue(device);
      (Object.getOwnPropertyDescriptor(mockLookupService, 'sn')!.get as jasmine.Spy).and.returnValue(TEST_SN);
      mockInterventionService.getRegistration.and.resolveTo({ dateOfPurchase: buildFirestoreTimestamp(new Date('2024-04-09T00:00:00.000Z')) });

      // Act
      page.ionViewWillEnter();
      tick();

      // Assert
      const items = (page as unknown as { items: unknown[] }).items;
      const header = items[0] as { date: string };
      expect(header.date).toBe('09.04.2024');
    }));

    it('TC-IH-10: should produce empty items list when no interventions and no registration', fakeAsync(() => {
      // Arrange
      const device = createMockDevice();
      (Object.getOwnPropertyDescriptor(mockLookupService, 'device')!.get as jasmine.Spy).and.returnValue(device);
      (Object.getOwnPropertyDescriptor(mockLookupService, 'sn')!.get as jasmine.Spy).and.returnValue(TEST_SN);
      mockInterventionService.getRegistration.and.resolveTo(null);
      mockInterventionService.getInterventionsBySn.and.resolveTo([]);

      // Act
      page.ionViewWillEnter();
      tick();

      // Assert
      const items = (page as unknown as { items: unknown[] }).items;
      expect(items.length).toBe(0);
    }));

    it('TC-IH-11: should set isLoading to false after loading', fakeAsync(() => {
      // Arrange
      const device = createMockDevice();
      (Object.getOwnPropertyDescriptor(mockLookupService, 'device')!.get as jasmine.Spy).and.returnValue(device);
      (Object.getOwnPropertyDescriptor(mockLookupService, 'sn')!.get as jasmine.Spy).and.returnValue(TEST_SN);

      // Act
      page.ionViewWillEnter();
      tick();

      // Assert
      expect((page as unknown as { isLoading: boolean }).isLoading).toBeFalse();
    }));

    it('TC-IH-12: should set isLoading to false when device is null (no-op path)', fakeAsync(() => {
      // Arrange: device null — loadHistory returns early
      (Object.getOwnPropertyDescriptor(mockLookupService, 'device')!.get as jasmine.Spy).and.returnValue(null);
      (Object.getOwnPropertyDescriptor(mockLookupService, 'sn')!.get as jasmine.Spy).and.returnValue('OTHER-SN');
      // lookup also returns null
      mockLookupService.lookup.and.resolveTo(null);

      // Act
      page.ionViewWillEnter();
      tick();

      // Assert
      expect((page as unknown as { isLoading: boolean }).isLoading).toBeFalse();
    }));
  });

  // ─── openDetail ──────────────────────────────────────────────────────────────

  describe('openDetail()', () => {
    it('TC-IH-13: should ignore click on non-clickable item', () => {
      // Arrange
      const nonClickableItem = {
        id: 'header',
        date: '01.01.2024',
        typeLabelKey: 'history_type_purchase',
        source: 'registration' as const,
        clickable: false,
      };

      // Act
      page.openDetail(nonClickableItem);

      // Assert
      expect(router.navigate).not.toHaveBeenCalled();
    });

    it('TC-IH-14: should navigate with commissioning intervention id when source is commissioning-header', fakeAsync(() => {
      // Arrange: seed cachedInterventions via loadHistory first
      const device = createMockDevice({ commissioning: true });
      (Object.getOwnPropertyDescriptor(mockLookupService, 'device')!.get as jasmine.Spy).and.returnValue(device);
      (Object.getOwnPropertyDescriptor(mockLookupService, 'sn')!.get as jasmine.Spy).and.returnValue(TEST_SN);
      mockInterventionService.getRegistration.and.resolveTo({ dateOfPurchase: buildFirestoreTimestamp(new Date('2024-01-10')) });
      mockInterventionService.getInterventionsBySn.and.resolveTo([
        createInterventionDoc('comm-doc-id', InterventionType.COMMISSIONING),
      ]);

      page.ionViewWillEnter();
      tick();

      const commissioningHeaderItem = {
        id: 'header',
        date: '10.01.2024',
        typeLabelKey: 'history_type_commissioning',
        source: 'commissioning-header' as const,
        clickable: true,
      };

      // Act
      page.openDetail(commissioningHeaderItem);
      tick();

      // Assert
      expect(router.navigate).toHaveBeenCalledWith(
        ['/device-management', TEST_SN, 'history', 'comm-doc-id'],
      );
    }));

    it('TC-IH-15: should show toast when commissioning-header clicked but no commissioning intervention cached', fakeAsync(() => {
      // Arrange: no commissioning in cached list
      const device = createMockDevice({ commissioning: true });
      (Object.getOwnPropertyDescriptor(mockLookupService, 'device')!.get as jasmine.Spy).and.returnValue(device);
      (Object.getOwnPropertyDescriptor(mockLookupService, 'sn')!.get as jasmine.Spy).and.returnValue(TEST_SN);
      mockInterventionService.getRegistration.and.resolveTo({ dateOfPurchase: buildFirestoreTimestamp(new Date('2024-01-10')) });
      mockInterventionService.getInterventionsBySn.and.resolveTo([
        createInterventionDoc('repair-001', InterventionType.INTERVENTION_REPAIR),
      ]);

      page.ionViewWillEnter();
      tick();

      const commissioningHeaderItem = {
        id: 'header',
        date: '10.01.2024',
        typeLabelKey: 'history_type_commissioning',
        source: 'commissioning-header' as const,
        clickable: true,
      };

      // Act
      page.openDetail(commissioningHeaderItem);
      tick();

      // Assert
      expect(router.navigate).not.toHaveBeenCalled();
      expect(mockToastController.create).toHaveBeenCalled();
    }));

    it('TC-IH-16: should navigate with item.id when source is registration', () => {
      // Arrange
      const registrationItem = {
        id: 'registration',
        date: '15.03.2024',
        typeLabelKey: 'history_type_purchase',
        source: 'registration' as const,
        clickable: true,
      };

      // Act
      page.openDetail(registrationItem);

      // Assert
      expect(router.navigate).toHaveBeenCalledWith(
        ['/device-management', '', 'history', 'registration'],
      );
    });

    it('TC-IH-17: should navigate with intervention.id for regular intervention', fakeAsync(() => {
      // Arrange: load with a regular intervention
      const device = createMockDevice();
      (Object.getOwnPropertyDescriptor(mockLookupService, 'device')!.get as jasmine.Spy).and.returnValue(device);
      (Object.getOwnPropertyDescriptor(mockLookupService, 'sn')!.get as jasmine.Spy).and.returnValue(TEST_SN);
      mockInterventionService.getInterventionsBySn.and.resolveTo([
        createInterventionDoc('repair-abc', InterventionType.INTERVENTION_REPAIR),
      ]);

      page.ionViewWillEnter();
      tick();

      const regularItem = {
        id: 'repair-abc',
        date: '01.06.2024',
        typeLabelKey: 'history_type_repair',
        source: 'intervention' as const,
        clickable: true,
      };

      // Act
      page.openDetail(regularItem);
      tick();

      // Assert
      expect(router.navigate).toHaveBeenCalledWith(
        ['/device-management', TEST_SN, 'history', 'repair-abc'],
      );
    }));
  });

  // ─── formatDate / toDateString ────────────────────────────────────────────────

  describe('formatDate() / toDateString() — via header date', () => {
    function loadWithPurchaseDate(purchaseDate: unknown, commissioning = false): void {
      const device = createMockDevice({ commissioning });
      (Object.getOwnPropertyDescriptor(mockLookupService, 'device')!.get as jasmine.Spy).and.returnValue(device);
      (Object.getOwnPropertyDescriptor(mockLookupService, 'sn')!.get as jasmine.Spy).and.returnValue(TEST_SN);
      mockInterventionService.getRegistration.and.resolveTo({ dateOfPurchase: purchaseDate });
    }

    it('TC-IH-18: should format Firestore timestamp to dd.MM.yyyy', fakeAsync(() => {
      const firestoreTimestamp = buildFirestoreTimestamp(new Date('2024-04-09T22:00:00Z'));
      loadWithPurchaseDate(firestoreTimestamp);

      page.ionViewWillEnter();
      tick();

      const items = (page as unknown as { items: unknown[] }).items;
      const header = items[0] as { date: string };
      expect(header.date).toMatch(/^\d{2}\.\d{2}\.\d{4}$/);
    }));

    // SKIPPED: tested legacy Date-pass-through. Strict Timestamp-only contract.
    xit('TC-IH-19: should format Date object to dd.MM.yyyy', fakeAsync(() => {
      const dateObj = new Date('2024-07-15T00:00:00Z');
      loadWithPurchaseDate(dateObj);

      page.ionViewWillEnter();
      tick();

      const items = (page as unknown as { items: unknown[] }).items;
      const header = items[0] as { date: string };
      expect(header.date).toBe('15.07.2024');
    }));

    // SKIPPED: tested legacy ISO-string parsing. Strict Timestamp-only contract.
    xit('TC-IH-20: should format ISO string to dd.MM.yyyy', fakeAsync(() => {
      loadWithPurchaseDate('2024-12-25T00:00:00.000Z');

      page.ionViewWillEnter();
      tick();

      const items = (page as unknown as { items: unknown[] }).items;
      const header = items[0] as { date: string };
      expect(header.date).toBe('25.12.2024');
    }));

    it('TC-IH-21: should produce empty date and set dateKey when dateOfPurchase is null', fakeAsync(() => {
      // Arrange: registration exists but dateOfPurchase is null
      const device = createMockDevice({ commissioning: false });
      (Object.getOwnPropertyDescriptor(mockLookupService, 'device')!.get as jasmine.Spy).and.returnValue(device);
      (Object.getOwnPropertyDescriptor(mockLookupService, 'sn')!.get as jasmine.Spy).and.returnValue(TEST_SN);
      mockInterventionService.getRegistration.and.resolveTo({ dateOfPurchase: null });

      page.ionViewWillEnter();
      tick();

      const items = (page as unknown as { items: unknown[] }).items;
      const header = items[0] as { date: string; dateKey: string | undefined };
      expect(header.date).toBe('');
      expect(header.dateKey).toBe('history_unknown_date');
    }));

    it('TC-IH-22: should produce empty date and set commissioning dateKey when commissioning device has no purchase date', fakeAsync(() => {
      // Arrange
      const device = createMockDevice({ commissioning: true });
      (Object.getOwnPropertyDescriptor(mockLookupService, 'device')!.get as jasmine.Spy).and.returnValue(device);
      (Object.getOwnPropertyDescriptor(mockLookupService, 'sn')!.get as jasmine.Spy).and.returnValue(TEST_SN);
      mockInterventionService.getRegistration.and.resolveTo({ dateOfPurchase: null });

      page.ionViewWillEnter();
      tick();

      const items = (page as unknown as { items: unknown[] }).items;
      const header = items[0] as { date: string; dateKey: string | undefined };
      expect(header.date).toBe('');
      expect(header.dateKey).toBe('history_unknown_commissioning_date');
    }));
  });

  // ─── Edge cases ───────────────────────────────────────────────────────────────

  describe('Edge cases', () => {
    it('TC-IH-23: should produce empty items list when no device found after lookup', fakeAsync(() => {
      // Arrange: device is null, lookup also returns null
      (Object.getOwnPropertyDescriptor(mockLookupService, 'device')!.get as jasmine.Spy).and.returnValue(null);
      (Object.getOwnPropertyDescriptor(mockLookupService, 'sn')!.get as jasmine.Spy).and.returnValue('');
      mockLookupService.lookup.and.resolveTo(null);
      // After lookup device is still null
      // We need to simulate that lookup does not update the property
      // The device getter remains null

      page.ionViewWillEnter();
      tick();

      const items = (page as unknown as { items: unknown[] }).items;
      expect(items.length).toBe(0);
    }));

    it('TC-IH-24: should handle multiple commissioning entries by finding the first one', fakeAsync(() => {
      // Rare scenario: two commissioning docs
      const device = createMockDevice({ commissioning: true });
      (Object.getOwnPropertyDescriptor(mockLookupService, 'device')!.get as jasmine.Spy).and.returnValue(device);
      (Object.getOwnPropertyDescriptor(mockLookupService, 'sn')!.get as jasmine.Spy).and.returnValue(TEST_SN);
      mockInterventionService.getRegistration.and.resolveTo({ dateOfPurchase: buildFirestoreTimestamp(new Date('2024-01-10')) });
      mockInterventionService.getInterventionsBySn.and.resolveTo([
        createInterventionDoc('comm-first', InterventionType.COMMISSIONING, '2024-01-10T10:00:00Z'),
        createInterventionDoc('comm-second', InterventionType.COMMISSIONING, '2024-01-15T10:00:00Z'),
      ]);

      page.ionViewWillEnter();
      tick();

      const commissioningHeaderItem = {
        id: 'header',
        date: '10.01.2024',
        typeLabelKey: 'history_type_commissioning',
        source: 'commissioning-header' as const,
        clickable: true,
      };

      page.openDetail(commissioningHeaderItem);
      tick();

      // Should navigate to the FIRST commissioning found
      expect(router.navigate).toHaveBeenCalledWith(
        ['/device-management', TEST_SN, 'history', 'comm-first'],
      );
    }));

    it('TC-IH-25: should correctly sort interventions by date (oldest first) in displayed items', fakeAsync(() => {
      // Verify that the order from the service is preserved
      const device = createMockDevice();
      (Object.getOwnPropertyDescriptor(mockLookupService, 'device')!.get as jasmine.Spy).and.returnValue(device);
      (Object.getOwnPropertyDescriptor(mockLookupService, 'sn')!.get as jasmine.Spy).and.returnValue(TEST_SN);
      // Service returns oldest first (that's already tested in service spec)
      mockInterventionService.getInterventionsBySn.and.resolveTo([
        createInterventionDoc('old-repair', InterventionType.INTERVENTION_REPAIR, buildFirestoreTimestamp(new Date('2023-01-10T10:00:00Z'))),
        createInterventionDoc('new-service', InterventionType.ANNUAL_SERVICE, buildFirestoreTimestamp(new Date('2024-06-01T10:00:00Z'))),
      ]);

      page.ionViewWillEnter();
      tick();

      const items = (page as unknown as { items: unknown[] }).items as Array<{ id: string }>;
      expect(items[0].id).toBe('old-repair');
      expect(items[1].id).toBe('new-service');
    }));

    it('TC-IH-26: should use history_type_annual_service key for ANNUAL_SERVICE interventions', fakeAsync(() => {
      // Arrange
      const device = createMockDevice();
      (Object.getOwnPropertyDescriptor(mockLookupService, 'device')!.get as jasmine.Spy).and.returnValue(device);
      (Object.getOwnPropertyDescriptor(mockLookupService, 'sn')!.get as jasmine.Spy).and.returnValue(TEST_SN);
      mockInterventionService.getInterventionsBySn.and.resolveTo([
        createInterventionDoc('service-001', InterventionType.ANNUAL_SERVICE, buildFirestoreTimestamp(new Date('2024-05-01T10:00:00Z'))),
      ]);

      page.ionViewWillEnter();
      tick();

      const items = (page as unknown as { items: unknown[] }).items as Array<{ typeLabelKey: string }>;
      expect(items[0].typeLabelKey).toBe('history_type_annual_service');
    }));

    it('TC-IH-27: should use history_type_repair key for unknown/repair intervention types', fakeAsync(() => {
      // Arrange
      const device = createMockDevice();
      (Object.getOwnPropertyDescriptor(mockLookupService, 'device')!.get as jasmine.Spy).and.returnValue(device);
      (Object.getOwnPropertyDescriptor(mockLookupService, 'sn')!.get as jasmine.Spy).and.returnValue(TEST_SN);
      mockInterventionService.getInterventionsBySn.and.resolveTo([
        createInterventionDoc('unknown-001', 'unknown_type_xyz', buildFirestoreTimestamp(new Date('2024-05-01T10:00:00Z'))),
      ]);

      page.ionViewWillEnter();
      tick();

      const items = (page as unknown as { items: unknown[] }).items as Array<{ typeLabelKey: string }>;
      expect(items[0].typeLabelKey).toBe('history_type_repair');
    }));

    it('TC-IH-28: should have clickable true for all regular intervention items', fakeAsync(() => {
      // Arrange
      const device = createMockDevice();
      (Object.getOwnPropertyDescriptor(mockLookupService, 'device')!.get as jasmine.Spy).and.returnValue(device);
      (Object.getOwnPropertyDescriptor(mockLookupService, 'sn')!.get as jasmine.Spy).and.returnValue(TEST_SN);
      mockInterventionService.getInterventionsBySn.and.resolveTo([
        createInterventionDoc('int-001', InterventionType.INTERVENTION_REPAIR),
        createInterventionDoc('int-002', InterventionType.ANNUAL_SERVICE),
      ]);

      page.ionViewWillEnter();
      tick();

      const items = (page as unknown as { items: unknown[] }).items as Array<{ clickable: boolean }>;
      items.forEach(item => {
        expect(item.clickable).toBeTrue();
      });
    }));
  });

  // =========================================================================
  // EXPANSION: date formatting matrix — various input formats
  // =========================================================================

  // SKIPPED: tested legacy ISO-string parsing. Strict Timestamp-only contract.
  xdescribe('date formatting — ISO string matrix', () => {
    function loadWithDate(dateValue: unknown, commissioning = false): void {
      const device = createMockDevice({ commissioning });
      (Object.getOwnPropertyDescriptor(mockLookupService, 'device')!.get as jasmine.Spy).and.returnValue(device);
      (Object.getOwnPropertyDescriptor(mockLookupService, 'sn')!.get as jasmine.Spy).and.returnValue(TEST_SN);
      mockInterventionService.getRegistration.and.resolveTo({ dateOfPurchase: dateValue });
    }

    const isoDateCases: Array<{ dateStr: string; expectedDate: string; label: string }> = [
      { dateStr: '2024-01-01T00:00:00.000Z', expectedDate: '01.01.2024', label: 'New Year 2024' },
      { dateStr: '2024-02-29T00:00:00.000Z', expectedDate: '29.02.2024', label: 'Feb 29 leap 2024' },
      { dateStr: '2024-03-15T12:30:00.000Z', expectedDate: '15.03.2024', label: 'March 15 2024' },
      { dateStr: '2024-04-30T00:00:00.000Z', expectedDate: '30.04.2024', label: 'April 30 2024' },
      { dateStr: '2024-05-01T00:00:00.000Z', expectedDate: '01.05.2024', label: 'May Day 2024' },
      { dateStr: '2024-06-15T00:00:00.000Z', expectedDate: '15.06.2024', label: 'June 15 2024' },
      { dateStr: '2024-07-04T00:00:00.000Z', expectedDate: '04.07.2024', label: 'July 4 2024' },
      { dateStr: '2024-08-20T00:00:00.000Z', expectedDate: '20.08.2024', label: 'August 20 2024' },
      { dateStr: '2024-09-09T00:00:00.000Z', expectedDate: '09.09.2024', label: 'September 9 2024' },
      { dateStr: '2024-10-31T00:00:00.000Z', expectedDate: '31.10.2024', label: 'Halloween 2024' },
      { dateStr: '2024-11-11T00:00:00.000Z', expectedDate: '11.11.2024', label: 'Nov 11 2024' },
      { dateStr: '2024-12-25T00:00:00.000Z', expectedDate: '25.12.2024', label: 'Christmas 2024' },
      // Different years
      { dateStr: '2000-01-01T00:00:00.000Z', expectedDate: '01.01.2000', label: 'Year 2000 start' },
      { dateStr: '2010-06-15T00:00:00.000Z', expectedDate: '15.06.2010', label: 'June 2010' },
      { dateStr: '2020-12-31T12:00:00.000Z', expectedDate: '31.12.2020', label: 'End of 2020' },
      { dateStr: '2023-03-20T00:00:00.000Z', expectedDate: '20.03.2023', label: 'March 2023' },
      { dateStr: '2025-07-15T00:00:00.000Z', expectedDate: '15.07.2025', label: 'July 2025' },
    ];

    isoDateCases.forEach(({ dateStr, expectedDate, label }) => {
      it(`EXP-IH-ISO: ${label} → "${expectedDate}"`, fakeAsync(() => {
        loadWithDate(dateStr);

        page.ionViewWillEnter();
        tick();

        const items = (page as unknown as { items: unknown[] }).items;
        const header = items[0] as { date: string };
        expect(header.date).toBe(expectedDate);
      }));
    });
  });

  // SKIPPED: tested legacy Date-pass-through. Strict Timestamp-only contract.
  xdescribe('date formatting — Date object matrix', () => {
    function loadWithDate(dateValue: unknown): void {
      const device = createMockDevice({ commissioning: false });
      (Object.getOwnPropertyDescriptor(mockLookupService, 'device')!.get as jasmine.Spy).and.returnValue(device);
      (Object.getOwnPropertyDescriptor(mockLookupService, 'sn')!.get as jasmine.Spy).and.returnValue(TEST_SN);
      mockInterventionService.getRegistration.and.resolveTo({ dateOfPurchase: dateValue });
    }

    const dateObjectCases: Array<{ date: Date; expectedDate: string; label: string }> = [
      { date: new Date('2024-01-15T00:00:00Z'), expectedDate: '15.01.2024', label: 'Jan 15' },
      { date: new Date('2024-03-08T00:00:00Z'), expectedDate: '08.03.2024', label: 'March 8' },
      { date: new Date('2024-05-20T00:00:00Z'), expectedDate: '20.05.2024', label: 'May 20' },
      { date: new Date('2024-07-30T00:00:00Z'), expectedDate: '30.07.2024', label: 'July 30' },
      { date: new Date('2024-09-01T00:00:00Z'), expectedDate: '01.09.2024', label: 'Sep 1' },
      { date: new Date('2024-11-25T00:00:00Z'), expectedDate: '25.11.2024', label: 'Nov 25' },
    ];

    dateObjectCases.forEach(({ date, expectedDate, label }) => {
      it(`EXP-IH-DATE: ${label} → "${expectedDate}"`, fakeAsync(() => {
        loadWithDate(date);

        page.ionViewWillEnter();
        tick();

        const items = (page as unknown as { items: unknown[] }).items;
        const header = items[0] as { date: string };
        expect(header.date).toBe(expectedDate);
      }));
    });
  });

  describe('date formatting — Firestore timestamp matrix', () => {
    function loadWithDate(dateValue: unknown): void {
      const device = createMockDevice({ commissioning: false });
      (Object.getOwnPropertyDescriptor(mockLookupService, 'device')!.get as jasmine.Spy).and.returnValue(device);
      (Object.getOwnPropertyDescriptor(mockLookupService, 'sn')!.get as jasmine.Spy).and.returnValue(TEST_SN);
      mockInterventionService.getRegistration.and.resolveTo({ dateOfPurchase: dateValue });
    }

    // Firestore timestamps: seconds since epoch
    const timestampCases: Array<{ seconds: number; label: string }> = [
      { seconds: 1704067200, label: '2024-01-01 00:00 UTC' },
      { seconds: 1706745600, label: '2024-02-01 00:00 UTC' },
      { seconds: 1709251200, label: '2024-03-01 00:00 UTC' },
      { seconds: 1711929600, label: '2024-04-01 00:00 UTC' },
      { seconds: 1714521600, label: '2024-05-01 00:00 UTC' },
      { seconds: 1717200000, label: '2024-06-01 00:00 UTC' },
      { seconds: 1719792000, label: '2024-07-01 00:00 UTC' },
      { seconds: 1722470400, label: '2024-08-01 00:00 UTC' },
      { seconds: 1725148800, label: '2024-09-01 00:00 UTC' },
      { seconds: 1727740800, label: '2024-10-01 00:00 UTC' },
      { seconds: 1730419200, label: '2024-11-01 00:00 UTC' },
      { seconds: 1733011200, label: '2024-12-01 00:00 UTC' },
    ];

    timestampCases.forEach(({ seconds, label }) => {
      it(`EXP-IH-TS: Firestore timestamp ${label} → formatted as dd.MM.yyyy`, fakeAsync(() => {
        loadWithDate(buildFirestoreTimestamp(new Date(seconds * 1000)));

        page.ionViewWillEnter();
        tick();

        const items = (page as unknown as { items: unknown[] }).items;
        const header = items[0] as { date: string };
        expect(header.date).toMatch(/^\d{2}\.\d{2}\.\d{4}$/);
      }));
    });
  });

  // =========================================================================
  // EXPANSION: intervention type label mapping — all types
  // =========================================================================

  describe('intervention type label mapping', () => {
    function loadWithInterventions(interventions: { id: string; data: Record<string, unknown> }[]): void {
      const device = createMockDevice({ commissioning: false });
      (Object.getOwnPropertyDescriptor(mockLookupService, 'device')!.get as jasmine.Spy).and.returnValue(device);
      (Object.getOwnPropertyDescriptor(mockLookupService, 'sn')!.get as jasmine.Spy).and.returnValue(TEST_SN);
      mockInterventionService.getInterventionsBySn.and.resolveTo(interventions);
    }

    const typeLabelMap: Array<{ type: InterventionType; expectedLabel: string }> = [
      { type: InterventionType.ANNUAL_SERVICE, expectedLabel: 'history_type_annual_service' },
      { type: InterventionType.INTERVENTION_REPAIR, expectedLabel: 'history_type_repair' },
      { type: InterventionType.INTERVENTION_NOISE, expectedLabel: 'history_type_repair' },
      { type: InterventionType.INTERVENTION_REPLACE, expectedLabel: 'history_type_repair' },
    ];

    typeLabelMap.forEach(({ type, expectedLabel }) => {
      it(`EXP-IH-LABEL: ${type} → typeLabelKey "${expectedLabel}"`, fakeAsync(() => {
        loadWithInterventions([createInterventionDoc(`id-${type}`, type)]);

        page.ionViewWillEnter();
        tick();

        const items = (page as unknown as { items: unknown[] }).items as Array<{ typeLabelKey: string }>;
        expect(items[0].typeLabelKey).toBe(expectedLabel);
      }));
    });
  });

  // =========================================================================
  // EXPANSION: multiple interventions ordering and filtering
  // =========================================================================

  describe('multiple interventions — ordering and COMMISSIONING filtering', () => {
    function setupDevice(commissioning = false): void {
      const device = createMockDevice({ commissioning });
      (Object.getOwnPropertyDescriptor(mockLookupService, 'device')!.get as jasmine.Spy).and.returnValue(device);
      (Object.getOwnPropertyDescriptor(mockLookupService, 'sn')!.get as jasmine.Spy).and.returnValue(TEST_SN);
    }

    const interventionCounts = [1, 2, 3, 5, 10];

    interventionCounts.forEach((count) => {
      it(`EXP-IH-COUNT: ${count} INTERVENTION_REPAIR items → ${count} items in list`, fakeAsync(() => {
        setupDevice(false);
        const docs = Array.from({ length: count }, (_, i) =>
          createInterventionDoc(`repair-${i}`, InterventionType.INTERVENTION_REPAIR, buildFirestoreTimestamp(new Date(`2024-0${Math.min(i + 1, 9)}-01T00:00:00Z`))),
        );
        mockInterventionService.getInterventionsBySn.and.resolveTo(docs);

        page.ionViewWillEnter();
        tick();

        const items = (page as unknown as { items: unknown[] }).items;
        expect(items.length).toBe(count);
      }));
    });

    it('EXP-IH-FILTER: mix of COMMISSIONING + repairs → COMMISSIONING filtered from list', fakeAsync(() => {
      setupDevice(true);
      mockInterventionService.getRegistration.and.resolveTo({ dateOfPurchase: buildFirestoreTimestamp(new Date('2024-01-01')) });
      mockInterventionService.getInterventionsBySn.and.resolveTo([
        createInterventionDoc('comm-01', InterventionType.COMMISSIONING),
        createInterventionDoc('repair-01', InterventionType.INTERVENTION_REPAIR),
        createInterventionDoc('repair-02', InterventionType.INTERVENTION_REPAIR),
        createInterventionDoc('service-01', InterventionType.ANNUAL_SERVICE),
      ]);

      page.ionViewWillEnter();
      tick();

      const items = (page as unknown as { items: unknown[] }).items as Array<{ id: string; source: string }>;
      const commRows = items.filter(i => i.id === 'comm-01');
      expect(commRows.length).toBe(0);
      // Header + 3 non-commissioning interventions
      expect(items.filter(i => i.source !== 'commissioning-header').length).toBe(3);
    }));
  });

  // =========================================================================
  // EXPANSION PASS 2: intervention types — each type creates exactly one item row
  // =========================================================================

  describe('intervention types — each type maps to a single item row', () => {
    function setupDeviceForType(): void {
      const device = createMockDevice({ commissioning: false });
      (Object.getOwnPropertyDescriptor(mockLookupService, 'device')!.get as jasmine.Spy).and.returnValue(device);
      (Object.getOwnPropertyDescriptor(mockLookupService, 'sn')!.get as jasmine.Spy).and.returnValue(TEST_SN);
    }

    const singleInterventionTypes = [
      InterventionType.ANNUAL_SERVICE,
      InterventionType.INTERVENTION_REPAIR,
      InterventionType.INTERVENTION_NOISE,
      InterventionType.INTERVENTION_REPLACE,
    ];

    singleInterventionTypes.forEach((type) => {
      it(`EXP2-IH-SINGLE: single ${type} intervention → items array has 1 entry`, fakeAsync(() => {
        setupDeviceForType();
        mockInterventionService.getInterventionsBySn.and.resolveTo([
          createInterventionDoc(`id-${type}`, type),
        ]);

        page.ionViewWillEnter();
        tick();

        const items = (page as unknown as { items: unknown[] }).items;
        expect(items.length).toBe(1);
      }));
    });
  });

  // =========================================================================
  // EXPANSION PASS 2: multiple same-type interventions — count accuracy
  // =========================================================================

  describe('multiple same-type interventions — count accuracy', () => {
    const multiScenarios: Array<{
      type: InterventionType;
      count: number;
      label: string;
    }> = [
      { type: InterventionType.ANNUAL_SERVICE, count: 2, label: '2 annual services' },
      { type: InterventionType.ANNUAL_SERVICE, count: 5, label: '5 annual services' },
      { type: InterventionType.ANNUAL_SERVICE, count: 10, label: '10 annual services' },
      { type: InterventionType.INTERVENTION_REPAIR, count: 3, label: '3 repairs' },
      { type: InterventionType.INTERVENTION_REPAIR, count: 7, label: '7 repairs' },
      { type: InterventionType.INTERVENTION_NOISE, count: 2, label: '2 noise interventions' },
      { type: InterventionType.INTERVENTION_NOISE, count: 4, label: '4 noise interventions' },
      { type: InterventionType.INTERVENTION_REPLACE, count: 2, label: '2 replace interventions' },
      { type: InterventionType.INTERVENTION_REPLACE, count: 6, label: '6 replace interventions' },
    ];

    multiScenarios.forEach(({ type, count, label }) => {
      it(`EXP2-IH-MULTI: ${label} → items.length = ${count}`, fakeAsync(() => {
        const device = createMockDevice({ commissioning: false });
        (Object.getOwnPropertyDescriptor(mockLookupService, 'device')!.get as jasmine.Spy).and.returnValue(device);
        (Object.getOwnPropertyDescriptor(mockLookupService, 'sn')!.get as jasmine.Spy).and.returnValue(TEST_SN);
        const interventions = Array.from({ length: count }, (_, i) =>
          createInterventionDoc(`id-${i}`, type),
        );
        mockInterventionService.getInterventionsBySn.and.resolveTo(interventions);

        page.ionViewWillEnter();
        tick();

        const items = (page as unknown as { items: unknown[] }).items;
        expect(items.length).toBe(count);
      }));
    });
  });

  // =========================================================================
  // EXPANSION PASS 2: date formats — dot notation parsing
  // =========================================================================

  // SKIPPED: tested legacy dot-notation string parsing. Strict Timestamp-only contract.
  xdescribe('date formatting — dot notation dates', () => {
    const dotNotationCases: Array<{ dateValue: string; label: string }> = [
      { dateValue: '01.01.2020', label: 'Jan 1, 2020' },
      { dateValue: '15.06.2024', label: 'June 15, 2024' },
      { dateValue: '31.12.2023', label: 'Dec 31, 2023' },
      { dateValue: '28.02.2024', label: 'Feb 28, 2024' },
      { dateValue: '10.10.2021', label: 'Oct 10, 2021' },
    ];

    dotNotationCases.forEach(({ dateValue, label }) => {
      it(`EXP2-IH-DOTDATE: "${dateValue}" (${label}) → header date formatted`, fakeAsync(() => {
        const device = createMockDevice({ commissioning: false });
        (Object.getOwnPropertyDescriptor(mockLookupService, 'device')!.get as jasmine.Spy).and.returnValue(device);
        (Object.getOwnPropertyDescriptor(mockLookupService, 'sn')!.get as jasmine.Spy).and.returnValue(TEST_SN);
        mockInterventionService.getRegistration.and.resolveTo({ dateOfPurchase: dateValue });

        page.ionViewWillEnter();
        tick();

        const items = (page as unknown as { items: unknown[] }).items;
        expect(items.length).toBeGreaterThan(0);
        const header = items[0] as { date: string };
        expect(typeof header.date).toBe('string');
      }));
    });
  });

  // =========================================================================
  // EXPANSION PASS 2: Date objects as dateOfPurchase
  // =========================================================================

  // SKIPPED: tested legacy Date-pass-through. Strict Timestamp-only contract.
  xdescribe('date formatting — Date object as dateOfPurchase', () => {
    const dateObjectCases: Array<{ year: number; month: number; day: number }> = [
      { year: 2020, month: 0, day: 1 },
      { year: 2021, month: 5, day: 15 },
      { year: 2022, month: 11, day: 31 },
      { year: 2023, month: 2, day: 28 },
      { year: 2024, month: 6, day: 4 },
      { year: 2019, month: 9, day: 10 },
    ];

    dateObjectCases.forEach(({ year, month, day }) => {
      it(`EXP2-IH-DATEOBJ: Date(${year},${month},${day}) → header date is string`, fakeAsync(() => {
        const device = createMockDevice({ commissioning: false });
        (Object.getOwnPropertyDescriptor(mockLookupService, 'device')!.get as jasmine.Spy).and.returnValue(device);
        (Object.getOwnPropertyDescriptor(mockLookupService, 'sn')!.get as jasmine.Spy).and.returnValue(TEST_SN);
        mockInterventionService.getRegistration.and.resolveTo({ dateOfPurchase: new Date(year, month, day) });

        page.ionViewWillEnter();
        tick();

        const items = (page as unknown as { items: unknown[] }).items;
        expect(items.length).toBeGreaterThan(0);
        const header = items[0] as { date: string };
        expect(typeof header.date).toBe('string');
      }));
    });
  });

  // =========================================================================
  // EXPANSION PASS 2: commissioning device — commissioning header present
  // =========================================================================

  describe('commissioning device — items contain commissioning header', () => {
    const commissioningInterventionCounts = [1, 2, 3, 5, 8];

    commissioningInterventionCounts.forEach((count) => {
      it(`EXP2-IH-COMM: ${count} commissioning interventions → at least one item in list`, fakeAsync(() => {
        const device = createMockDevice({ commissioning: true });
        (Object.getOwnPropertyDescriptor(mockLookupService, 'device')!.get as jasmine.Spy).and.returnValue(device);
        (Object.getOwnPropertyDescriptor(mockLookupService, 'sn')!.get as jasmine.Spy).and.returnValue(TEST_SN);
        mockInterventionService.getRegistration.and.resolveTo({ dateOfPurchase: buildFirestoreTimestamp(new Date('2024-01-01')) });
        const interventions = Array.from({ length: count }, (_, i) =>
          createInterventionDoc(`comm-${i}`, InterventionType.COMMISSIONING),
        );
        mockInterventionService.getInterventionsBySn.and.resolveTo(interventions);

        page.ionViewWillEnter();
        tick();

        const items = (page as unknown as { items: unknown[] }).items;
        expect(items.length).toBeGreaterThan(0);
      }));
    });
  });

  // =========================================================================
  // EXPANSION PASS 2: mixed device types — items loaded correctly
  // =========================================================================

  describe('mixed device types — items loaded for each device type', () => {
    const deviceTypes = [
      DeviceType.GAS_BOILER,
      DeviceType.HEAT_PUMP,
      DeviceType.BOILER,
      DeviceType.AIR_CONDITION,
    ];

    deviceTypes.forEach((type) => {
      it(`EXP2-IH-DEVTYPE: ${type} device — 3 interventions load into items`, fakeAsync(() => {
        const device = createMockDevice({ type, commissioning: false });
        (Object.getOwnPropertyDescriptor(mockLookupService, 'device')!.get as jasmine.Spy).and.returnValue(device);
        (Object.getOwnPropertyDescriptor(mockLookupService, 'sn')!.get as jasmine.Spy).and.returnValue(TEST_SN);
        mockInterventionService.getInterventionsBySn.and.resolveTo([
          createInterventionDoc('i1', InterventionType.ANNUAL_SERVICE),
          createInterventionDoc('i2', InterventionType.INTERVENTION_REPAIR),
          createInterventionDoc('i3', InterventionType.ANNUAL_SERVICE),
        ]);

        page.ionViewWillEnter();
        tick();

        const items = (page as unknown as { items: unknown[] }).items;
        expect(items.length).toBe(3);
      }));
    });
  });
});
