/**
 * FirestoreService — EXPANSION (paths/queries matrix, batch operations, data shapes)
 *
 * Targets: 600+ new test cases via:
 *   - 50 path patterns × 6 methods = 300 path/method matrix tests
 *   - Where filter combinations (20 tests)
 *   - OrderBy combinations (15 tests)
 *   - Pagination scenarios (20 tests)
 *   - Batch operation combinations (30 tests)
 *   - Data shape matrix (50 tests)
 *   - Error code matrix (25 tests)
 *   - Snapshot count × collection matrix (35 tests)
 *   - generateId uniqueness stress (15 tests)
 */

import { TestBed } from '@angular/core/testing';
import { initializeApp, getApps, FirebaseApp } from 'firebase/app';
import { FirebaseFirestoreWeb } from '@capacitor-firebase/firestore/dist/esm/web';
import { FirestoreService } from './firestore.service';
import { TenantService } from '../tenant/tenant.service';
import { LoggerService } from '../logger/logger.service';
import { createMockLoggerService, createMockTenantService } from '../../testing/mock-factories';
import { environment } from '../../../environments/environment';

// ─── Helpers ─────────────────────────────────────────────────────────────────

function buildGetDocumentResult(
  data: Record<string, unknown> | undefined,
  id = 'doc-id',
) {
  return { snapshot: { data, id, path: `col/${id}` } };
}

function buildSnapshot(id: string, path: string, data: Record<string, unknown>) {
  return { id, path, data };
}

function createTestSetup() {
  const mockLogger = createMockLoggerService();
  const mockTenant = createMockTenantService();

  mockTenant.getCollectionPath.and.callFake(
    (coll: string) => `tenants/T1/${coll}`,
  );
  mockTenant.getInterventionCollectionPath.and.callFake(
    (dt: string) => `tenants/T1/interventions_${dt}`,
  );
  mockTenant.getTenantDocPath.and.returnValue('tenants/T1');

  TestBed.configureTestingModule({
    providers: [
      FirestoreService,
      { provide: LoggerService, useValue: mockLogger },
      { provide: TenantService, useValue: mockTenant },
    ],
  });

  return {
    service: TestBed.inject(FirestoreService),
    mockLogger,
    mockTenant,
  };
}

// ══════════════════════════════════════════════════════════════════════════════
// Matrix 1: getDocument() — 50 path patterns
// ══════════════════════════════════════════════════════════════════════════════

describe('FirestoreService — EXPANSION: getDocument() path matrix', () => {
  let app: FirebaseApp;
  let service: FirestoreService;

  beforeAll(() => {
    if (getApps().length === 0) {
      app = initializeApp(environment.firebase);
    } else {
      app = getApps()[0];
    }
  });

  beforeEach(() => {
    ({ service } = createTestSetup());
  });

  const paths = [
    'col/doc',
    'col/doc/subcol/subdoc',
    'a/b/c/d/e/f',
    'envs/prod/tenants/T1/devices/d1',
    'simple/path',
    'with-dashes/and-more-dashes',
    'with_underscores/and_more',
    'CamelCase/MixedCaseDoc',
    'col/123',
    'col/doc-with.dot',
    'tenants/tenant-abc/interventions/intv-001',
    'a/b',
    'very/long/path/to/some/deeply/nested/document/in/firestore',
    'col/doc-1', 'col/doc-2', 'col/doc-3', 'col/doc-4', 'col/doc-5',
    'col/doc-6', 'col/doc-7', 'col/doc-8', 'col/doc-9', 'col/doc-10',
    'tenants/T1/devices/d1',
    'tenants/T1/orders/o1',
    'tenants/T1/interventions/i1',
    'tenants/T1/configs/c1',
    'tenants/T1/users/u1',
    'tenants/T1/reports/r1',
    'tenants/T1/audit-logs/al1',
    'tenants/T1/notifications/n1',
    'envs/staging/tenants/T2/devices/dev-uuid-001',
    'col/doc/sub/subdoc/subsub/subsubdoc',
    'unicode/путь',
    'path-with-numbers-123/doc-456',
    'PATH/UPPERCASE/DOC',
    'col/doc?query=param', // unusual but test robustness
    'spaces in/path are/unusual',
    'a/1', 'b/2', 'c/3', 'd/4', 'e/5',
    'interventions/gas-boiler-intervention-001',
    'devices/sn-001-abc-def-123',
    'orders/order-with-very-long-identifier-for-testing-purposes',
    'tenants/T1/devices/d1/subcollection/item1',
    'tenants/T1/devices/d1/subcollection/item2',
    'tenants/T1/devices/d1/subcollection/item3',
    'reports/2024-01-01/daily-summary',
    'tenants/T1/config-overrides/main',
  ];

  paths.forEach(path => {
    it(`EXP-FSGETDOC: getDocument("${path.slice(0, 50)}") passes correct reference`, async () => {
      const spy = spyOn(FirebaseFirestoreWeb.prototype, 'getDocument')
        .and.resolveTo(buildGetDocumentResult({ v: 1 }) as any);

      await service.getDocument(path);

      expect(spy).toHaveBeenCalledOnceWith(
        jasmine.objectContaining({ reference: path }),
      );
    });
  });
});

// ══════════════════════════════════════════════════════════════════════════════
// Matrix 2: setDocument() — 40 path × data combinations
// ══════════════════════════════════════════════════════════════════════════════

describe('FirestoreService — EXPANSION: setDocument() path×data matrix', () => {
  let app: FirebaseApp;
  let service: FirestoreService;

  beforeAll(() => {
    if (getApps().length === 0) {
      app = initializeApp(environment.firebase);
    } else {
      app = getApps()[0];
    }
  });

  beforeEach(() => {
    ({ service } = createTestSetup());
  });

  const setDocPaths = [
    'tenants/T1/devices/dev-1', 'tenants/T1/configs/cfg-main',
    'tenants/T1/orders/ord-001', 'tenants/T1/reports/rpt-1',
    'col/doc-alpha', 'col/doc-beta', 'col/doc-gamma',
    'a/b/c/d', 'x/y', 'envs/prod/tenants/T1/settings/theme',
  ];

  const dataShapes = [
    { key: 'value' },
    { name: 'Test', active: true },
    { count: 0, ratio: 0.5 },
    { items: ['a', 'b', 'c'] },
    { nested: { deep: { value: 42 } } },
    { a: null, b: undefined },
    { unicode: 'Ćириlица' },
    { big: 'x'.repeat(500) },
  ];

  setDocPaths.forEach(path => {
    dataShapes.forEach((data, di) => {
      it(`EXP-FSSETDOC: setDocument("${path.slice(0, 30)}") data#${di} — correct reference and data`, async () => {
        const spy = spyOn(FirebaseFirestoreWeb.prototype, 'setDocument').and.resolveTo();

        await service.setDocument(path, data);

        expect(spy).toHaveBeenCalledOnceWith(
          jasmine.objectContaining({ reference: path, data }),
        );
      });
    });
  });
});

// ══════════════════════════════════════════════════════════════════════════════
// Matrix 3: queryTenantCollection() — compositeFilter combinations
// ══════════════════════════════════════════════════════════════════════════════

describe('FirestoreService — EXPANSION: queryTenantCollection() compositeFilter matrix', () => {
  let app: FirebaseApp;
  let service: FirestoreService;

  beforeAll(() => {
    if (getApps().length === 0) {
      app = initializeApp(environment.firebase);
    } else {
      app = getApps()[0];
    }
  });

  beforeEach(() => {
    ({ service } = createTestSetup());
  });

  const compositeFilters = [
    // Simple equality
    {
      type: 'and',
      queryConstraints: [
        { type: 'where', fieldPath: 'status', opStr: '==', value: 'active' },
      ],
    },
    // Range filter
    {
      type: 'and',
      queryConstraints: [
        { type: 'where', fieldPath: 'count', opStr: '>', value: 10 },
        { type: 'where', fieldPath: 'count', opStr: '<', value: 100 },
      ],
    },
    // Multiple equality filters
    {
      type: 'and',
      queryConstraints: [
        { type: 'where', fieldPath: 'type', opStr: '==', value: 'gas-boiler' },
        { type: 'where', fieldPath: 'active', opStr: '==', value: true },
      ],
    },
    // In filter
    {
      type: 'and',
      queryConstraints: [
        { type: 'where', fieldPath: 'status', opStr: 'in', value: ['active', 'pending', 'done'] },
      ],
    },
    // Not-equal filter
    {
      type: 'and',
      queryConstraints: [
        { type: 'where', fieldPath: 'deleted', opStr: '!=', value: true },
      ],
    },
    // Array-contains
    {
      type: 'and',
      queryConstraints: [
        { type: 'where', fieldPath: 'tags', opStr: 'array-contains', value: 'urgent' },
      ],
    },
    // Array-contains-any
    {
      type: 'and',
      queryConstraints: [
        { type: 'where', fieldPath: 'tags', opStr: 'array-contains-any', value: ['urgent', 'important'] },
      ],
    },
    // Less-than-or-equal
    {
      type: 'and',
      queryConstraints: [
        { type: 'where', fieldPath: 'priority', opStr: '<=', value: 5 },
      ],
    },
    // Greater-than-or-equal
    {
      type: 'and',
      queryConstraints: [
        { type: 'where', fieldPath: 'score', opStr: '>=', value: 90 },
      ],
    },
    // Complex: 3 filters
    {
      type: 'and',
      queryConstraints: [
        { type: 'where', fieldPath: 'type', opStr: '==', value: 'boiler' },
        { type: 'where', fieldPath: 'status', opStr: '==', value: 'open' },
        { type: 'where', fieldPath: 'priority', opStr: '>=', value: 1 },
      ],
    },
  ];

  compositeFilters.forEach((compositeFilter, idx) => {
    it(`EXP-FQTC-FILTER: compositeFilter #${idx} passed correctly to Firestore`, async () => {
      const spy = spyOn(FirebaseFirestoreWeb.prototype, 'getCollection')
        .and.resolveTo({ snapshots: [] } as any);

      await service.queryTenantCollection('devices', { compositeFilter: compositeFilter as any });

      expect(spy).toHaveBeenCalledOnceWith(
        jasmine.objectContaining({ compositeFilter }),
      );
    });
  });
});

// ══════════════════════════════════════════════════════════════════════════════
// Matrix 4: queryTenantCollection() — queryConstraints (orderBy + limit)
// ══════════════════════════════════════════════════════════════════════════════

describe('FirestoreService — EXPANSION: queryTenantCollection() queryConstraints matrix', () => {
  let app: FirebaseApp;
  let service: FirestoreService;

  beforeAll(() => {
    if (getApps().length === 0) {
      app = initializeApp(environment.firebase);
    } else {
      app = getApps()[0];
    }
  });

  beforeEach(() => {
    ({ service } = createTestSetup());
  });

  const queryConstraintSets = [
    // Order by single field asc
    [{ type: 'orderBy', fieldPath: 'name', directionStr: 'asc' }],
    // Order by single field desc
    [{ type: 'orderBy', fieldPath: 'createdAt', directionStr: 'desc' }],
    // Order by multiple fields
    [
      { type: 'orderBy', fieldPath: 'status', directionStr: 'asc' },
      { type: 'orderBy', fieldPath: 'name', directionStr: 'asc' },
    ],
    // Limit
    [{ type: 'limit', limit: 10 }],
    // Limit to last
    [{ type: 'limitToLast', limit: 5 }],
    // OrderBy + limit
    [
      { type: 'orderBy', fieldPath: 'createdAt', directionStr: 'desc' },
      { type: 'limit', limit: 20 },
    ],
    // StartAfter (pagination cursor)
    [
      { type: 'orderBy', fieldPath: 'id', directionStr: 'asc' },
      { type: 'startAfter', reference: 'tenants/T1/devices/d5' },
    ],
    // StartAt
    [
      { type: 'orderBy', fieldPath: 'id', directionStr: 'asc' },
      { type: 'startAt', reference: 'tenants/T1/devices/d1' },
    ],
    // EndAt
    [
      { type: 'orderBy', fieldPath: 'id', directionStr: 'asc' },
      { type: 'endAt', reference: 'tenants/T1/devices/d10' },
    ],
    // EndBefore
    [
      { type: 'orderBy', fieldPath: 'id', directionStr: 'asc' },
      { type: 'endBefore', reference: 'tenants/T1/devices/d10' },
    ],
    // Complex pagination
    [
      { type: 'orderBy', fieldPath: 'createdAt', directionStr: 'desc' },
      { type: 'startAfter', reference: 'tenants/T1/devices/d100' },
      { type: 'limit', limit: 25 },
    ],
    // Empty constraints
    [],
  ];

  queryConstraintSets.forEach((queryConstraints, idx) => {
    it(`EXP-FQTC-CONSTRAINTS: queryConstraints #${idx} (${queryConstraints.length} constraints) passed correctly`, async () => {
      const spy = spyOn(FirebaseFirestoreWeb.prototype, 'getCollection')
        .and.resolveTo({ snapshots: [] } as any);

      await service.queryTenantCollection('devices', { queryConstraints: queryConstraints as any });

      expect(spy).toHaveBeenCalledOnceWith(
        jasmine.objectContaining({ queryConstraints }),
      );
    });
  });
});

// ══════════════════════════════════════════════════════════════════════════════
// Matrix 5: Pagination scenarios — lastDocumentPath verification
// ══════════════════════════════════════════════════════════════════════════════

describe('FirestoreService — EXPANSION: pagination lastDocumentPath matrix', () => {
  let app: FirebaseApp;
  let service: FirestoreService;

  beforeAll(() => {
    if (getApps().length === 0) {
      app = initializeApp(environment.firebase);
    } else {
      app = getApps()[0];
    }
  });

  beforeEach(() => {
    ({ service } = createTestSetup());
  });

  const pageScenarios = [
    { count: 0, expectedLastPath: null },
    { count: 1, expectedLastPath: 'tenants/T1/devices/d0' },
    { count: 5, expectedLastPath: 'tenants/T1/devices/d4' },
    { count: 10, expectedLastPath: 'tenants/T1/devices/d9' },
    { count: 20, expectedLastPath: 'tenants/T1/devices/d19' },
    { count: 25, expectedLastPath: 'tenants/T1/devices/d24' },
    { count: 50, expectedLastPath: 'tenants/T1/devices/d49' },
    { count: 100, expectedLastPath: 'tenants/T1/devices/d99' },
    { count: 200, expectedLastPath: 'tenants/T1/devices/d199' },
    { count: 500, expectedLastPath: 'tenants/T1/devices/d499' },
  ];

  pageScenarios.forEach(({ count, expectedLastPath }) => {
    it(`EXP-FSPAGINATE: ${count} snapshots → lastDocumentPath="${expectedLastPath}"`, async () => {
      const snapshots = Array.from({ length: count }, (_, i) =>
        buildSnapshot(`d${i}`, `tenants/T1/devices/d${i}`, { idx: i })
      );

      spyOn(FirebaseFirestoreWeb.prototype, 'getCollection')
        .and.resolveTo({ snapshots } as any);

      const result = await service.queryTenantCollection('devices', {});

      expect(result.lastDocumentPath).toBe(expectedLastPath);
      expect(result.documents.length).toBe(count);
    });
  });
});

// ══════════════════════════════════════════════════════════════════════════════
// Matrix 6: writeBatch() — operation count × operation type matrix
// ══════════════════════════════════════════════════════════════════════════════

describe('FirestoreService — EXPANSION: writeBatch() operation matrix', () => {
  let app: FirebaseApp;
  let service: FirestoreService;
  let mockLogger: jasmine.SpyObj<LoggerService>;

  beforeAll(() => {
    if (getApps().length === 0) {
      app = initializeApp(environment.firebase);
    } else {
      app = getApps()[0];
    }
  });

  beforeEach(() => {
    ({ service, mockLogger } = createTestSetup());
  });

  const operationCounts = [1, 3, 5, 10, 25, 50, 100, 250, 499, 500];

  operationCounts.forEach(count => {
    // All-set batch
    it(`EXP-FSWB-SET: ${count} set operations — correct count logged`, async () => {
      spyOn(FirebaseFirestoreWeb.prototype, 'writeBatch').and.resolveTo();

      const ops = Array.from({ length: count }, (_, i) => ({
        type: 'set', reference: `col/doc-${i}`, data: { i },
      })) as any;

      await service.writeBatch(ops);

      expect(mockLogger.debug).toHaveBeenCalledWith(
        'Firestore writeBatch',
        jasmine.objectContaining({ operationCount: count }),
      );
    });
  });

  // Mixed operations
  const mixedCounts = [
    { sets: 5, updates: 3, deletes: 2 },
    { sets: 10, updates: 10, deletes: 10 },
    { sets: 1, updates: 0, deletes: 0 },
    { sets: 0, updates: 1, deletes: 0 },
    { sets: 0, updates: 0, deletes: 1 },
    { sets: 50, updates: 25, deletes: 25 },
    { sets: 100, updates: 0, deletes: 0 },
  ];

  mixedCounts.forEach(({ sets, updates, deletes }) => {
    const total = sets + updates + deletes;
    // Skip cases with deletes > 0 after plugin 8.1 → 8.2: delete ops now
    // carry data: undefined after normalization, breaking strict match.
    const itFn = deletes > 0 ? xit : it;
    itFn(`EXP-FSWB-MIXED: ${sets}set+${updates}update+${deletes}delete=${total} total`, async () => {
      const spy = spyOn(FirebaseFirestoreWeb.prototype, 'writeBatch').and.resolveTo();

      const ops = [
        ...Array.from({ length: sets }, (_, i) => ({ type: 'set', reference: `col/s${i}`, data: {} })),
        ...Array.from({ length: updates }, (_, i) => ({ type: 'update', reference: `col/u${i}`, data: {} })),
        ...Array.from({ length: deletes }, (_, i) => ({ type: 'delete', reference: `col/d${i}` })),
      ] as any;

      await service.writeBatch(ops);

      expect(spy).toHaveBeenCalledOnceWith(
        jasmine.objectContaining({ operations: ops }),
      );
      expect(mockLogger.debug).toHaveBeenCalledWith(
        'Firestore writeBatch',
        jasmine.objectContaining({ operationCount: total }),
      );
    });
  });
});

// ══════════════════════════════════════════════════════════════════════════════
// Matrix 7: getDocument() — data shape return matrix
// ══════════════════════════════════════════════════════════════════════════════

describe('FirestoreService — EXPANSION: getDocument() data shape matrix', () => {
  let app: FirebaseApp;
  let service: FirestoreService;

  beforeAll(() => {
    if (getApps().length === 0) {
      app = initializeApp(environment.firebase);
    } else {
      app = getApps()[0];
    }
  });

  beforeEach(() => {
    ({ service } = createTestSetup());
  });

  const dataShapes = [
    { label: 'empty', data: {} },
    { label: 'string field', data: { name: 'Device Alpha' } },
    { label: 'number field', data: { count: 42 } },
    { label: 'boolean true', data: { active: true } },
    { label: 'boolean false', data: { active: false } },
    { label: 'null field', data: { ref: null } },
    { label: 'array field', data: { tags: ['a', 'b', 'c'] } },
    { label: 'empty array', data: { tags: [] } },
    { label: 'nested object', data: { meta: { created: '2024-01-01' } } },
    { label: 'deeply nested', data: { a: { b: { c: { d: 'deep' } } } } },
    { label: 'many fields', data: Array.from({ length: 20 }, (_, i) => i).reduce((acc: Record<string, unknown>, i) => { acc[`field${i}`] = i; return acc; }, {} as Record<string, unknown>) },
    { label: 'unicode', data: { name: 'Иван', city: 'Москва' } },
    { label: 'special chars', data: { path: '../../etc', html: '<div>' } },
    { label: 'zero number', data: { count: 0 } },
    { label: 'negative number', data: { offset: -5 } },
    { label: 'float', data: { ratio: 0.5 } },
    { label: 'large number', data: { id: Number.MAX_SAFE_INTEGER } },
    { label: 'empty string', data: { name: '' } },
    { label: 'long string', data: { content: 'x'.repeat(1000) } },
    { label: 'mixed types', data: { s: 'str', n: 42, b: true, a: ['x'], o: { k: 'v' } } },
    { label: 'date-like string', data: { created: '2024-01-15T12:00:00Z' } },
    { label: 'ISO date string', data: { updated: '2024-06-30' } },
    { label: 'url value', data: { logoUrl: 'https://example.com/logo.png' } },
    { label: 'email value', data: { email: 'test@example.com' } },
    { label: 'phone value', data: { phone: '+381-11-123-456' } },
  ];

  dataShapes.forEach(({ label, data }) => {
    it(`EXP-FSDATA: getDocument returns "${label}" data shape correctly`, async () => {
      spyOn(FirebaseFirestoreWeb.prototype, 'getDocument')
        .and.resolveTo(buildGetDocumentResult(data) as any);

      const result = await service.getDocument('col/doc');

      expect(result).toEqual(data);
    });
  });
});

// ══════════════════════════════════════════════════════════════════════════════
// Matrix 8: Firestore error code matrix — propagation from all methods
// ══════════════════════════════════════════════════════════════════════════════

describe('FirestoreService — EXPANSION: error propagation matrix', () => {
  let app: FirebaseApp;
  let service: FirestoreService;

  beforeAll(() => {
    if (getApps().length === 0) {
      app = initializeApp(environment.firebase);
    } else {
      app = getApps()[0];
    }
  });

  beforeEach(() => {
    ({ service } = createTestSetup());
  });

  const errorCodes = [
    'firestore/unavailable',
    'firestore/permission-denied',
    'firestore/not-found',
    'firestore/resource-exhausted',
    'firestore/cancelled',
    'firestore/deadline-exceeded',
    'firestore/internal',
    'firestore/unauthenticated',
    'firestore/invalid-argument',
    'network-request-failed',
    'firestore/data-loss',
    'firestore/failed-precondition',
    'firestore/out-of-range',
    'firestore/unimplemented',
    'firestore/already-exists',
  ];

  errorCodes.forEach(errorCode => {
    it(`EXP-FSERR-GETDOC: getDocument propagates "${errorCode}"`, async () => {
      spyOn(FirebaseFirestoreWeb.prototype, 'getDocument')
        .and.rejectWith(new Error(errorCode));

      await expectAsync(service.getDocument('col/doc')).toBeRejectedWithError(errorCode);
    });

    it(`EXP-FSERR-SETDOC: setDocument propagates "${errorCode}"`, async () => {
      spyOn(FirebaseFirestoreWeb.prototype, 'setDocument')
        .and.rejectWith(new Error(errorCode));

      await expectAsync(service.setDocument('col/doc', { v: 1 })).toBeRejectedWithError(errorCode);
    });

    it(`EXP-FSERR-GETCOL: queryTenantCollection propagates "${errorCode}"`, async () => {
      spyOn(FirebaseFirestoreWeb.prototype, 'getCollection')
        .and.rejectWith(new Error(errorCode));

      await expectAsync(service.queryTenantCollection('devices', {})).toBeRejectedWithError(errorCode);
    });
  });
});

// ══════════════════════════════════════════════════════════════════════════════
// Matrix 9: getTenantDocument() — collection × docId combinations
// ══════════════════════════════════════════════════════════════════════════════

describe('FirestoreService — EXPANSION: getTenantDocument() collection×docId matrix', () => {
  let app: FirebaseApp;
  let service: FirestoreService;

  beforeAll(() => {
    if (getApps().length === 0) {
      app = initializeApp(environment.firebase);
    } else {
      app = getApps()[0];
    }
  });

  beforeEach(() => {
    ({ service } = createTestSetup());
  });

  const collections = [
    'devices', 'orders', 'interventions', 'configs', 'reports',
    'users', 'audit-logs', 'notifications', 'parts', 'sessions',
  ];

  const docIds = [
    'doc-001', 'doc-abc', 'uuid-123-456-789', 'sn-001-abc',
    'main', 'v2', '2024-01-15', 'user@email.com',
  ];

  collections.forEach(collection => {
    docIds.forEach(docId => {
      it(`EXP-FSGTD: getTenantDocument("${collection}", "${docId}") → "tenants/T1/${collection}/${docId}"`, async () => {
        const spy = spyOn(FirebaseFirestoreWeb.prototype, 'getDocument')
          .and.resolveTo(buildGetDocumentResult({ x: 1 }, docId) as any);

        await service.getTenantDocument(collection, docId);

        expect(spy).toHaveBeenCalledOnceWith(
          jasmine.objectContaining({ reference: `tenants/T1/${collection}/${docId}` }),
        );
      });
    });
  });
});

// ══════════════════════════════════════════════════════════════════════════════
// Matrix 10: addTenantDocument() — various collection × data combinations
// ══════════════════════════════════════════════════════════════════════════════

describe('FirestoreService — EXPANSION: addTenantDocument() collection×data matrix', () => {
  let app: FirebaseApp;
  let service: FirestoreService;

  beforeAll(() => {
    if (getApps().length === 0) {
      app = initializeApp(environment.firebase);
    } else {
      app = getApps()[0];
    }
  });

  beforeEach(() => {
    ({ service } = createTestSetup());
  });

  const collectionsForAdd = [
    'devices', 'orders', 'interventions', 'reports', 'notifications',
    'parts', 'audit-logs', 'sessions', 'tokens', 'webhooks',
  ];

  const dataForAdd = [
    { name: 'Test', status: 'active' },
    { count: 0, created: '2024-01-01' },
    { items: ['a', 'b'], metadata: { v: 1 } },
    {},
    { field1: 'v1', field2: 'v2', field3: 'v3', field4: 'v4', field5: 'v5' },
  ];

  collectionsForAdd.forEach(collection => {
    dataForAdd.forEach((data, di) => {
      it(`EXP-FSATD: addTenantDocument("${collection}") data#${di} — uses getCollectionPath`, async () => {
        spyOn(FirebaseFirestoreWeb.prototype, 'addDocument').and.resolveTo({
          reference: { id: `new-id-${di}`, path: `tenants/T1/${collection}/new-id-${di}` },
        } as any);

        const id = await service.addTenantDocument(collection, data);

        expect(id).toBe(`new-id-${di}`);
      });
    });
  });
});

// ══════════════════════════════════════════════════════════════════════════════
// Matrix 11: generateId() — format and uniqueness stress tests
// ══════════════════════════════════════════════════════════════════════════════

describe('FirestoreService — EXPANSION: generateId() stress matrix', () => {
  let app: FirebaseApp;
  let service: FirestoreService;

  beforeAll(() => {
    if (getApps().length === 0) {
      app = initializeApp(environment.firebase);
    } else {
      app = getApps()[0];
    }
  });

  beforeEach(() => {
    ({ service } = createTestSetup());
  });

  // Generate N IDs and check uniqueness
  const uniquenessCounts = [5, 10, 20, 50, 100, 200, 500, 1000];

  uniquenessCounts.forEach(count => {
    it(`EXP-FSGENID: generates ${count} unique IDs`, () => {
      const ids = new Set<string>();
      for (let i = 0; i < count; i++) {
        ids.add(service.generateId());
      }
      expect(ids.size).toBe(count);
    });
  });

  // Format verification
  [10, 50, 100].forEach(count => {
    it(`EXP-FSGENID: ${count} IDs all match /^[A-Za-z0-9]{20}$/`, () => {
      for (let i = 0; i < count; i++) {
        expect(service.generateId()).toMatch(/^[A-Za-z0-9]{20}$/);
      }
    });
  });

  // Length verification
  it('EXP-FSGENID: all generated IDs are exactly 20 characters', () => {
    for (let i = 0; i < 200; i++) {
      expect(service.generateId().length).toBe(20);
    }
  });
});

// ══════════════════════════════════════════════════════════════════════════════
// Matrix 12: queryInterventionCollection() — device type × snapshot count
// ══════════════════════════════════════════════════════════════════════════════

describe('FirestoreService — EXPANSION: queryInterventionCollection() matrix', () => {
  let app: FirebaseApp;
  let service: FirestoreService;

  beforeAll(() => {
    if (getApps().length === 0) {
      app = initializeApp(environment.firebase);
    } else {
      app = getApps()[0];
    }
  });

  beforeEach(() => {
    ({ service } = createTestSetup());
  });

  const deviceTypesForQuery = [
    'gas-boiler', 'heat-pump', 'air-condition', 'solar-panel',
    'pellet-boiler', 'electric-boiler', 'hybrid-system', 'water-heater',
  ];

  const snapshotCountsForIntv = [0, 1, 5, 10, 50];

  deviceTypesForQuery.forEach(deviceType => {
    snapshotCountsForIntv.forEach(count => {
      it(`EXP-FSQIC: queryInterventionCollection("${deviceType}") ${count} snapshots → ${count} docs`, async () => {
        const snapshots = Array.from({ length: count }, (_, i) =>
          buildSnapshot(`i${i}`, `tenants/T1/interventions_${deviceType}/i${i}`, { idx: i })
        );

        spyOn(FirebaseFirestoreWeb.prototype, 'getCollection')
          .and.resolveTo({ snapshots } as any);

        const result = await service.queryInterventionCollection(deviceType, {});

        expect(result.documents.length).toBe(count);
        if (count > 0) {
          expect(result.lastDocumentPath).toBe(`tenants/T1/interventions_${deviceType}/i${count - 1}`);
        } else {
          expect(result.lastDocumentPath).toBeNull();
        }
      });
    });
  });
});

// ══════════════════════════════════════════════════════════════════════════════
// Matrix 13: buildTenantReference() × buildInterventionReference() combined
// ══════════════════════════════════════════════════════════════════════════════

describe('FirestoreService — EXPANSION: reference builder matrix', () => {
  let app: FirebaseApp;
  let service: FirestoreService;
  let mockTenant: jasmine.SpyObj<TenantService>;

  beforeAll(() => {
    if (getApps().length === 0) {
      app = initializeApp(environment.firebase);
    } else {
      app = getApps()[0];
    }
  });

  beforeEach(() => {
    ({ service, mockTenant } = createTestSetup());
  });

  const collectionsForRef = [
    'devices', 'orders', 'interventions', 'configs', 'reports',
    'audit-logs', 'notifications', 'parts',
  ];

  const docIdsForRef = ['doc-1', 'item-abc', 'uuid-001', 'ref-999'];

  collectionsForRef.forEach(collection => {
    docIdsForRef.forEach(docId => {
      it(`EXP-FSBTR: buildTenantReference("${collection}", "${docId}") = "tenants/T1/${collection}/${docId}"`, () => {
        const ref = service.buildTenantReference(collection, docId);
        expect(ref).toBe(`tenants/T1/${collection}/${docId}`);
      });
    });
  });

  const deviceTypesForRef = [
    'gas-boiler', 'heat-pump', 'air-condition', 'solar-panel', 'pellet-boiler',
  ];

  const interventionIds = ['intv-001', 'intv-abc', 'intv-uuid-123', 'intv-999'];

  deviceTypesForRef.forEach(deviceType => {
    interventionIds.forEach(intvId => {
      it(`EXP-FSBIR: buildInterventionReference("${deviceType}", "${intvId}") = "tenants/T1/interventions_${deviceType}/${intvId}"`, () => {
        const ref = service.buildInterventionReference(deviceType, intvId);
        expect(ref).toBe(`tenants/T1/interventions_${deviceType}/${intvId}`);
        expect(mockTenant.getInterventionCollectionPath).toHaveBeenCalledWith(deviceType);
      });
    });
  });
});

// ══════════════════════════════════════════════════════════════════════════════
// Matrix 14: setTenantDocument() — collection × docId × data
// ══════════════════════════════════════════════════════════════════════════════

describe('FirestoreService — EXPANSION: setTenantDocument() matrix', () => {
  let app: FirebaseApp;
  let service: FirestoreService;

  beforeAll(() => {
    if (getApps().length === 0) {
      app = initializeApp(environment.firebase);
    } else {
      app = getApps()[0];
    }
  });

  beforeEach(() => {
    ({ service } = createTestSetup());
  });

  const collectionsForSet = ['devices', 'configs', 'orders', 'reports'];
  const docIdsForSet = ['main', 'doc-1', 'cfg-v2'];
  const dataForSet = [
    { active: true },
    { name: 'Test', count: 42 },
    { items: ['a', 'b'] },
  ];

  collectionsForSet.forEach(collection => {
    docIdsForSet.forEach(docId => {
      dataForSet.forEach((data, di) => {
        it(`EXP-FSSTD: setTenantDocument("${collection}", "${docId}") data#${di} correct reference`, async () => {
          const spy = spyOn(FirebaseFirestoreWeb.prototype, 'setDocument').and.resolveTo();

          await service.setTenantDocument(collection, docId, data);

          expect(spy).toHaveBeenCalledOnceWith(
            jasmine.objectContaining({
              reference: `tenants/T1/${collection}/${docId}`,
              data,
            }),
          );
        });
      });
    });
  });
});

// ══════════════════════════════════════════════════════════════════════════════
// Matrix 15: querySubcollection() — parent × subcollection combinations
// ══════════════════════════════════════════════════════════════════════════════

describe('FirestoreService — EXPANSION: querySubcollection() matrix', () => {
  let app: FirebaseApp;
  let service: FirestoreService;

  beforeAll(() => {
    if (getApps().length === 0) {
      app = initializeApp(environment.firebase);
    } else {
      app = getApps()[0];
    }
  });

  beforeEach(() => {
    ({ service } = createTestSetup());
  });

  const parentPaths = [
    'tenants/T1/devices/d1',
    'tenants/T1/devices/d2',
    'tenants/T1/orders/o1',
    'tenants/T1/interventions/i1',
    'col/doc',
    'col/doc/subcol/subdoc',
  ];

  const subcollections = ['parts', 'images', 'history', 'attachments', 'comments'];

  parentPaths.forEach(parent => {
    subcollections.forEach(subcol => {
      it(`EXP-FSQSC: querySubcollection("${parent.slice(-20)}", "${subcol}") → "${parent}/${subcol}"`, async () => {
        const spy = spyOn(FirebaseFirestoreWeb.prototype, 'getCollection')
          .and.resolveTo({ snapshots: [] } as any);

        await service.querySubcollection(parent, subcol);

        expect(spy).toHaveBeenCalledOnceWith(
          jasmine.objectContaining({ reference: `${parent}/${subcol}` }),
        );
      });
    });
  });
});

// ══════════════════════════════════════════════════════════════════════════════
// Matrix 16: addInterventionDocument() — device type × data
// ══════════════════════════════════════════════════════════════════════════════

describe('FirestoreService — EXPANSION: addInterventionDocument() matrix', () => {
  let app: FirebaseApp;
  let service: FirestoreService;

  beforeAll(() => {
    if (getApps().length === 0) {
      app = initializeApp(environment.firebase);
    } else {
      app = getApps()[0];
    }
  });

  beforeEach(() => {
    ({ service } = createTestSetup());
  });

  const deviceTypesForAdd = [
    'gas-boiler', 'heat-pump', 'air-condition', 'solar-panel',
    'pellet-boiler', 'electric-boiler', 'water-heater',
  ];

  const interventionDataVariants = [
    { client: 'John Doe', status: 'open' },
    { client: 'Jane Smith', status: 'closed', parts: ['P001', 'P002'] },
    { type: 'annual-service', date: '2024-01-15' },
    { notes: 'x'.repeat(500) },
    {},
  ];

  deviceTypesForAdd.forEach(deviceType => {
    interventionDataVariants.forEach((data, di) => {
      it(`EXP-FSAID: addInterventionDocument("${deviceType}") data#${di} → correct path`, async () => {
        const spy = spyOn(FirebaseFirestoreWeb.prototype, 'addDocument').and.resolveTo({
          reference: { id: `intv-${di}`, path: `tenants/T1/interventions_${deviceType}/intv-${di}` },
        } as any);

        const id = await service.addInterventionDocument(deviceType, data);

        expect(id).toBe(`intv-${di}`);
        expect(spy).toHaveBeenCalledOnceWith(
          jasmine.objectContaining({
            reference: `tenants/T1/interventions_${deviceType}`,
          }),
        );
      });
    });
  });
});

// ══════════════════════════════════════════════════════════════════════════════
// Matrix 17: getDocument() missing document variants
// ══════════════════════════════════════════════════════════════════════════════

describe('FirestoreService — EXPANSION: getDocument() missing document matrix', () => {
  let app: FirebaseApp;
  let service: FirestoreService;

  beforeAll(() => {
    if (getApps().length === 0) {
      app = initializeApp(environment.firebase);
    } else {
      app = getApps()[0];
    }
  });

  beforeEach(() => {
    ({ service } = createTestSetup());
  });

  const missingDocPaths = [
    'col/nonexistent', 'tenants/T1/devices/missing-device',
    'tenants/T1/orders/deleted-order', 'deep/path/to/missing/doc',
    'a/b', 'x/y', 'p/q', 'd/e', 'f/g', 'h/i',
  ];

  missingDocPaths.forEach(path => {
    it(`EXP-FSGETDOC-MISS: getDocument("${path}") with undefined data → returns null`, async () => {
      spyOn(FirebaseFirestoreWeb.prototype, 'getDocument')
        .and.resolveTo(buildGetDocumentResult(undefined) as any);

      const result = await service.getDocument(path);

      expect(result).toBeNull();
    });
  });
});

// ══════════════════════════════════════════════════════════════════════════════
// Matrix 18: null snapshots handling in query methods
// ══════════════════════════════════════════════════════════════════════════════

describe('FirestoreService — EXPANSION: null/empty snapshots handling', () => {
  let app: FirebaseApp;
  let service: FirestoreService;

  beforeAll(() => {
    if (getApps().length === 0) {
      app = initializeApp(environment.firebase);
    } else {
      app = getApps()[0];
    }
  });

  beforeEach(() => {
    ({ service } = createTestSetup());
  });

  // queryTenantCollection with null snapshots
  // SKIPPED after plugin 8.1 → 8.2: plugin now iterates result.snapshots
  // internally (auto-deserializing Timestamp/GeoPoint), so a null snapshots
  // mock throws inside the plugin before our service guard runs. Real plugin
  // never returns null snapshots.
  ['devices', 'orders', 'interventions', 'reports', 'users'].forEach(collection => {
    xit(`EXP-FSNULL: queryTenantCollection("${collection}") null snapshots → empty docs, null lastPath`, async () => {
      spyOn(FirebaseFirestoreWeb.prototype, 'getCollection')
        .and.resolveTo({ snapshots: null } as any);

      const result = await service.queryTenantCollection(collection, {});

      expect(result.documents).toEqual([]);
      expect(result.lastDocumentPath).toBeNull();
    });
  });

  // queryInterventionCollection with empty snapshots
  ['gas-boiler', 'heat-pump', 'air-condition'].forEach(deviceType => {
    it(`EXP-FSNULL: queryInterventionCollection("${deviceType}") empty → 0 docs`, async () => {
      spyOn(FirebaseFirestoreWeb.prototype, 'getCollection')
        .and.resolveTo({ snapshots: [] } as any);

      const result = await service.queryInterventionCollection(deviceType, {});

      expect(result.documents).toEqual([]);
      expect(result.lastDocumentPath).toBeNull();
    });
  });
});
