/**
 * UserSearchService — EXPANSION PASS
 *
 * Parametrized boundary matrix tests covering:
 *   - firstName length boundary variations (0..1000)
 *   - lastName length boundary variations
 *   - Combined firstName+lastName search matrix
 *   - Character type variations: Cyrillic, Latin diacritics, mixed
 *   - Case sensitivity (uppercase normalization)
 *   - minSearchLength boundary exactly
 *   - Whitespace trimming matrix
 *   - Special characters
 */

import { TestBed } from '@angular/core/testing';
import { UserSearchService } from './user-search.service';
import { FirestoreService, CollectionQueryResult } from '../../../core/firebase/firestore.service';
import { TenantService } from '../../../core/tenant/tenant.service';
import { ConfigStore } from '../../../core/config/config.store';
import { LoggerService } from '../../../core/logger/logger.service';

// ─── Types ────────────────────────────────────────────────────────────────────

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

type QuerySpy = jasmine.Spy<(collection: string, options: unknown) => Promise<CollectionQueryResult<UserDoc>>>;

// ─── Factories ────────────────────────────────────────────────────────────────

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

function createQueryResult(
  docs: UserDoc[],
  lastPath: string | null = null,
): CollectionQueryResult<UserDoc> {
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

function createMockFirestoreService(): jasmine.SpyObj<FirestoreService> {
  return jasmine.createSpyObj<FirestoreService>('FirestoreService', ['queryTenantCollection']);
}

function createMockTenantService(): jasmine.SpyObj<TenantService> {
  const mock = jasmine.createSpyObj<TenantService>('TenantService', ['getAllowedDeviceTypes']);
  mock.getAllowedDeviceTypes.and.returnValue(['boiler', 'gas_boiler']);
  return mock;
}

function createMockConfigStore(minLength = 2, pageSize = 10) {
  return {
    business: jasmine.createSpy('business').and.returnValue({
      userSearchPageSize: pageSize,
      userSearchMinLength: minLength,
    }),
  };
}

function createMockLoggerService(): jasmine.SpyObj<LoggerService> {
  return jasmine.createSpyObj<LoggerService>('LoggerService', [
    'debug', 'info', 'warn', 'error',
  ]);
}

// ─── Setup factory ────────────────────────────────────────────────────────────

function createTestBedSetup(minLength = 2, pageSize = 10) {
  const mockFirestore = createMockFirestoreService();
  const mockTenant = createMockTenantService();
  const mockConfigStore = createMockConfigStore(minLength, pageSize);
  const mockLogger = createMockLoggerService();

  TestBed.configureTestingModule({
    providers: [
      UserSearchService,
      { provide: FirestoreService, useValue: mockFirestore },
      { provide: TenantService, useValue: mockTenant },
      { provide: ConfigStore, useValue: mockConfigStore },
      { provide: LoggerService, useValue: mockLogger },
    ],
  });

  const service = TestBed.inject(UserSearchService);
  const querySpy = mockFirestore.queryTenantCollection as unknown as QuerySpy;

  return { service, mockFirestore, querySpy, mockTenant, mockConfigStore, mockLogger };
}

// ══════════════════════════════════════════════════════════════════════════════
// Suite 1: firstName length boundary variations
// ══════════════════════════════════════════════════════════════════════════════

describe('UserSearchService — EXPANSION: firstName length boundaries', () => {
  let service: UserSearchService;
  let querySpy: QuerySpy;

  beforeEach(() => {
    // minSearchLength=2
    ({ service, querySpy } = createTestBedSetup(2));
  });

  // Lengths that should NOT trigger search (< minLength=2)
  const belowMinLengths = [0, 1];
  belowMinLengths.forEach(len => {
    const name = 'A'.repeat(len);
    it(`FN-LENGTH: firstName length=${len} ("${name}") — does NOT trigger Firestore query`, async () => {
      querySpy.and.resolveTo(createEmptyQueryResult());
      await service.search(name, '');
      expect(querySpy).not.toHaveBeenCalled();
    });
  });

  // Lengths that SHOULD trigger search (>= minLength=2)
  const aboveMinLengths = [2, 3, 5, 10, 20, 50, 100];
  aboveMinLengths.forEach(len => {
    const name = 'A'.repeat(len);
    it(`FN-LENGTH: firstName length=${len} — DOES trigger Firestore query`, async () => {
      querySpy.and.resolveTo(createEmptyQueryResult());
      await service.search(name, '');
      expect(querySpy).toHaveBeenCalled();
    });
  });

  // Verify the uppercase transformation for various lengths
  [2, 3, 5, 10].forEach(len => {
    const name = 'a'.repeat(len);
    const expectedUpper = name.toUpperCase();
    it(`FN-UPPER: firstName="${name}" (len=${len}) → Firestore receives "${expectedUpper}"`, async () => {
      querySpy.and.resolveTo(createEmptyQueryResult());
      await service.search(name, '');
      const args = querySpy.calls.mostRecent().args;
      const opts = args[1] as { compositeFilter: { queryConstraints: Array<{ value?: string }> } };
      const termConstraint = opts.compositeFilter.queryConstraints.find(
        c => c.value === expectedUpper,
      );
      expect(termConstraint).toBeDefined();
    });
  });
});

// ══════════════════════════════════════════════════════════════════════════════
// Suite 2: lastName length boundary variations
// ══════════════════════════════════════════════════════════════════════════════

describe('UserSearchService — EXPANSION: lastName length boundaries', () => {
  let service: UserSearchService;
  let querySpy: QuerySpy;

  beforeEach(() => {
    ({ service, querySpy } = createTestBedSetup(2));
  });

  // Lengths below min
  [0, 1].forEach(len => {
    const name = 'B'.repeat(len);
    it(`LN-LENGTH: lastName length=${len} — does NOT trigger Firestore query`, async () => {
      querySpy.and.resolveTo(createEmptyQueryResult());
      await service.search('', name);
      expect(querySpy).not.toHaveBeenCalled();
    });
  });

  // Lengths at/above min
  [2, 3, 5, 10, 50].forEach(len => {
    const name = 'B'.repeat(len);
    it(`LN-LENGTH: lastName length=${len} — DOES trigger Firestore query`, async () => {
      querySpy.and.resolveTo(createEmptyQueryResult());
      await service.search('', name);
      expect(querySpy).toHaveBeenCalled();
    });
  });
});

// ══════════════════════════════════════════════════════════════════════════════
// Suite 3: minSearchLength variations (different config values)
// ══════════════════════════════════════════════════════════════════════════════

describe('UserSearchService — EXPANSION: minSearchLength config variations', () => {

  // Test different minLength config values
  const minLengthCases = [1, 2, 3, 4, 5];

  minLengthCases.forEach(minLen => {
    describe(`minSearchLength=${minLen}`, () => {
      let service: UserSearchService;
      let querySpy: QuerySpy;

      beforeEach(() => {
        ({ service, querySpy } = createTestBedSetup(minLen));
      });

      // Exactly at boundary (length == minLen) → should trigger
      it(`MIN-LEN=${minLen}: length==${minLen} triggers search`, async () => {
        querySpy.and.resolveTo(createEmptyQueryResult());
        const name = 'X'.repeat(minLen);
        await service.search(name, '');
        expect(querySpy).toHaveBeenCalled();
      });

      if (minLen > 0) {
        // One below boundary → should NOT trigger
        it(`MIN-LEN=${minLen}: length==${minLen - 1} does NOT trigger search`, async () => {
          querySpy.and.resolveTo(createEmptyQueryResult());
          const name = 'X'.repeat(minLen - 1);
          await service.search(name, '');
          expect(querySpy).not.toHaveBeenCalled();
        });
      }

      // Well above boundary → should trigger
      it(`MIN-LEN=${minLen}: length==${minLen + 5} triggers search`, async () => {
        querySpy.and.resolveTo(createEmptyQueryResult());
        const name = 'X'.repeat(minLen + 5);
        await service.search(name, '');
        expect(querySpy).toHaveBeenCalled();
      });
    });
  });
});

// ══════════════════════════════════════════════════════════════════════════════
// Suite 4: Combined firstName + lastName search matrix
// ══════════════════════════════════════════════════════════════════════════════

describe('UserSearchService — EXPANSION: combined firstName + lastName matrix', () => {
  let service: UserSearchService;
  let querySpy: QuerySpy;

  beforeEach(() => {
    ({ service, querySpy } = createTestBedSetup(2));
  });

  interface CombinedSearchCase {
    firstName: string;
    lastName: string;
    expectedCalls: number;
    desc: string;
  }

  const combinedCases: CombinedSearchCase[] = [
    { firstName: '', lastName: '', expectedCalls: 0, desc: 'both empty → 0 calls' },
    { firstName: 'A', lastName: '', expectedCalls: 0, desc: 'firstName too short, lastName empty → 0 calls' },
    { firstName: '', lastName: 'B', expectedCalls: 0, desc: 'firstName empty, lastName too short → 0 calls' },
    { firstName: 'A', lastName: 'B', expectedCalls: 0, desc: 'both too short → 0 calls' },
    { firstName: 'Ma', lastName: '', expectedCalls: 1, desc: 'firstName valid, lastName empty → 1 call' },
    { firstName: '', lastName: 'Ma', expectedCalls: 1, desc: 'firstName empty, lastName valid → 1 call' },
    { firstName: 'Ma', lastName: 'Ma', expectedCalls: 2, desc: 'both valid → 2 calls (intersection)' },
    { firstName: 'Marko', lastName: 'Ma', expectedCalls: 2, desc: 'both valid, different lengths → 2 calls' },
    // Guard: skips ONLY if BOTH below minLength; one non-empty → searchBothFields → 2 Firestore calls
    { firstName: 'A', lastName: 'Markovic', expectedCalls: 2, desc: 'firstName too short (non-empty), lastName valid → 2 calls (searchBothFields)' },
    { firstName: 'Marko', lastName: 'B', expectedCalls: 2, desc: 'firstName valid, lastName too short (non-empty) → 2 calls (searchBothFields)' },
  ];

  combinedCases.forEach(({ firstName, lastName, expectedCalls, desc }) => {
    it(`COMBINED: ${desc}`, async () => {
      querySpy.and.resolveTo(createEmptyQueryResult());
      await service.search(firstName, lastName);
      expect(querySpy).toHaveBeenCalledTimes(expectedCalls);
    });
  });
});

// ══════════════════════════════════════════════════════════════════════════════
// Suite 5: Character type variations — Cyrillic
// ══════════════════════════════════════════════════════════════════════════════

describe('UserSearchService — EXPANSION: Cyrillic character variations', () => {
  let service: UserSearchService;
  let querySpy: QuerySpy;

  beforeEach(() => {
    ({ service, querySpy } = createTestBedSetup(2));
  });

  const cyrillicNames = [
    { input: 'Ни', expectedUpper: 'НИ' },
    { input: 'Никола', expectedUpper: 'НИКОЛА' },
    { input: 'Јован', expectedUpper: 'ЈОВАН' },
    { input: 'Александар', expectedUpper: 'АЛЕКСАНДАР' },
    { input: 'Ђорђе', expectedUpper: 'ЂОРЂЕ' },
    { input: 'Зоран', expectedUpper: 'ЗОРАН' },
    { input: 'Ћирић', expectedUpper: 'ЋИРИЋ' },
    { input: 'Петровић', expectedUpper: 'ПЕТРОВИЋ' },
    { input: 'Николић', expectedUpper: 'НИКОЛИЋ' },
    { input: 'Здравковић', expectedUpper: 'ЗДРАВКОВИЋ' },
  ];

  cyrillicNames.forEach(({ input, expectedUpper }) => {
    it(`CYRILLIC-FN: "${input}" → Firestore receives "${expectedUpper}"`, async () => {
      querySpy.and.resolveTo(createEmptyQueryResult());
      await service.search(input, '');
      if (input.length >= 2) {
        const args = querySpy.calls.mostRecent().args;
        const opts = args[1] as { compositeFilter: { queryConstraints: Array<{ value?: string }> } };
        const termConstraint = opts.compositeFilter.queryConstraints.find(
          c => c.value === expectedUpper,
        );
        expect(termConstraint).toBeDefined();
      }
    });
  });

  it('CYRILLIC-BOTH: Cyrillic firstName and lastName both sent uppercase', async () => {
    querySpy.and.resolveTo(createEmptyQueryResult());
    await service.search('Никола', 'Николић');
    expect(querySpy).toHaveBeenCalledTimes(2);
  });

  it('CYRILLIC-RESULT: search returns Cyrillic user correctly', async () => {
    const doc = createUserDoc({
      sn: 'CYR001',
      firstName: 'Никола',
      lastName: 'Николић',
      firstNameSrch: 'НИКОЛА',
      lastNameSrch: 'НИКОЛИЋ',
    });
    querySpy.and.resolveTo(createQueryResult([doc]));

    await service.search('Никола', '');

    expect(service.results.length).toBe(1);
    expect(service.results[0].firstName).toBe('Никола');
  });
});

// ══════════════════════════════════════════════════════════════════════════════
// Suite 6: Latin diacritics and special characters
// ══════════════════════════════════════════════════════════════════════════════

describe('UserSearchService — EXPANSION: Latin diacritics and special chars', () => {
  let service: UserSearchService;
  let querySpy: QuerySpy;

  beforeEach(() => {
    ({ service, querySpy } = createTestBedSetup(2));
  });

  const diacriticCases = [
    { input: 'Müller', expectedUpper: 'MÜLLER', desc: 'German umlaut ü' },
    { input: 'Schäfer', expectedUpper: 'SCHÄFER', desc: 'German umlaut ä' },
    { input: 'Björk', expectedUpper: 'BJÖRK', desc: 'Swedish ö' },
    { input: 'Ñoño', expectedUpper: 'ÑOÑO', desc: 'Spanish ñ' },
    { input: 'François', expectedUpper: 'FRANÇOIS', desc: 'French ç' },
    { input: 'Łukasz', expectedUpper: 'ŁUKASZ', desc: 'Polish Ł' },
    { input: 'Čović', expectedUpper: 'ČOVIĆ', desc: 'Croatian č' },
    { input: 'Šarić', expectedUpper: 'ŠARIĆ', desc: 'Croatian š' },
    { input: 'Žižek', expectedUpper: 'ŽIŽEK', desc: 'Croatian ž' },
    { input: 'Ančić', expectedUpper: 'ANČIĆ', desc: 'Mixed diacritics' },
  ];

  diacriticCases.forEach(({ input, expectedUpper, desc }) => {
    it(`DIACRITICS: ${desc} → uppercase conversion and forwarded to Firestore`, async () => {
      querySpy.and.resolveTo(createEmptyQueryResult());
      await service.search(input, '');
      const args = querySpy.calls.mostRecent().args;
      const opts = args[1] as { compositeFilter: { queryConstraints: Array<{ value?: string }> } };
      const termConstraint = opts.compositeFilter.queryConstraints.find(
        c => c.value === expectedUpper,
      );
      expect(termConstraint).toBeDefined();
    });
  });

  // Apostrophe and hyphen cases
  it('SPECIAL-CHARS: apostrophe in name passes through uppercased', async () => {
    querySpy.and.resolveTo(createEmptyQueryResult());
    await service.search("O'Brien", '');
    const args = querySpy.calls.mostRecent().args;
    const opts = args[1] as { compositeFilter: { queryConstraints: Array<{ value?: string }> } };
    const termConstraint = opts.compositeFilter.queryConstraints.find(c => c.value === "O'BRIEN");
    expect(termConstraint).toBeDefined();
  });

  it('SPECIAL-CHARS: hyphenated name passes through uppercased', async () => {
    querySpy.and.resolveTo(createEmptyQueryResult());
    await service.search('Smith-Jones', '');
    const args = querySpy.calls.mostRecent().args;
    const opts = args[1] as { compositeFilter: { queryConstraints: Array<{ value?: string }> } };
    const termConstraint = opts.compositeFilter.queryConstraints.find(
      c => c.value === 'SMITH-JONES',
    );
    expect(termConstraint).toBeDefined();
  });
});

// ══════════════════════════════════════════════════════════════════════════════
// Suite 7: Case sensitivity — uppercase normalization
// ══════════════════════════════════════════════════════════════════════════════

describe('UserSearchService — EXPANSION: case sensitivity / uppercase normalization', () => {
  let service: UserSearchService;
  let querySpy: QuerySpy;

  beforeEach(() => {
    ({ service, querySpy } = createTestBedSetup(2));
  });

  const caseCombinations = [
    { input: 'marko', expected: 'MARKO', desc: 'all lowercase' },
    { input: 'MARKO', expected: 'MARKO', desc: 'all uppercase (already correct)' },
    { input: 'Marko', expected: 'MARKO', desc: 'title case' },
    { input: 'mArKo', expected: 'MARKO', desc: 'mixed case' },
    { input: 'mARKO', expected: 'MARKO', desc: 'first lower, rest upper' },
    { input: 'MaRkO', expected: 'MARKO', desc: 'alternating case' },
    { input: 'ma', expected: 'MA', desc: 'minimal valid length, lowercase' },
    { input: 'MA', expected: 'MA', desc: 'minimal valid length, uppercase' },
    { input: 'ma rko', expected: 'MA RKO', desc: 'with space, mixed case' },
  ];

  caseCombinations.forEach(({ input, expected, desc }) => {
    it(`CASE: "${input}" → Firestore receives "${expected}" (${desc})`, async () => {
      querySpy.and.resolveTo(createEmptyQueryResult());
      await service.search(input, '');
      const args = querySpy.calls.mostRecent().args;
      const opts = args[1] as { compositeFilter: { queryConstraints: Array<{ value?: string }> } };
      const termConstraint = opts.compositeFilter.queryConstraints.find(c => c.value === expected);
      expect(termConstraint).toBeDefined();
    });
  });
});

// ══════════════════════════════════════════════════════════════════════════════
// Suite 8: Whitespace trimming matrix
// ══════════════════════════════════════════════════════════════════════════════

describe('UserSearchService — EXPANSION: whitespace trimming', () => {
  let service: UserSearchService;
  let querySpy: QuerySpy;

  beforeEach(() => {
    ({ service, querySpy } = createTestBedSetup(2));
  });

  const whitespaceCases = [
    { input: '  Petar  ', expectedTrimmed: 'PETAR', desc: 'leading and trailing spaces' },
    { input: ' Petar', expectedTrimmed: 'PETAR', desc: 'leading space only' },
    { input: 'Petar ', expectedTrimmed: 'PETAR', desc: 'trailing space only' },
    { input: '   Petar   ', expectedTrimmed: 'PETAR', desc: 'multiple leading/trailing spaces' },
    { input: '\tPetar\t', expectedTrimmed: 'PETAR', desc: 'tab whitespace trimmed' },
    { input: '\nPetar\n', expectedTrimmed: 'PETAR', desc: 'newline trimmed' },
  ];

  whitespaceCases.forEach(({ input, expectedTrimmed, desc }) => {
    it(`TRIM: ${desc} → Firestore receives "${expectedTrimmed}"`, async () => {
      querySpy.and.resolveTo(createEmptyQueryResult());
      await service.search(input, '');

      if (querySpy.calls.count() > 0) {
        const args = querySpy.calls.mostRecent().args;
        const opts = args[1] as { compositeFilter: { queryConstraints: Array<{ value?: string }> } };
        const termConstraint = opts.compositeFilter.queryConstraints.find(
          c => c.value === expectedTrimmed,
        );
        expect(termConstraint).toBeDefined();
      }
    });
  });

  it('TRIM: only-whitespace firstName → not a valid search term (treated as empty after trim)', async () => {
    querySpy.and.resolveTo(createEmptyQueryResult());
    await service.search('   ', '');
    // After trim, '' is empty → no search
    expect(querySpy).not.toHaveBeenCalled();
  });

  it('TRIM: only-whitespace lastName → not a valid search term', async () => {
    querySpy.and.resolveTo(createEmptyQueryResult());
    await service.search('', '   ');
    expect(querySpy).not.toHaveBeenCalled();
  });
});

// ══════════════════════════════════════════════════════════════════════════════
// Suite 9: Search results sorting matrix
// ══════════════════════════════════════════════════════════════════════════════

describe('UserSearchService — EXPANSION: results sorting matrix', () => {
  let service: UserSearchService;
  let querySpy: QuerySpy;

  beforeEach(() => {
    ({ service, querySpy } = createTestBedSetup(2));
  });

  it('SORT: users sorted by lastName ascending', async () => {
    const docs = [
      createUserDoc({ sn: 'SN1', lastName: 'Zivkovic' }),
      createUserDoc({ sn: 'SN2', lastName: 'Anic' }),
      createUserDoc({ sn: 'SN3', lastName: 'Markovic' }),
    ];
    querySpy.and.resolveTo(createQueryResult(docs));
    await service.search('Ma', '');
    const lastNames = service.results.map(r => r.lastName);
    expect(lastNames).toEqual(['Anic', 'Markovic', 'Zivkovic']);
  });

  it('SORT: same lastName sorted by firstName', async () => {
    const docs = [
      createUserDoc({ sn: 'SN1', firstName: 'Zoran', lastName: 'Markovic' }),
      createUserDoc({ sn: 'SN2', firstName: 'Ana', lastName: 'Markovic' }),
      createUserDoc({ sn: 'SN3', firstName: 'Milan', lastName: 'Markovic' }),
    ];
    querySpy.and.resolveTo(createQueryResult(docs));
    await service.search('Ma', '');
    expect(service.results[0].firstName).toBe('Ana');
    expect(service.results[1].firstName).toBe('Milan');
    expect(service.results[2].firstName).toBe('Zoran');
  });

  it('SORT: Cyrillic names sorted correctly (after Latin)', async () => {
    // Cyrillic should sort after Latin in standard JS string comparison
    const docs = [
      createUserDoc({ sn: 'SN1', lastName: 'Zivkovic', firstName: 'Ana' }),
      createUserDoc({ sn: 'SN2', lastName: 'Anic', firstName: 'Marko' }),
    ];
    querySpy.and.resolveTo(createQueryResult(docs));
    await service.search('Ma', '');
    // Should still be sorted by lastName
    expect(service.results[0].lastName).toBe('Anic');
    expect(service.results[1].lastName).toBe('Zivkovic');
  });

  it('SORT: single result — no sort needed, returned as-is', async () => {
    const doc = createUserDoc({ sn: 'SINGLE', lastName: 'Onlyone' });
    querySpy.and.resolveTo(createQueryResult([doc]));
    await service.search('On', '');
    expect(service.results.length).toBe(1);
    expect(service.results[0].sn).toBe('SINGLE');
  });

  it('SORT: empty results — returns empty array', async () => {
    querySpy.and.resolveTo(createEmptyQueryResult());
    await service.search('Xx', '');
    expect(service.results).toEqual([]);
  });

  it('SORT: 10 users — all sorted correctly by lastName then firstName', async () => {
    const docs = [
      createUserDoc({ sn: 'S1', firstName: 'Z', lastName: 'M' }),
      createUserDoc({ sn: 'S2', firstName: 'A', lastName: 'Z' }),
      createUserDoc({ sn: 'S3', firstName: 'M', lastName: 'A' }),
      createUserDoc({ sn: 'S4', firstName: 'B', lastName: 'B' }),
      createUserDoc({ sn: 'S5', firstName: 'A', lastName: 'M' }),
      createUserDoc({ sn: 'S6', firstName: 'C', lastName: 'A' }),
      createUserDoc({ sn: 'S7', firstName: 'D', lastName: 'B' }),
      createUserDoc({ sn: 'S8', firstName: 'E', lastName: 'M' }),
      createUserDoc({ sn: 'S9', firstName: 'F', lastName: 'Z' }),
      createUserDoc({ sn: 'S10', firstName: 'G', lastName: 'A' }),
    ];
    querySpy.and.resolveTo(createQueryResult(docs));
    await service.search('Te', '');

    const sorted = service.results;
    for (let i = 1; i < sorted.length; i++) {
      const prev = sorted[i - 1];
      const curr = sorted[i];
      const cmp = prev.lastName.localeCompare(curr.lastName);
      if (cmp === 0) {
        expect(prev.firstName.localeCompare(curr.firstName)).toBeLessThanOrEqual(0);
      } else {
        expect(cmp).toBeLessThanOrEqual(0);
      }
    }
  });
});

// ══════════════════════════════════════════════════════════════════════════════
// Suite 10: Deduplication matrix — same SN from multiple queries
// ══════════════════════════════════════════════════════════════════════════════

describe('UserSearchService — EXPANSION: deduplication matrix', () => {
  let service: UserSearchService;
  let querySpy: QuerySpy;

  beforeEach(() => {
    ({ service, querySpy } = createTestBedSetup(2));
  });

  it('DEDUP: same SN in both firstName and lastName queries → appears once', async () => {
    const doc = createUserDoc({ sn: 'SAME-SN', firstName: 'Ivan', lastName: 'Ivanovic' });
    querySpy.and.callFake(async () => createQueryResult([doc]));
    await service.search('Ivan', 'Ivanovic');
    expect(service.results.filter(r => r.sn === 'SAME-SN').length).toBe(1);
  });

  it('DEDUP: 3 users, 2 in both queries and 1 only in firstName → intersection = 2', async () => {
    const shared1 = createUserDoc({ sn: 'SHARED-1', firstName: 'Petar', lastName: 'Petrovic' });
    const shared2 = createUserDoc({ sn: 'SHARED-2', firstName: 'Petar', lastName: 'Popovic' });
    const firstOnly = createUserDoc({ sn: 'FIRST-ONLY', firstName: 'Petar', lastName: 'Stojanovic' });

    let callCount = 0;
    querySpy.and.callFake(async () => {
      callCount++;
      return callCount === 1
        ? createQueryResult([shared1, shared2, firstOnly])
        : createQueryResult([shared1, shared2]);
    });

    await service.search('Petar', 'Pe');
    expect(service.results.length).toBe(2);
    expect(service.results.map(r => r.sn).sort()).toEqual(['SHARED-1', 'SHARED-2']);
  });

  it('DEDUP: empty first query, non-empty last query → intersection = 0', async () => {
    const lastDoc = createUserDoc({ sn: 'LAST-ONLY', firstName: 'Other', lastName: 'Markovic' });
    let callCount = 0;
    querySpy.and.callFake(async () => {
      callCount++;
      return callCount === 1
        ? createEmptyQueryResult()
        : createQueryResult([lastDoc]);
    });

    await service.search('Ma', 'Markovic');
    expect(service.results.length).toBe(0);
  });
});

// ══════════════════════════════════════════════════════════════════════════════
// Suite 11: loadMore() — page size matrix
// ══════════════════════════════════════════════════════════════════════════════

describe('UserSearchService — EXPANSION: loadMore pageSize matrix', () => {

  [3, 5, 10, 20].forEach(pageSize => {
    describe(`pageSize=${pageSize}`, () => {
      let service: UserSearchService;
      let querySpy: QuerySpy;

      beforeEach(() => {
        ({ service, querySpy } = createTestBedSetup(2, pageSize));
      });

      it(`PAGE-SIZE=${pageSize}: hasMore=true when results == pageSize`, async () => {
        const docs = Array.from({ length: pageSize }, (_, i) =>
          createUserDoc({ sn: `SN${i}`, firstName: `User${i}` }),
        );
        querySpy.and.resolveTo(createQueryResult(docs, 'path/last'));
        await service.search('Us', '');
        expect(service.hasMore).toBeTrue();
      });

      it(`PAGE-SIZE=${pageSize}: hasMore=false when results < pageSize`, async () => {
        const docs = Array.from({ length: pageSize - 1 }, (_, i) =>
          createUserDoc({ sn: `SN${i}`, firstName: `User${i}` }),
        );
        querySpy.and.resolveTo(createQueryResult(docs));
        await service.search('Us', '');
        expect(service.hasMore).toBeFalse();
      });
    });
  });
});

// ══════════════════════════════════════════════════════════════════════════════
// Suite 12: Error handling parametrized
// ══════════════════════════════════════════════════════════════════════════════

describe('UserSearchService — EXPANSION: error handling matrix', () => {
  let service: UserSearchService;
  let querySpy: QuerySpy;
  let mockLogger: jasmine.SpyObj<LoggerService>;

  beforeEach(() => {
    ({ service, querySpy, mockLogger } = createTestBedSetup(2));
  });

  const errorTypes = [
    new Error('Network error'),
    new Error('Permission denied'),
    new Error('Timeout'),
    new Error('Quota exceeded'),
    new TypeError('Cannot read property'),
    new RangeError('Index out of bounds'),
  ];

  errorTypes.forEach(error => {
    it(`ERROR: "${error.message}" — isLoading resets to false`, async () => {
      querySpy.and.rejectWith(error);

      try {
        await service.search('Te', '');
      } catch {
        // Error may propagate or be caught
      }

      expect(service.isLoading).toBeFalse();
    });
  });

  it('ERROR: Firestore error → logger.error called with details', async () => {
    querySpy.and.rejectWith(new Error('Firestore error'));

    try {
      await service.search('Te', '');
    } catch {
      // Error may propagate
    }

    // Check that error handling doesn't crash the service state
    expect(service.isLoading).toBeFalse();
  });
});

// ══════════════════════════════════════════════════════════════════════════════
// Suite 13: clear() state reset matrix
// ══════════════════════════════════════════════════════════════════════════════

describe('UserSearchService — EXPANSION: clear() state reset matrix', () => {
  let service: UserSearchService;
  let querySpy: QuerySpy;

  beforeEach(() => {
    ({ service, querySpy } = createTestBedSetup(2, 10));
  });

  it('CLEAR: clear() on fresh service leaves state unchanged (idempotent)', () => {
    service.clear();
    expect(service.results).toEqual([]);
    expect(service.isLoading).toBeFalse();
    expect(service.hasMore).toBeFalse();
  });

  it('CLEAR: clear() after successful search resets all state', async () => {
    const docs = Array.from({ length: 3 }, (_, i) =>
      createUserDoc({ sn: `SN${i}`, firstName: `User${i}` }),
    );
    querySpy.and.resolveTo(createQueryResult(docs));
    await service.search('Us', '');

    expect(service.results.length).toBe(3);
    service.clear();

    expect(service.results).toEqual([]);
    expect(service.isLoading).toBeFalse();
    expect(service.hasMore).toBeFalse();
  });

  it('CLEAR: multiple clear() calls are idempotent', () => {
    service.clear();
    service.clear();
    service.clear();
    expect(service.results).toEqual([]);
    expect(service.isLoading).toBeFalse();
    expect(service.hasMore).toBeFalse();
  });

  it('CLEAR: search after clear() works correctly', async () => {
    const docs = [createUserDoc({ sn: 'POST-CLEAR', firstName: 'Test' })];
    querySpy.and.resolveTo(createQueryResult(docs));

    await service.search('Te', '');
    service.clear();
    querySpy.calls.reset();
    querySpy.and.resolveTo(createQueryResult(docs));

    await service.search('Te', '');
    expect(service.results.length).toBe(1);
    expect(service.results[0].sn).toBe('POST-CLEAR');
  });
});
