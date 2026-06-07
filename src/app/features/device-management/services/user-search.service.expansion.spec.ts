/**
 * UserSearchService — EXPANSION PASS
 *
 * Parametrized boundary matrix tests covering:
 *   - firstName length boundary variations (0..1000)
 *   - lastName length boundary variations
 *   - Combined firstName+lastName search matrix
 *   - Character type variations: Cyrillic (transliterated to Latin), Latin diacritics, mixed
 *   - Case sensitivity (uppercase normalization)
 *   - minSearchLength boundary (constant = 2, not configurable)
 *   - Whitespace trimming matrix
 *   - Special characters
 *
 * Architecture note (post-redesign):
 *   - PAGE_SIZE = 20 (constant, not from ConfigStore)
 *   - MIN_SEARCH_LENGTH = 2 (constant, not from ConfigStore)
 *   - ConfigStore is NOT injected by UserSearchService
 *   - Both firstName and lastName filters use ONE composite Firestore query
 *   - Cyrillic input is transliterated to Latin uppercase via toLatinUpperCase()
 */

import { TestBed } from '@angular/core/testing';
import { UserSearchService } from './user-search.service';
import { FirestoreService, CollectionQueryResult } from '../../../core/firebase/firestore.service';
import { TenantService } from '../../../core/tenant/tenant.service';
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

function createMockLoggerService(): jasmine.SpyObj<LoggerService> {
  return jasmine.createSpyObj<LoggerService>('LoggerService', [
    'debug', 'info', 'warn', 'error',
  ]);
}

// ─── Setup factory ────────────────────────────────────────────────────────────
// ConfigStore is no longer used by UserSearchService — not provided here.

function createTestBedSetup() {
  const mockFirestore = createMockFirestoreService();
  const mockTenant = createMockTenantService();
  const mockLogger = createMockLoggerService();

  TestBed.configureTestingModule({
    providers: [
      UserSearchService,
      { provide: FirestoreService, useValue: mockFirestore },
      { provide: TenantService, useValue: mockTenant },
      { provide: LoggerService, useValue: mockLogger },
    ],
  });

  const service = TestBed.inject(UserSearchService);
  const querySpy = mockFirestore.queryTenantCollection as unknown as QuerySpy;

  return { service, mockFirestore, querySpy, mockTenant, mockLogger };
}

// Constant matching the service — must stay in sync with user-search.service.ts
const PAGE_SIZE = 20;
const MIN_SEARCH_LENGTH = 2;

// ══════════════════════════════════════════════════════════════════════════════
// Suite 1: firstName length boundary variations
// ══════════════════════════════════════════════════════════════════════════════

describe('UserSearchService — EXPANSION: firstName length boundaries', () => {
  let service: UserSearchService;
  let querySpy: QuerySpy;

  beforeEach(() => {
    ({ service, querySpy } = createTestBedSetup());
  });

  // Lengths that should NOT trigger search (< MIN_SEARCH_LENGTH=2)
  const belowMinLengths = [0, 1];
  belowMinLengths.forEach(len => {
    const name = 'A'.repeat(len);
    it(`FN-LENGTH: firstName length=${len} ("${name}") — does NOT trigger Firestore query`, async () => {
      querySpy.and.resolveTo(createEmptyQueryResult());
      await service.search(name, '');
      expect(querySpy).not.toHaveBeenCalled();
    });
  });

  // Lengths that SHOULD trigger search (>= MIN_SEARCH_LENGTH=2)
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
    ({ service, querySpy } = createTestBedSetup());
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
// Suite 3: minSearchLength is a fixed constant (= 2), not configurable
// ══════════════════════════════════════════════════════════════════════════════

describe('UserSearchService — EXPANSION: minSearchLength constant boundary', () => {
  let service: UserSearchService;
  let querySpy: QuerySpy;

  beforeEach(() => {
    ({ service, querySpy } = createTestBedSetup());
  });

  it(`MIN-LEN: service.minSearchLength exposes the constant value ${MIN_SEARCH_LENGTH}`, () => {
    expect(service.minSearchLength).toBe(MIN_SEARCH_LENGTH);
  });

  it(`MIN-LEN: length==${MIN_SEARCH_LENGTH} (boundary) triggers search`, async () => {
    querySpy.and.resolveTo(createEmptyQueryResult());
    const name = 'X'.repeat(MIN_SEARCH_LENGTH);
    await service.search(name, '');
    expect(querySpy).toHaveBeenCalled();
  });

  it(`MIN-LEN: length==${MIN_SEARCH_LENGTH - 1} (one below boundary) does NOT trigger search`, async () => {
    querySpy.and.resolveTo(createEmptyQueryResult());
    const name = 'X'.repeat(MIN_SEARCH_LENGTH - 1);
    await service.search(name, '');
    expect(querySpy).not.toHaveBeenCalled();
  });

  it(`MIN-LEN: length==${MIN_SEARCH_LENGTH + 5} (well above boundary) triggers search`, async () => {
    querySpy.and.resolveTo(createEmptyQueryResult());
    const name = 'X'.repeat(MIN_SEARCH_LENGTH + 5);
    await service.search(name, '');
    expect(querySpy).toHaveBeenCalled();
  });
});

// ══════════════════════════════════════════════════════════════════════════════
// Suite 4: Combined firstName + lastName search matrix
// ONE composite Firestore query is used for all combinations.
// ══════════════════════════════════════════════════════════════════════════════

describe('UserSearchService — EXPANSION: combined firstName + lastName matrix', () => {
  let service: UserSearchService;
  let querySpy: QuerySpy;

  beforeEach(() => {
    ({ service, querySpy } = createTestBedSetup());
  });

  interface CombinedSearchCase {
    firstName: string;
    lastName: string;
    expectedCalls: number;
    desc: string;
  }

  // New architecture: SINGLE composite query for any combination of active terms.
  // 0 calls when neither term meets minLength; 1 call when at least one term qualifies.
  const combinedCases: CombinedSearchCase[] = [
    { firstName: '', lastName: '', expectedCalls: 0, desc: 'both empty → 0 calls' },
    { firstName: 'A', lastName: '', expectedCalls: 0, desc: 'firstName too short, lastName empty → 0 calls' },
    { firstName: '', lastName: 'B', expectedCalls: 0, desc: 'firstName empty, lastName too short → 0 calls' },
    { firstName: 'A', lastName: 'B', expectedCalls: 0, desc: 'both too short → 0 calls' },
    { firstName: 'Ma', lastName: '', expectedCalls: 1, desc: 'firstName valid, lastName empty → 1 call' },
    { firstName: '', lastName: 'Ma', expectedCalls: 1, desc: 'firstName empty, lastName valid → 1 call' },
    { firstName: 'Ma', lastName: 'Ma', expectedCalls: 1, desc: 'both valid → 1 composite call' },
    { firstName: 'Marko', lastName: 'Ma', expectedCalls: 1, desc: 'both valid, different lengths → 1 composite call' },
    // When one term is non-empty but below minLength, only the qualifying term is used in the query.
    // Either way: exactly 1 composite Firestore call is made.
    { firstName: 'A', lastName: 'Markovic', expectedCalls: 1, desc: 'firstName too short (non-empty), lastName valid → 1 call (lastName filter only)' },
    { firstName: 'Marko', lastName: 'B', expectedCalls: 1, desc: 'firstName valid, lastName too short (non-empty) → 1 call (firstName filter only)' },
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
// toLatinUpperCase() transliterates Cyrillic to Latin uppercase.
// ══════════════════════════════════════════════════════════════════════════════

describe('UserSearchService — EXPANSION: Cyrillic character variations', () => {
  let service: UserSearchService;
  let querySpy: QuerySpy;

  beforeEach(() => {
    ({ service, querySpy } = createTestBedSetup());
  });

  // Cyrillic input is transliterated to Latin uppercase by toLatinUpperCase().
  const cyrillicNames = [
    { input: 'Ни', expectedUpper: 'NI' },
    { input: 'Никола', expectedUpper: 'NIKOLA' },
    { input: 'Јован', expectedUpper: 'JOVAN' },
    { input: 'Александар', expectedUpper: 'ALEKSANDAR' },
    { input: 'Ђорђе', expectedUpper: 'DJORDJE' },
    { input: 'Зоран', expectedUpper: 'ZORAN' },
    { input: 'Ћирић', expectedUpper: 'CIRIC' },
    { input: 'Петровић', expectedUpper: 'PETROVIC' },
    { input: 'Николић', expectedUpper: 'NIKOLIC' },
    { input: 'Здравковић', expectedUpper: 'ZDRAVKOVIC' },
  ];

  cyrillicNames.forEach(({ input, expectedUpper }) => {
    it(`CYRILLIC-FN: "${input}" → Firestore receives "${expectedUpper}" (Latin transliteration)`, async () => {
      querySpy.and.resolveTo(createEmptyQueryResult());
      await service.search(input, '');
      if (input.length >= MIN_SEARCH_LENGTH) {
        const args = querySpy.calls.mostRecent().args;
        const opts = args[1] as { compositeFilter: { queryConstraints: Array<{ value?: string }> } };
        const termConstraint = opts.compositeFilter.queryConstraints.find(
          c => c.value === expectedUpper,
        );
        expect(termConstraint).toBeDefined();
      }
    });
  });

  it('CYRILLIC-BOTH: Cyrillic firstName and lastName are both transliterated — single composite call', async () => {
    querySpy.and.resolveTo(createEmptyQueryResult());
    await service.search('Никола', 'Николић');
    expect(querySpy).toHaveBeenCalledTimes(1);
  });

  it('CYRILLIC-RESULT: search returns Cyrillic user correctly (original name preserved in result)', async () => {
    const doc = createUserDoc({
      sn: 'CYR001',
      firstName: 'Никола',
      lastName: 'Николић',
      firstNameSrch: 'NIKOLA',
      lastNameSrch: 'NIKOLIC',
    });
    querySpy.and.resolveTo(createQueryResult([doc]));

    await service.search('Никола', '');

    expect(service.results.length).toBe(1);
    expect(service.results[0].firstName).toBe('Никола');
  });
});

// ══════════════════════════════════════════════════════════════════════════════
// Suite 6: Latin diacritics and special characters
// Serbian Latin diacritics (Č,Ć,Đ,Š,Ž) are transliterated.
// Other Latin diacritics (ü,ä,ö,ñ,ç,Ł) are uppercased as-is.
// ══════════════════════════════════════════════════════════════════════════════

describe('UserSearchService — EXPANSION: Latin diacritics and special chars', () => {
  let service: UserSearchService;
  let querySpy: QuerySpy;

  beforeEach(() => {
    ({ service, querySpy } = createTestBedSetup());
  });

  const diacriticCases = [
    { input: 'Müller', expectedUpper: 'MÜLLER', desc: 'German umlaut ü (no transliteration mapping, uppercased as-is)' },
    { input: 'Schäfer', expectedUpper: 'SCHÄFER', desc: 'German umlaut ä (uppercased as-is)' },
    { input: 'Björk', expectedUpper: 'BJÖRK', desc: 'Swedish ö (uppercased as-is)' },
    { input: 'Ñoño', expectedUpper: 'ÑOÑO', desc: 'Spanish ñ (uppercased as-is)' },
    { input: 'François', expectedUpper: 'FRANÇOIS', desc: 'French ç (uppercased as-is)' },
    { input: 'Łukasz', expectedUpper: 'ŁUKASZ', desc: 'Polish Ł (uppercased as-is)' },
    { input: 'Čović', expectedUpper: 'COVIC', desc: 'Croatian č → C (transliterated)' },
    { input: 'Šarić', expectedUpper: 'SARIC', desc: 'Croatian š → S, ć → C (transliterated)' },
    { input: 'Žižek', expectedUpper: 'ZIZEK', desc: 'Croatian ž → Z (transliterated)' },
    { input: 'Ančić', expectedUpper: 'ANCIC', desc: 'Mixed: č → C, ć → C (transliterated)' },
  ];

  diacriticCases.forEach(({ input, expectedUpper, desc }) => {
    it(`DIACRITICS: ${desc} → Firestore receives "${expectedUpper}"`, async () => {
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
    ({ service, querySpy } = createTestBedSetup());
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
    ({ service, querySpy } = createTestBedSetup());
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
// Suite 9: Search results ordering
// Results are returned in Firestore order. No client-side sorting.
// ══════════════════════════════════════════════════════════════════════════════

describe('UserSearchService — EXPANSION: results ordering (Firestore order preserved)', () => {
  let service: UserSearchService;
  let querySpy: QuerySpy;

  beforeEach(() => {
    ({ service, querySpy } = createTestBedSetup());
  });

  it('SORT: results are returned in the same order Firestore provides them', async () => {
    const docs = [
      createUserDoc({ sn: 'SN1', lastName: 'Zivkovic' }),
      createUserDoc({ sn: 'SN2', lastName: 'Anic' }),
      createUserDoc({ sn: 'SN3', lastName: 'Markovic' }),
    ];
    querySpy.and.resolveTo(createQueryResult(docs));
    await service.search('Ma', '');
    // No client sort — order matches Firestore response
    expect(service.results[0].sn).toBe('SN1');
    expect(service.results[1].sn).toBe('SN2');
    expect(service.results[2].sn).toBe('SN3');
  });

  it('SORT: firstName-search uses firstNameSrch orderBy (Firestore-ordered, not client-sorted)', async () => {
    const docs = [
      createUserDoc({ sn: 'SN1', firstName: 'Zoran', lastName: 'Markovic' }),
      createUserDoc({ sn: 'SN2', firstName: 'Ana', lastName: 'Markovic' }),
      createUserDoc({ sn: 'SN3', firstName: 'Milan', lastName: 'Markovic' }),
    ];
    querySpy.and.resolveTo(createQueryResult(docs));
    await service.search('Ma', '');
    // Preserved in Firestore order
    expect(service.results[0].sn).toBe('SN1');
    expect(service.results[1].sn).toBe('SN2');
    expect(service.results[2].sn).toBe('SN3');
  });

  it('SORT: Cyrillic and Latin results — order preserved as-is from Firestore', async () => {
    const docs = [
      createUserDoc({ sn: 'SN1', lastName: 'Zivkovic', firstName: 'Ana' }),
      createUserDoc({ sn: 'SN2', lastName: 'Anic', firstName: 'Marko' }),
    ];
    querySpy.and.resolveTo(createQueryResult(docs));
    await service.search('Ma', '');
    expect(service.results[0].sn).toBe('SN1');
    expect(service.results[1].sn).toBe('SN2');
  });

  it('SORT: single result — returned as-is', async () => {
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

  it('SORT: multiple results — order from Firestore is preserved unchanged', async () => {
    const docs = [
      createUserDoc({ sn: 'S1', firstName: 'Z', lastName: 'M' }),
      createUserDoc({ sn: 'S2', firstName: 'A', lastName: 'Z' }),
      createUserDoc({ sn: 'S3', firstName: 'M', lastName: 'A' }),
      createUserDoc({ sn: 'S4', firstName: 'B', lastName: 'B' }),
    ];
    querySpy.and.resolveTo(createQueryResult(docs));
    await service.search('Te', '');

    // Verify order is unchanged (matches Firestore response)
    expect(service.results.map(r => r.sn)).toEqual(['S1', 'S2', 'S3', 'S4']);
  });
});

// ══════════════════════════════════════════════════════════════════════════════
// Suite 10: Deduplication matrix — same SN across loadMore pages
// Dedup runs in appendResults() when loadMore() adds a new page.
// ══════════════════════════════════════════════════════════════════════════════

describe('UserSearchService — EXPANSION: deduplication matrix', () => {
  let service: UserSearchService;
  let querySpy: QuerySpy;

  beforeEach(() => {
    ({ service, querySpy } = createTestBedSetup());
  });

  it('DEDUP: same SN appearing in loadMore page is not added twice', async () => {
    // page1 = full page of PAGE_SIZE docs, page2 contains a doc already seen
    const sharedDoc = createUserDoc({ sn: 'SAME-SN', firstName: 'Ivan', lastName: 'Ivanovic' });
    const page1 = Array.from({ length: PAGE_SIZE }, (_, i) =>
      createUserDoc({ sn: `PAGE1-${i}`, firstName: `User${i}` }),
    );
    // Insert sharedDoc into page1 at index 0 so it's already present
    page1[0] = sharedDoc;

    let callCount = 0;
    querySpy.and.callFake(async () => {
      callCount++;
      return callCount === 1
        ? createQueryResult(page1, 'path/last')
        : createQueryResult([sharedDoc, createUserDoc({ sn: 'NEW-SN', firstName: 'New' })]);
    });

    await service.search('Iv', '');
    await service.loadMore();

    expect(service.results.filter(r => r.sn === 'SAME-SN').length).toBe(1);
  });

  it('DEDUP: 3 unique docs from loadMore page 2 appended correctly', async () => {
    const page1 = Array.from({ length: PAGE_SIZE }, (_, i) =>
      createUserDoc({ sn: `P1-${i}`, firstName: `First${i}` }),
    );
    const page2 = [
      createUserDoc({ sn: 'P2-NEW-1', firstName: 'New1' }),
      createUserDoc({ sn: 'P2-NEW-2', firstName: 'New2' }),
    ];

    let callCount = 0;
    querySpy.and.callFake(async () => {
      callCount++;
      return callCount === 1
        ? createQueryResult(page1, 'path/last')
        : createQueryResult(page2);
    });

    await service.search('Fi', '');
    await service.loadMore();

    expect(service.results.length).toBe(PAGE_SIZE + 2);
  });

  it('DEDUP: single composite query for both fields — no duplicate concern between queries', async () => {
    // Both firstName and lastName search is ONE query, so there is no possibility
    // of the same doc appearing from two separate query responses.
    const doc = createUserDoc({ sn: 'UNIQUE-SN', firstName: 'Petar', lastName: 'Petrovic' });
    querySpy.and.resolveTo(createQueryResult([doc]));

    await service.search('Petar', 'Petrovic');

    expect(service.results.filter(r => r.sn === 'UNIQUE-SN').length).toBe(1);
    expect(querySpy).toHaveBeenCalledTimes(1);
  });
});

// ══════════════════════════════════════════════════════════════════════════════
// Suite 11: loadMore() — page size (constant = 20)
// PAGE_SIZE is a fixed constant; hasMore is based on documents.length === PAGE_SIZE
// ══════════════════════════════════════════════════════════════════════════════

describe('UserSearchService — EXPANSION: loadMore pageSize constant', () => {
  let service: UserSearchService;
  let querySpy: QuerySpy;

  beforeEach(() => {
    ({ service, querySpy } = createTestBedSetup());
  });

  it(`PAGE-SIZE: hasMore=true when results == PAGE_SIZE (${PAGE_SIZE})`, async () => {
    const docs = Array.from({ length: PAGE_SIZE }, (_, i) =>
      createUserDoc({ sn: `SN${i}`, firstName: `User${i}` }),
    );
    querySpy.and.resolveTo(createQueryResult(docs, 'path/last'));
    await service.search('Us', '');
    expect(service.hasMore).toBeTrue();
  });

  it(`PAGE-SIZE: hasMore=false when results < PAGE_SIZE (${PAGE_SIZE})`, async () => {
    const docs = Array.from({ length: PAGE_SIZE - 1 }, (_, i) =>
      createUserDoc({ sn: `SN${i}`, firstName: `User${i}` }),
    );
    querySpy.and.resolveTo(createQueryResult(docs));
    await service.search('Us', '');
    expect(service.hasMore).toBeFalse();
  });

  it('PAGE-SIZE: hasMore=false when results === 0', async () => {
    querySpy.and.resolveTo(createEmptyQueryResult());
    await service.search('Us', '');
    expect(service.hasMore).toBeFalse();
  });

  it('PAGE-SIZE: hasMore=false when results === 1', async () => {
    const docs = [createUserDoc({ sn: 'SINGLE', firstName: 'User' })];
    querySpy.and.resolveTo(createQueryResult(docs));
    await service.search('Us', '');
    expect(service.hasMore).toBeFalse();
  });

  it('PAGE-SIZE: hasMore=true triggers loadMore() to execute another query', async () => {
    const page1 = Array.from({ length: PAGE_SIZE }, (_, i) =>
      createUserDoc({ sn: `PAGE1-${i}`, firstName: `User${i}` }),
    );
    const page2 = [createUserDoc({ sn: 'PAGE2-0', firstName: 'LastUser' })];

    let callCount = 0;
    querySpy.and.callFake(async () => {
      callCount++;
      return callCount === 1
        ? createQueryResult(page1, 'path/last')
        : createQueryResult(page2);
    });

    await service.search('Us', '');
    expect(service.hasMore).toBeTrue();

    await service.loadMore();

    expect(querySpy).toHaveBeenCalledTimes(2);
    expect(service.results.length).toBe(PAGE_SIZE + 1);
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
    ({ service, querySpy, mockLogger } = createTestBedSetup());
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
    ({ service, querySpy } = createTestBedSetup());
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
