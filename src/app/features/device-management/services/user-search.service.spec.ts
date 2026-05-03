import { TestBed } from '@angular/core/testing';
import { UserSearchService } from './user-search.service';
import { FirestoreService, CollectionQueryResult } from '../../../core/firebase/firestore.service';
import { TenantService } from '../../../core/tenant/tenant.service';
import { ConfigStore } from '../../../core/config/config.store';
import { LoggerService } from '../../../core/logger/logger.service';

// ─── Helper types ─────────────────────────────────────────────────────────────

interface UserDoc {
  sn: string;
  firstName: string;
  lastName: string;
  firstNameSrch: string;
  lastNameSrch: string;
  streetName: string;
  homeNumber: string;
  city: string;
  deviceType: string;
  [key: string]: unknown;
}

// ─── Helper factories ─────────────────────────────────────────────────────────

function createUserDoc(overrides: Partial<UserDoc> = {}): UserDoc {
  return {
    sn: 'SN001',
    firstName: 'Marko',
    lastName: 'Markovic',
    firstNameSrch: 'MARKO',
    lastNameSrch: 'MARKOVIC',
    streetName: 'Ulica BB',
    homeNumber: '1',
    city: 'Beograd',
    deviceType: 'boiler',
    ...overrides,
  };
}

function createQueryResult(docs: UserDoc[], lastPath: string | null = null): CollectionQueryResult<UserDoc> {
  const documents = docs.map((data, i) => ({
    id: `doc${i}`,
    path: lastPath ?? `tenants/test/users/doc${i}`,
    data,
  }));
  return {
    documents,
    lastDocumentPath: documents.length > 0 ? documents[documents.length - 1].path : null,
  };
}

function createEmptyQueryResult(): CollectionQueryResult<UserDoc> {
  return { documents: [], lastDocumentPath: null };
}

// ─── Type helper: bypass generic constraint on queryTenantCollection ──────────
// queryTenantCollection is generic. Jasmine callFake cannot infer T at
// test time, so we cast to a plain Spy to set up call-fake responses.
type QuerySpy = jasmine.Spy<(collection: string, options: unknown) => Promise<CollectionQueryResult<UserDoc>>>;

// ─── Mock factories ───────────────────────────────────────────────────────────

function createMockFirestoreService(): jasmine.SpyObj<FirestoreService> {
  return jasmine.createSpyObj<FirestoreService>('FirestoreService', [
    'queryTenantCollection',
  ]);
}

function createMockTenantService(): jasmine.SpyObj<TenantService> {
  const mock = jasmine.createSpyObj<TenantService>('TenantService', [
    'getAllowedDeviceTypes',
  ]);
  mock.getAllowedDeviceTypes.and.returnValue(['boiler', 'gas_boiler']);
  return mock;
}

function createMockConfigStore() {
  return {
    business: jasmine.createSpy('business').and.returnValue({
      userSearchPageSize: 3,
      userSearchMinLength: 2,
    }),
  };
}

function createMockLoggerService(): jasmine.SpyObj<LoggerService> {
  return jasmine.createSpyObj<LoggerService>('LoggerService', [
    'debug', 'info', 'warn', 'error',
  ]);
}

// ─── Suite ────────────────────────────────────────────────────────────────────

describe('UserSearchService', () => {
  let service: UserSearchService;
  let mockFirestore: jasmine.SpyObj<FirestoreService>;
  let querySpy: QuerySpy;
  let mockTenant: jasmine.SpyObj<TenantService>;
  let mockConfigStore: ReturnType<typeof createMockConfigStore>;
  let mockLogger: jasmine.SpyObj<LoggerService>;

  beforeEach(() => {
    mockFirestore = createMockFirestoreService();
    mockTenant    = createMockTenantService();
    mockConfigStore = createMockConfigStore();
    mockLogger    = createMockLoggerService();

    TestBed.configureTestingModule({
      providers: [
        UserSearchService,
        { provide: FirestoreService, useValue: mockFirestore },
        { provide: TenantService,    useValue: mockTenant },
        { provide: ConfigStore,      useValue: mockConfigStore },
        { provide: LoggerService,    useValue: mockLogger },
      ],
    });

    service  = TestBed.inject(UserSearchService);
    // Cast once; reused in every test to set up callFake without TS errors.
    querySpy = mockFirestore.queryTenantCollection as unknown as QuerySpy;
  });

  // ─── 1. search() — single field firstName ─────────────────────────────────

  describe('search() — single field firstName', () => {

    it('1. successful search by firstName returns results array', async () => {
      const doc = createUserDoc({ sn: 'SN001', firstName: 'Marko', firstNameSrch: 'MARKO' });
      querySpy.and.resolveTo(createQueryResult([doc]));

      await service.search('Marko', '');

      expect(service.results.length).toBe(1);
      expect(service.results[0].sn).toBe('SN001');
      expect(service.results[0].firstName).toBe('Marko');
    });

    it('2. min length guard — firstName shorter than minSearchLength does not trigger search', async () => {
      querySpy.and.resolveTo(createEmptyQueryResult());

      await service.search('M', '');   // length 1 < minSearchLength 2

      expect(mockFirestore.queryTenantCollection).not.toHaveBeenCalled();
      expect(service.results.length).toBe(0);
    });

    it('3. empty firstName does not trigger search', async () => {
      querySpy.and.resolveTo(createEmptyQueryResult());

      await service.search('', '');

      expect(mockFirestore.queryTenantCollection).not.toHaveBeenCalled();
    });
  });

  // ─── 2. search() — single field lastName ──────────────────────────────────

  describe('search() — single field lastName', () => {

    it('4. successful search by lastName only returns results', async () => {
      const doc = createUserDoc({ sn: 'SN002', lastName: 'Nikolic', lastNameSrch: 'NIKOLIC' });
      querySpy.and.resolveTo(createQueryResult([doc]));

      await service.search('', 'Nikolic');

      expect(service.results.length).toBe(1);
      expect(service.results[0].lastName).toBe('Nikolic');
    });

    it('5. min length guard — lastName shorter than minSearchLength does not trigger search', async () => {
      querySpy.and.resolveTo(createEmptyQueryResult());

      await service.search('', 'N');  // length 1 < 2

      expect(mockFirestore.queryTenantCollection).not.toHaveBeenCalled();
    });
  });

  // ─── 3. search() — both fields (intersection) ─────────────────────────────

  describe('search() — both fields (intersection)', () => {

    it('6. returns intersection — only users present in both firstName and lastName result sets', async () => {
      const sharedDoc  = createUserDoc({ sn: 'SN010', firstName: 'Petar', lastName: 'Petrovic', firstNameSrch: 'PETAR', lastNameSrch: 'PETROVIC' });
      const onlyFirst  = createUserDoc({ sn: 'SN011', firstName: 'Petar', lastName: 'Jovic',    firstNameSrch: 'PETAR', lastNameSrch: 'JOVIC' });

      // firstName query (call 1) returns both; lastName query (call 2) returns only sharedDoc
      let callCount = 0;
      querySpy.and.callFake(async () => {
        callCount++;
        return callCount === 1
          ? createQueryResult([sharedDoc, onlyFirst])
          : createQueryResult([sharedDoc]);
      });

      await service.search('Petar', 'Petrovic');

      expect(service.results.length).toBe(1);
      expect(service.results[0].sn).toBe('SN010');
    });

    it('7. empty intersection — returns empty array when no user matches both fields', async () => {
      const firstDoc = createUserDoc({ sn: 'SN020', firstName: 'Ana',      lastName: 'Anic' });
      const lastDoc  = createUserDoc({ sn: 'SN021', firstName: 'Branislav', lastName: 'Markovic' });

      let callCount = 0;
      querySpy.and.callFake(async () => {
        callCount++;
        return callCount === 1
          ? createQueryResult([firstDoc])
          : createQueryResult([lastDoc]);
      });

      await service.search('Ana', 'Markovic');

      expect(service.results.length).toBe(0);
    });

    it('8. both fields required — two Firestore calls are made when both firstName and lastName are provided', async () => {
      querySpy.and.resolveTo(createEmptyQueryResult());

      await service.search('Marko', 'Markovic');

      expect(mockFirestore.queryTenantCollection).toHaveBeenCalledTimes(2);
    });
  });

  // ─── 4. Stale search cancellation ─────────────────────────────────────────

  describe('stale search cancellation', () => {

    it('9. newer search supersedes older — stale results are not added to results', async () => {
      let resolveFirst!: (value: CollectionQueryResult<UserDoc>) => void;
      const firstPromise = new Promise<CollectionQueryResult<UserDoc>>(res => { resolveFirst = res; });

      const staleDoc = createUserDoc({ sn: 'STALE', firstName: 'Old' });
      const freshDoc = createUserDoc({ sn: 'FRESH', firstName: 'New' });

      let callCount = 0;
      querySpy.and.callFake(() => {
        callCount++;
        if (callCount === 1) return firstPromise;
        return Promise.resolve(createQueryResult([freshDoc]));
      });

      // Start first search but do not await yet
      const firstSearch = service.search('Old', '');
      // Second search supersedes the first
      await service.search('New', '');

      // Resolve the stale first search after the second has settled
      resolveFirst(createQueryResult([staleDoc]));
      await firstSearch;

      expect(service.results.every(r => r.sn !== 'STALE')).toBeTrue();
      expect(service.results.some(r => r.sn === 'FRESH')).toBeTrue();
    });

    it('10. stale search error is not propagated — logger.error not called for stale searchId', async () => {
      let rejectFirst!: (reason: unknown) => void;
      const failingPromise = new Promise<CollectionQueryResult<UserDoc>>((_, rej) => { rejectFirst = rej; });

      const freshDoc = createUserDoc({ sn: 'FRESH2', firstName: 'New' });

      let callCount = 0;
      querySpy.and.callFake(() => {
        callCount++;
        if (callCount === 1) return failingPromise;
        return Promise.resolve(createQueryResult([freshDoc]));
      });

      const firstSearch = service.search('Fail', '');
      await service.search('New', '');

      rejectFirst(new Error('stale network error'));
      await firstSearch.catch(() => { /* expected rejection from stale */ });

      // The stale searchId !== currentSearchId so logger.error must NOT be called
      expect(mockLogger.error).not.toHaveBeenCalled();
      expect(service.results.length).toBe(1);
    });
  });

  // ─── 5. loadMore() ────────────────────────────────────────────────────────

  describe('loadMore()', () => {

    it('11. loads next page using lastDocumentPath cursor', async () => {
      const page1 = [
        createUserDoc({ sn: 'SN100', firstName: 'Adam' }),
        createUserDoc({ sn: 'SN101', firstName: 'Boris' }),
        createUserDoc({ sn: 'SN102', firstName: 'Cerko' }),
      ];
      const page2 = [createUserDoc({ sn: 'SN103', firstName: 'Damir' })];

      let callCount = 0;
      querySpy.and.callFake(async () => {
        callCount++;
        return callCount === 1
          ? createQueryResult(page1, 'path/doc2')
          : createQueryResult(page2);
      });

      await service.search('Ad', '');
      expect(service.hasMore).toBeTrue();

      await service.loadMore();

      expect(service.results.length).toBe(4);
      expect(mockFirestore.queryTenantCollection).toHaveBeenCalledTimes(2);
    });

    it('12. appends to existing results without duplicates', async () => {
      const page1 = [
        createUserDoc({ sn: 'SN200', firstName: 'Ante' }),
        createUserDoc({ sn: 'SN201', firstName: 'Branka' }),
        createUserDoc({ sn: 'SN202', firstName: 'Cveta' }),
      ];
      const page2 = [createUserDoc({ sn: 'SN203', firstName: 'Dragan' })];

      let callCount = 0;
      querySpy.and.callFake(async () => {
        callCount++;
        return callCount === 1
          ? createQueryResult(page1)
          : createQueryResult(page2);
      });

      await service.search('An', '');
      const afterFirst = service.results.length;
      await service.loadMore();

      expect(service.results.length).toBe(afterFirst + 1);
      const sns = service.results.map(r => r.sn);
      expect(new Set(sns).size).toBe(sns.length);
    });

    it('13. no-op when hasMore is false', async () => {
      querySpy.and.resolveTo(createQueryResult([createUserDoc({ sn: 'SN300' })]));

      await service.search('Ma', '');
      expect(service.hasMore).toBeFalse();

      await service.loadMore();

      // Only 1 call from search(); loadMore should have been a no-op
      expect(mockFirestore.queryTenantCollection).toHaveBeenCalledTimes(1);
    });
  });

  // ─── 6. clear() ───────────────────────────────────────────────────────────

  describe('clear()', () => {

    it('14. resets results, isLoading, and hasMore to initial values', async () => {
      const page1 = [
        createUserDoc({ sn: 'SN400', firstName: 'Aaa' }),
        createUserDoc({ sn: 'SN401', firstName: 'Bbb' }),
        createUserDoc({ sn: 'SN402', firstName: 'Ccc' }),
      ];
      querySpy.and.resolveTo(createQueryResult(page1));

      await service.search('Aa', '');

      service.clear();

      expect(service.results).toEqual([]);
      expect(service.isLoading).toBeFalse();
      expect(service.hasMore).toBeFalse();
    });

    it('15. resets lastDocumentPath — subsequent search starts from the beginning (no startAfter)', async () => {
      const page1 = [
        createUserDoc({ sn: 'SN500', firstName: 'Alpha' }),
        createUserDoc({ sn: 'SN501', firstName: 'Beta' }),
        createUserDoc({ sn: 'SN502', firstName: 'Gamma' }),
      ];
      const freshDocs = [createUserDoc({ sn: 'SN503', firstName: 'Delta' })];

      let callCount = 0;
      querySpy.and.callFake(async (_collection: string, options: unknown) => {
        callCount++;
        if (callCount === 1) {
          return createQueryResult(page1, 'path/page1last');
        }
        // After clear the new search must NOT carry a startAfter constraint
        const opts = options as { queryConstraints?: Array<{ type: string }> };
        const hasStartAfter = (opts.queryConstraints ?? []).some(c => c.type === 'startAfter');
        expect(hasStartAfter).toBeFalse();
        return createQueryResult(freshDocs);
      });

      await service.search('Al', '');
      service.clear();
      await service.search('De', '');

      expect(service.results.length).toBe(1);
      expect(service.results[0].sn).toBe('SN503');
    });
  });

  // ─── 7. mergeResults (deduplication and sorting) ─────────────────────────

  describe('mergeResults (deduplication and sorting)', () => {

    it('16. deduplication — same SN from both field queries is not added twice', async () => {
      const doc = createUserDoc({ sn: 'DUPESN', firstName: 'Ivan', lastName: 'Ivanovic', firstNameSrch: 'IVAN', lastNameSrch: 'IVANOVIC' });

      // Both firstName and lastName queries return the same doc
      querySpy.and.callFake(async () => createQueryResult([doc]));

      await service.search('Ivan', 'Ivanovic');

      expect(service.results.filter(r => r.sn === 'DUPESN').length).toBe(1);
    });

    it('17. results are sorted alphabetically by lastName then firstName', async () => {
      const docs = [
        createUserDoc({ sn: 'SN600', firstName: 'Zoran', lastName: 'Zivkovic' }),
        createUserDoc({ sn: 'SN601', firstName: 'Ana',   lastName: 'Anic' }),
        createUserDoc({ sn: 'SN602', firstName: 'Milan', lastName: 'Milic' }),
      ];
      querySpy.and.resolveTo(createQueryResult(docs));

      await service.search('Za', '');

      expect(service.results[0].lastName).toBe('Anic');
      expect(service.results[1].lastName).toBe('Milic');
      expect(service.results[2].lastName).toBe('Zivkovic');
    });
  });

  // ─── 8. Edge cases ────────────────────────────────────────────────────────

  describe('edge cases', () => {

    it('18. business() returns null — service throws due to non-null assertion (BUG)', async () => {
      // The service uses this.configStore.business()! — if business() returns null,
      // accessing .userSearchPageSize or .userSearchMinLength on null throws a TypeError.
      // This is a known design bug documented in src/app/testing/BUGS-FROM-TEST-PLAN.md.
      mockConfigStore.business.and.returnValue(null);

      let threw = false;
      try {
        await service.search('Marko', '');
      } catch {
        threw = true;
      }

      // The bug is confirmed: service throws instead of handling null gracefully
      expect(threw).toBeTrue();
    });

    it('19. configStore returns undefined — service throws when business config is not yet loaded', async () => {
      mockConfigStore.business.and.returnValue(undefined as unknown as null);

      let threw = false;
      try {
        await service.search('Te', '');
      } catch {
        threw = true;
      }
      expect(threw).toBeTrue();
    });

    it('20. multiple sequential searches — only results from the latest search are present', async () => {
      const firstDoc  = createUserDoc({ sn: 'SEQ001', firstName: 'First' });
      const secondDoc = createUserDoc({ sn: 'SEQ002', firstName: 'Second' });

      let callCount = 0;
      querySpy.and.callFake(async () => {
        callCount++;
        return callCount === 1
          ? createQueryResult([firstDoc])
          : createQueryResult([secondDoc]);
      });

      await service.search('Fi', '');
      expect(service.results[0].sn).toBe('SEQ001');

      await service.search('Se', '');
      expect(service.results.length).toBe(1);
      expect(service.results[0].sn).toBe('SEQ002');
    });

    it('21. search after reset — works correctly and returns fresh results', async () => {
      const doc = createUserDoc({ sn: 'AFTER_RESET', firstName: 'Test' });
      querySpy.and.resolveTo(createQueryResult([doc]));

      await service.search('Te', '');
      service.clear();

      querySpy.calls.reset();
      querySpy.and.resolveTo(createQueryResult([doc]));

      await service.search('Te', '');

      expect(service.results.length).toBe(1);
      expect(service.results[0].sn).toBe('AFTER_RESET');
    });

    it('22. (bonus) Cyrillic characters — terms are uppercased and forwarded to Firestore', async () => {
      const doc = createUserDoc({ sn: 'CYR001', firstName: 'Никола', firstNameSrch: 'НИКОЛА' });
      querySpy.and.resolveTo(createQueryResult([doc]));

      await service.search('Никола', '');

      expect(mockFirestore.queryTenantCollection).toHaveBeenCalled();

      const callArgs = querySpy.calls.mostRecent().args;
      const opts = callArgs[1] as { compositeFilter: { queryConstraints: Array<{ value?: string }> } };
      const termConstraint = opts.compositeFilter.queryConstraints.find(c => c.value === 'НИКОЛА');
      expect(termConstraint).toBeDefined();
    });

    it('23. (bonus) whitespace is trimmed before search', async () => {
      const doc = createUserDoc({ sn: 'WS001', firstName: 'Petar' });
      querySpy.and.resolveTo(createQueryResult([doc]));

      await service.search('  Petar  ', '');

      expect(mockFirestore.queryTenantCollection).toHaveBeenCalled();

      const callArgs = querySpy.calls.mostRecent().args;
      const opts = callArgs[1] as { compositeFilter: { queryConstraints: Array<{ value?: string }> } };
      const termConstraint = opts.compositeFilter.queryConstraints.find(c => c.value === 'PETAR');
      expect(termConstraint).toBeDefined();
    });

    it('24. (bonus) special chars — apostrophe in search term is passed uppercased without crash', async () => {
      querySpy.and.resolveTo(createEmptyQueryResult());

      await service.search("O'Brien", '');

      expect(mockFirestore.queryTenantCollection).toHaveBeenCalled();

      const callArgs = querySpy.calls.mostRecent().args;
      const opts = callArgs[1] as { compositeFilter: { queryConstraints: Array<{ value?: string }> } };
      const termConstraint = opts.compositeFilter.queryConstraints.find(c => c.value === "O'BRIEN");
      expect(termConstraint).toBeDefined();
    });
  });
});
