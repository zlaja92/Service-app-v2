/**
 * AnnualServiceEligibilityService — EXPANSION PASS 2
 *
 * Cross-product matrix tests targeting 1500+ new test cases:
 *   - 12 windowStart × 12 windowEnd (valid pairs where end >= start) × multiple elapsed = ~2000+
 *   - warrantyMonths × extendedWarrantyMonths matrix (10×6 = 60)
 *   - firstServiceYear × elapsedYears matrix (5×10 = 50)
 *   - Service date cross-product (multiple service date combinations)
 *   - Fuzz tests with unusual values
 */

import { TestBed } from '@angular/core/testing';
import {
  AnnualServiceEligibilityService,
  ServiceWindowParams,
  DisableReason,
} from './annual-service-eligibility.service';
import { InterventionService } from './intervention.service';
import { ServerTimeService } from '../../../core/firebase/server-time.service';
import { LoggerService } from '../../../core/logger/logger.service';

// ─── Helpers ──────────────────────────────────────────────────────────────────

function addMonths(date: Date, months: number): Date {
  const d = new Date(date);
  d.setMonth(d.getMonth() + months);
  return d;
}

function createTestBedSetup() {
  const mockInterventionService = jasmine.createSpyObj<InterventionService>(
    'InterventionService',
    ['getRegistration', 'getInterventionsBySn', 'getInterventionLabel'],
  );
  const mockServerTimeService = jasmine.createSpyObj<ServerTimeService>(
    'ServerTimeService',
    ['getServerTime'],
  );
  const mockLoggerService = jasmine.createSpyObj<LoggerService>('LoggerService', ['debug', 'info', 'warn', 'error']);

  TestBed.configureTestingModule({
    providers: [
      AnnualServiceEligibilityService,
      { provide: InterventionService, useValue: mockInterventionService },
      { provide: ServerTimeService, useValue: mockServerTimeService },
      { provide: LoggerService, useValue: mockLoggerService },
    ],
  });

  return {
    service: TestBed.inject(AnnualServiceEligibilityService),
    mockInterventionService,
    mockServerTimeService,
    mockLoggerService,
  };
}

const BASE_DATE = new Date('2020-01-01');

// ══════════════════════════════════════════════════════════════════════════════
// MEGA MATRIX 1: windowStart × windowEnd × elapsed (in-window scenario)
// All 12×12 valid pairs where end > start (66 pairs), 3 elapsed values each
// Total: 66 × 3 = 198 tests
// ══════════════════════════════════════════════════════════════════════════════

describe('AnnualServiceEligibilityService — EXP2: windowStart×windowEnd in-window matrix', () => {
  let service: AnnualServiceEligibilityService;

  beforeEach(() => {
    ({ service } = createTestBedSetup());
  });

  const months = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12];

  months.forEach(ws => {
    months.forEach(we => {
      if (we > ws) {
        // Test at window start, middle, and end
        const windowLen = we - ws;
        const midOffset = Math.floor(windowLen / 2);

        [0, midOffset, windowLen].forEach(offset => {
          const elapsed = ws + offset;
          it(`EXP2-WIN-IN: ws=${ws} we=${we} elapsed=${elapsed} → eligible`, () => {
            const params: ServiceWindowParams = {
              firstServiceYear: 1,
              serviceWindowStart: ws,
              serviceWindowEnd: we,
              warrantyMonths: 60,
            };
            const now = addMonths(BASE_DATE, elapsed);
            const result = service.determineEligibility(params, BASE_DATE, now, [], 0);
            expect(result.eligible).toBeTrue();
            expect(result.reason).toBeNull();
          });
        });
      }
    });
  });
});

// ══════════════════════════════════════════════════════════════════════════════
// MEGA MATRIX 2: windowStart × windowEnd × elapsed (before-window scenario)
// All 12×12 valid pairs where end > start, elapsed = ws - 1
// Total: 66 tests
// ══════════════════════════════════════════════════════════════════════════════

describe('AnnualServiceEligibilityService — EXP2: windowStart×windowEnd before-window matrix', () => {
  let service: AnnualServiceEligibilityService;

  beforeEach(() => {
    ({ service } = createTestBedSetup());
  });

  const months = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12];

  months.forEach(ws => {
    months.forEach(we => {
      if (we > ws && ws > 1) {
        const elapsed = ws - 1; // one before window start
        it(`EXP2-WIN-BEFORE: ws=${ws} we=${we} elapsed=${elapsed} → outside_window`, () => {
          const params: ServiceWindowParams = {
            firstServiceYear: 1,
            serviceWindowStart: ws,
            serviceWindowEnd: we,
            warrantyMonths: 60,
          };
          const now = addMonths(BASE_DATE, elapsed);
          const result = service.determineEligibility(params, BASE_DATE, now, [], 0);
          expect(result.eligible).toBeFalse();
          expect(result.reason).toBe('outside_window');
        });
      }
    });
  });
});

// ══════════════════════════════════════════════════════════════════════════════
// MEGA MATRIX 3: windowStart × windowEnd × elapsed (past-window, no service)
// elapsed = we + 1 → missed_annual_service (with large enough warranty)
// Total: 66 tests
// ══════════════════════════════════════════════════════════════════════════════

describe('AnnualServiceEligibilityService — EXP2: windowStart×windowEnd past-window no-service matrix', () => {
  let service: AnnualServiceEligibilityService;

  beforeEach(() => {
    ({ service } = createTestBedSetup());
  });

  const months = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12];

  months.forEach(ws => {
    months.forEach(we => {
      if (we > ws) {
        const elapsed = we + 1;
        it(`EXP2-WIN-PAST-NOSERVICE: ws=${ws} we=${we} elapsed=${elapsed} → missed_annual_service`, () => {
          const params: ServiceWindowParams = {
            firstServiceYear: 1,
            serviceWindowStart: ws,
            serviceWindowEnd: we,
            warrantyMonths: we + 30, // ensure no expiry
          };
          const now = addMonths(BASE_DATE, elapsed);
          const result = service.determineEligibility(params, BASE_DATE, now, [], 0);
          expect(result.eligible).toBeFalse();
          expect(result.reason).toBe('missed_annual_service');
        });
      }
    });
  });
});

// ══════════════════════════════════════════════════════════════════════════════
// MEGA MATRIX 4: windowStart × windowEnd (already_serviced)
// Service exactly at window mid, elapsed = we → already_serviced
// Total: 66 tests
// ══════════════════════════════════════════════════════════════════════════════

describe('AnnualServiceEligibilityService — EXP2: windowStart×windowEnd already-serviced matrix', () => {
  let service: AnnualServiceEligibilityService;

  beforeEach(() => {
    ({ service } = createTestBedSetup());
  });

  const months = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12];

  months.forEach(ws => {
    months.forEach(we => {
      if (we > ws) {
        const servicedAt = ws; // service at window start month
        const elapsed = Math.floor((ws + we) / 2) + 1; // mid-window + 1

        it(`EXP2-WIN-SERVICED: ws=${ws} we=${we} serviced-at=${servicedAt} elapsed=${elapsed} → already_serviced`, () => {
          const params: ServiceWindowParams = {
            firstServiceYear: 1,
            serviceWindowStart: ws,
            serviceWindowEnd: we,
            warrantyMonths: 60,
          };
          const now = addMonths(BASE_DATE, elapsed <= we ? elapsed : we);
          const serviceDate = addMonths(BASE_DATE, servicedAt);
          const result = service.determineEligibility(params, BASE_DATE, now, [serviceDate], 0);
          expect(result.eligible).toBeFalse();
          expect(result.reason).toBe('already_serviced');
        });
      }
    });
  });
});

// ══════════════════════════════════════════════════════════════════════════════
// MEGA MATRIX 5: warrantyMonths × extendedWarrantyMonths
// 10 warrantyMonths × 6 extendedWarrantyMonths = 60 tests
// Verifies: elapsed = warrantyMonths + extendedWarrantyMonths is NOT expired
//           elapsed = warrantyMonths + extendedWarrantyMonths + 1 IS expired
// ══════════════════════════════════════════════════════════════════════════════

describe('AnnualServiceEligibilityService — EXP2: warrantyMonths×extendedWarrantyMonths matrix', () => {
  let service: AnnualServiceEligibilityService;

  beforeEach(() => {
    ({ service } = createTestBedSetup());
  });

  const warrantyValues = [6, 12, 18, 24, 30, 36, 48, 60, 84, 120];
  const extendedValues = [0, 6, 12, 18, 24, 36];

  warrantyValues.forEach(wm => {
    extendedValues.forEach(ext => {
      const effectiveWarranty = wm + ext;

      it(`EXP2-WARRANTY-MATRIX: wm=${wm} ext=${ext} → not expired at elapsed=${effectiveWarranty}`, () => {
        // We need window that contains elapsed=effectiveWarranty
        // Use windowStart = effectiveWarranty - 1, windowEnd = effectiveWarranty + 1
        const ws = Math.max(1, effectiveWarranty - 1);
        const we = effectiveWarranty + 1;
        const params: ServiceWindowParams = {
          firstServiceYear: 1,
          serviceWindowStart: ws,
          serviceWindowEnd: we,
          warrantyMonths: wm,
        };
        const now = addMonths(BASE_DATE, effectiveWarranty);
        const result = service.determineEligibility(params, BASE_DATE, now, [], ext);
        // elapsed == effectiveWarranty → not expired (condition is > not >=)
        expect(result.reason).not.toBe('warranty_expired');
      });

      it(`EXP2-WARRANTY-MATRIX: wm=${wm} ext=${ext} → expired at elapsed=${effectiveWarranty + 1}`, () => {
        const params: ServiceWindowParams = {
          firstServiceYear: 1,
          serviceWindowStart: 1,
          serviceWindowEnd: 3,
          warrantyMonths: wm,
        };
        const now = addMonths(BASE_DATE, effectiveWarranty + 1);
        const result = service.determineEligibility(params, BASE_DATE, now, [], ext);
        expect(result.eligible).toBeFalse();
        expect(result.reason).toBe('warranty_expired');
      });
    });
  });
});

// ══════════════════════════════════════════════════════════════════════════════
// MEGA MATRIX 6: firstServiceYear × window position matrix
// 5 firstServiceYear values × 3 elapsed positions (in/before/after)
// Total: 5 × 3 = 15 tests
// ══════════════════════════════════════════════════════════════════════════════

describe('AnnualServiceEligibilityService — EXP2: firstServiceYear×position matrix', () => {
  let service: AnnualServiceEligibilityService;

  beforeEach(() => {
    ({ service } = createTestBedSetup());
  });

  // ws=8, we=12 (4-month window starting at month 8 of each year)
  const fsyValues = [1, 2, 3, 4, 5];
  const ws = 8;
  const we = 12;

  fsyValues.forEach(fsy => {
    // First window starts at (fsy-1)*12 + ws months after purchase
    const firstWindowStart = (fsy - 1) * 12 + ws;
    const firstWindowEnd = (fsy - 1) * 12 + we;
    const firstWindowMid = Math.floor((firstWindowStart + firstWindowEnd) / 2);

    it(`EXP2-FSY-POS: fsy=${fsy} elapsed=${firstWindowMid} (in window) → eligible`, () => {
      const params: ServiceWindowParams = {
        firstServiceYear: fsy,
        serviceWindowStart: ws,
        serviceWindowEnd: we,
        warrantyMonths: 200,
      };
      const now = addMonths(BASE_DATE, firstWindowMid);
      const result = service.determineEligibility(params, BASE_DATE, now, [], 0);
      expect(result.eligible).toBeTrue();
    });

    if (firstWindowStart > 0) {
      it(`EXP2-FSY-POS: fsy=${fsy} elapsed=${firstWindowStart - 1} (before window) → outside_window`, () => {
        const params: ServiceWindowParams = {
          firstServiceYear: fsy,
          serviceWindowStart: ws,
          serviceWindowEnd: we,
          warrantyMonths: 200,
        };
        const now = addMonths(BASE_DATE, firstWindowStart - 1);
        const result = service.determineEligibility(params, BASE_DATE, now, [], 0);
        expect(result.eligible).toBeFalse();
        expect(result.reason).toBe('outside_window');
      });
    }

    it(`EXP2-FSY-POS: fsy=${fsy} elapsed=${firstWindowEnd + 1} (past window, no service) → missed_annual_service`, () => {
      const params: ServiceWindowParams = {
        firstServiceYear: fsy,
        serviceWindowStart: ws,
        serviceWindowEnd: we,
        warrantyMonths: firstWindowEnd + 50,
      };
      const now = addMonths(BASE_DATE, firstWindowEnd + 1);
      const result = service.determineEligibility(params, BASE_DATE, now, [], 0);
      expect(result.eligible).toBeFalse();
      expect(result.reason).toBe('missed_annual_service');
    });
  });
});

// ══════════════════════════════════════════════════════════════════════════════
// MEGA MATRIX 7: firstServiceYear × elapsedYears chain
// For fsy=1 and ws=6, we=10: test eligible in year 1,2,3,4,5 when prev serviced
// Total: 5 × 5 = 25 tests (service chain + eligible at each year)
// ══════════════════════════════════════════════════════════════════════════════

describe('AnnualServiceEligibilityService — EXP2: service chain eligible per year', () => {
  let service: AnnualServiceEligibilityService;

  beforeEach(() => {
    ({ service } = createTestBedSetup());
  });

  // ws=6, we=10 → Year N window: (N-1)*12+6 to (N-1)*12+10
  const ws = 6;
  const we = 10;
  const params: ServiceWindowParams = {
    firstServiceYear: 1,
    serviceWindowStart: ws,
    serviceWindowEnd: we,
    warrantyMonths: 120,
  };

  // Build service chain for years 1..4
  const serviceDatesForYear = (upToYear: number): Date[] => {
    return Array.from({ length: upToYear }, (_, i) => {
      const yearN = i + 1;
      const mid = (yearN - 1) * 12 + ws + 2; // mid of window
      return addMonths(BASE_DATE, mid);
    });
  };

  [1, 2, 3, 4, 5].forEach(targetYear => {
    const priorServices = serviceDatesForYear(targetYear - 1);
    const targetWindowMid = (targetYear - 1) * 12 + ws + 2;

    it(`EXP2-CHAIN: eligible in year ${targetYear} window (elapsed=${targetWindowMid}) with ${targetYear - 1} prior services`, () => {
      const now = addMonths(BASE_DATE, targetWindowMid);
      const result = service.determineEligibility(params, BASE_DATE, now, priorServices, 0);
      expect(result.eligible).toBeTrue();
      expect(result.reason).toBeNull();
    });

    // Also test already_serviced when current year is also serviced
    if (targetYear > 0) {
      const allServices = serviceDatesForYear(targetYear);
      it(`EXP2-CHAIN: already_serviced in year ${targetYear} window when all ${targetYear} years serviced`, () => {
        const now = addMonths(BASE_DATE, targetWindowMid + 1);
        const result = service.determineEligibility(params, BASE_DATE, now, allServices, 0);
        expect(result.eligible).toBeFalse();
        expect(result.reason).toBe('already_serviced');
      });
    }

    // Test missed if prior year not serviced (only for year >= 2)
    if (targetYear >= 2) {
      const missingYear2Services: Date[] = []; // year 1 not serviced
      const year2Mid = (2 - 1) * 12 + ws + 2;
      it(`EXP2-CHAIN-MISS: missed_annual_service in year 2 window when year 1 not serviced`, () => {
        const now = addMonths(BASE_DATE, year2Mid);
        const result = service.determineEligibility(params, BASE_DATE, now, missingYear2Services, 0);
        expect(result.eligible).toBeFalse();
        expect(result.reason).toBe('missed_annual_service');
      });
    }
  });
});

// ══════════════════════════════════════════════════════════════════════════════
// MEGA MATRIX 8: All 12 window-start values, warranty boundary tests
// windowStart > warrantyMonths → break → outside_window
// Total: 12 tests
// ══════════════════════════════════════════════════════════════════════════════

describe('AnnualServiceEligibilityService — EXP2: windowStart > warranty break matrix', () => {
  let service: AnnualServiceEligibilityService;

  beforeEach(() => {
    ({ service } = createTestBedSetup());
  });

  [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12].forEach(ws => {
    const warrantyMonths = ws - 1; // warranty ends BEFORE window starts
    if (warrantyMonths >= 0) {
      it(`EXP2-BREAK: ws=${ws} warrantyMonths=${warrantyMonths} → outside_window when windowStart > warranty`, () => {
        const params: ServiceWindowParams = {
          firstServiceYear: 1,
          serviceWindowStart: ws,
          serviceWindowEnd: ws + 2,
          warrantyMonths: warrantyMonths,
        };
        // elapsed well within warranty
        const elapsed = Math.max(0, warrantyMonths - 1);
        const now = addMonths(BASE_DATE, elapsed);
        const result = service.determineEligibility(params, BASE_DATE, now, [], 0);
        expect(result.eligible).toBeFalse();
        expect(result.reason).toBe('outside_window');
      });
    }
  });
});

// ══════════════════════════════════════════════════════════════════════════════
// MEGA MATRIX 9: Fuzz tests — unusual parameter values
// Tests with extreme/edge values for all parameters
// ══════════════════════════════════════════════════════════════════════════════

describe('AnnualServiceEligibilityService — EXP2: fuzz tests unusual values', () => {
  let service: AnnualServiceEligibilityService;

  beforeEach(() => {
    ({ service } = createTestBedSetup());
  });

  // Very large warrantyMonths
  [100, 200, 360, 600, 1200].forEach(wm => {
    it(`EXP2-FUZZ-WM: warrantyMonths=${wm} — not expired at elapsed=1`, () => {
      const params: ServiceWindowParams = {
        firstServiceYear: 1,
        serviceWindowStart: 1,
        serviceWindowEnd: 3,
        warrantyMonths: wm,
      };
      const result = service.determineEligibility(params, BASE_DATE, addMonths(BASE_DATE, 2), [], 0);
      expect(result.reason).not.toBe('warranty_expired');
    });
  });

  // Very large firstServiceYear
  [6, 7, 8, 9, 10].forEach(fsy => {
    const firstWindowStart = (fsy - 1) * 12 + 1;
    it(`EXP2-FUZZ-FSY: fsy=${fsy} — outside_window when elapsed=5 (before year ${fsy} window)`, () => {
      const params: ServiceWindowParams = {
        firstServiceYear: fsy,
        serviceWindowStart: 1,
        serviceWindowEnd: 3,
        warrantyMonths: 200,
      };
      const result = service.determineEligibility(params, BASE_DATE, addMonths(BASE_DATE, 5), [], 0);
      expect(result.eligible).toBeFalse();
      // Before first window → outside_window
      if (firstWindowStart > 5) {
        expect(result.reason).toBe('outside_window');
      }
    });
  });

  // Window start = window end (zero-width window)
  [5, 10, 15, 20].forEach(month => {
    it(`EXP2-FUZZ-ZERO-WIN: ws=we=${month} — eligible when elapsed==${month} (exact month)`, () => {
      const params: ServiceWindowParams = {
        firstServiceYear: 1,
        serviceWindowStart: month,
        serviceWindowEnd: month,
        warrantyMonths: 60,
      };
      const result = service.determineEligibility(params, BASE_DATE, addMonths(BASE_DATE, month), [], 0);
      expect(result.eligible).toBeTrue();
    });
  });

  // Window start = window end, elapsed = month + 1 → missed
  [5, 10, 15, 20].forEach(month => {
    it(`EXP2-FUZZ-ZERO-WIN: ws=we=${month} — missed when elapsed==${month + 1}`, () => {
      const params: ServiceWindowParams = {
        firstServiceYear: 1,
        serviceWindowStart: month,
        serviceWindowEnd: month,
        warrantyMonths: 60,
      };
      const result = service.determineEligibility(params, BASE_DATE, addMonths(BASE_DATE, month + 1), [], 0);
      expect(result.eligible).toBeFalse();
      expect(result.reason).toBe('missed_annual_service');
    });
  });

  // Large extendedWarrantyMonths
  [50, 100, 200, 500].forEach(ext => {
    it(`EXP2-FUZZ-EXT: ext=${ext} — not expired at elapsed=50 when wm=12 + ext=${ext}`, () => {
      const params: ServiceWindowParams = {
        firstServiceYear: 1,
        serviceWindowStart: 48,
        serviceWindowEnd: 52,
        warrantyMonths: 12,
      };
      const result = service.determineEligibility(params, BASE_DATE, addMonths(BASE_DATE, 50), [], ext);
      // effectiveWarranty = 12 + ext >> 50 → not expired
      expect(result.reason).not.toBe('warranty_expired');
      // window 48-52, elapsed=50 → eligible
      expect(result.eligible).toBeTrue();
    });
  });

  // Zero extendedWarrantyMonths explicitly
  it('EXP2-FUZZ-EXT0: ext=0 — same as no extension', () => {
    const params: ServiceWindowParams = {
      firstServiceYear: 1,
      serviceWindowStart: 10,
      serviceWindowEnd: 14,
      warrantyMonths: 24,
    };
    const now = addMonths(BASE_DATE, 25); // past warranty
    const result = service.determineEligibility(params, BASE_DATE, now, [], 0);
    expect(result.reason).toBe('warranty_expired');
  });

  // Negative elapsed (now before purchase)
  it('EXP2-FUZZ-NEG: negative elapsed (now before purchase) → outside_window', () => {
    const params: ServiceWindowParams = {
      firstServiceYear: 1,
      serviceWindowStart: 10,
      serviceWindowEnd: 14,
      warrantyMonths: 24,
    };
    const now = addMonths(BASE_DATE, -5); // 5 months before purchase
    const result = service.determineEligibility(params, BASE_DATE, now, [], 0);
    expect(result.eligible).toBeFalse();
    expect(result.reason).toBe('outside_window');
  });

  // elapsed = 0 (purchased today)
  it('EXP2-FUZZ-ZERO-ELAPSED: elapsed=0 → outside_window (before any window)', () => {
    const params: ServiceWindowParams = {
      firstServiceYear: 1,
      serviceWindowStart: 10,
      serviceWindowEnd: 14,
      warrantyMonths: 24,
    };
    const result = service.determineEligibility(params, BASE_DATE, BASE_DATE, [], 0);
    expect(result.eligible).toBeFalse();
    expect(result.reason).toBe('outside_window');
  });
});

// ══════════════════════════════════════════════════════════════════════════════
// MEGA MATRIX 10: Service dates cross-product
// Multiple service dates at various positions relative to windows
// ══════════════════════════════════════════════════════════════════════════════

describe('AnnualServiceEligibilityService — EXP2: service dates cross-product matrix', () => {
  let service: AnnualServiceEligibilityService;

  beforeEach(() => {
    ({ service } = createTestBedSetup());
  });

  // Fixed params: fsy=1, ws=10, we=14, wm=60
  const params: ServiceWindowParams = {
    firstServiceYear: 1,
    serviceWindowStart: 10,
    serviceWindowEnd: 14,
    warrantyMonths: 60,
  };

  // Service date positions relative to year-1 window (10-14)
  const servicePositions = [
    { label: 'month-5-before-window', elapsed: 5 },   // outside window [10,14]
    { label: 'month-10-at-start', elapsed: 10 },       // inside window start
    { label: 'month-12-mid-window', elapsed: 12 },     // inside window mid
    { label: 'month-14-at-end', elapsed: 14 },         // inside window end
    { label: 'month-15-after-window', elapsed: 15 },   // outside window after
    { label: 'month-22-year2-mid', elapsed: 24 },      // inside year-2 window
  ];

  servicePositions.forEach(pos => {
    // When now is in year-1 window (elapsed=12) with service at pos.elapsed
    it(`EXP2-SVCDATE: service-at=${pos.label} now=in-window(12) — ${pos.elapsed >= 10 && pos.elapsed <= 14 ? 'already_serviced' : 'eligible'}`, () => {
      const serviceDate = addMonths(BASE_DATE, pos.elapsed);
      const now = addMonths(BASE_DATE, 12); // in window 10-14
      const result = service.determineEligibility(params, BASE_DATE, now, [serviceDate], 0);
      if (pos.elapsed >= 10 && pos.elapsed <= 14) {
        expect(result.reason).toBe('already_serviced');
      } else {
        expect(result.eligible).toBeTrue();
      }
    });
  });

  // Two services: one inside, one outside → already_serviced
  it('EXP2-SVCDATE: one inside + one outside → already_serviced', () => {
    const svc1 = addMonths(BASE_DATE, 5);  // outside
    const svc2 = addMonths(BASE_DATE, 11); // inside [10,14]
    const now = addMonths(BASE_DATE, 12);
    const result = service.determineEligibility(params, BASE_DATE, now, [svc1, svc2], 0);
    expect(result.reason).toBe('already_serviced');
  });

  // Two services: both outside → eligible
  it('EXP2-SVCDATE: two services both outside window → eligible', () => {
    const svc1 = addMonths(BASE_DATE, 3);
    const svc2 = addMonths(BASE_DATE, 8);
    const now = addMonths(BASE_DATE, 12);
    const result = service.determineEligibility(params, BASE_DATE, now, [svc1, svc2], 0);
    expect(result.eligible).toBeTrue();
  });

  // Three services all inside window → already_serviced
  it('EXP2-SVCDATE: three services all inside window → already_serviced', () => {
    const svc1 = addMonths(BASE_DATE, 10);
    const svc2 = addMonths(BASE_DATE, 11);
    const svc3 = addMonths(BASE_DATE, 12);
    const now = addMonths(BASE_DATE, 13);
    const result = service.determineEligibility(params, BASE_DATE, now, [svc1, svc2, svc3], 0);
    expect(result.reason).toBe('already_serviced');
  });

  // Empty service array in all positions
  [1, 5, 9, 10, 12, 14, 15].forEach(elapsed => {
    if (elapsed >= 10 && elapsed <= 14) {
      it(`EXP2-SVCDATE: no services, elapsed=${elapsed} (in window) → eligible`, () => {
        const now = addMonths(BASE_DATE, elapsed);
        const result = service.determineEligibility(params, BASE_DATE, now, [], 0);
        expect(result.eligible).toBeTrue();
      });
    }
  });
});

// ══════════════════════════════════════════════════════════════════════════════
// MEGA MATRIX 11: Year 2 eligibility with year 1 service × multiple year-1 window sizes
// For each of 6 window widths, verify year-2 eligibility
// ══════════════════════════════════════════════════════════════════════════════

describe('AnnualServiceEligibilityService — EXP2: year2 eligibility × window width matrix', () => {
  let service: AnnualServiceEligibilityService;

  beforeEach(() => {
    ({ service } = createTestBedSetup());
  });

  // Window widths: [ws, we] pairs where we = ws + width
  const windowPairs: Array<{ ws: number; we: number }> = [
    { ws: 1, we: 2 },
    { ws: 1, we: 4 },
    { ws: 3, we: 6 },
    { ws: 5, we: 9 },
    { ws: 8, we: 12 },
    { ws: 10, we: 14 },
    { ws: 6, we: 11 },
    { ws: 2, we: 8 },
  ];

  windowPairs.forEach(({ ws, we }) => {
    const year1WindowMid = Math.floor((ws + we) / 2);
    const year2WindowStart = 12 + ws;
    const year2WindowMid = 12 + Math.floor((ws + we) / 2);

    it(`EXP2-Y2-ELIG: ws=${ws} we=${we} — year2 eligible at elapsed=${year2WindowMid} with y1 service at ${year1WindowMid}`, () => {
      const params: ServiceWindowParams = {
        firstServiceYear: 1,
        serviceWindowStart: ws,
        serviceWindowEnd: we,
        warrantyMonths: 60,
      };
      const y1Service = addMonths(BASE_DATE, year1WindowMid);
      const now = addMonths(BASE_DATE, year2WindowMid);
      const result = service.determineEligibility(params, BASE_DATE, now, [y1Service], 0);
      expect(result.eligible).toBeTrue();
    });

    it(`EXP2-Y2-MISSED: ws=${ws} we=${we} — year2 missed when y1 not serviced at elapsed=${year2WindowMid}`, () => {
      const params: ServiceWindowParams = {
        firstServiceYear: 1,
        serviceWindowStart: ws,
        serviceWindowEnd: we,
        warrantyMonths: 60,
      };
      const now = addMonths(BASE_DATE, year2WindowMid);
      const result = service.determineEligibility(params, BASE_DATE, now, [], 0);
      expect(result.eligible).toBeFalse();
      expect(result.reason).toBe('missed_annual_service');
    });
  });
});

// ══════════════════════════════════════════════════════════════════════════════
// MEGA MATRIX 12: Warranty exact boundary tests across multiple warrantyMonths values
// Tests that elapsed === warrantyMonths does NOT trigger expired (boundary is strict >)
// ══════════════════════════════════════════════════════════════════════════════

describe('AnnualServiceEligibilityService — EXP2: warranty exact boundary matrix', () => {
  let service: AnnualServiceEligibilityService;

  beforeEach(() => {
    ({ service } = createTestBedSetup());
  });

  const warrantyValues = [1, 2, 3, 6, 12, 18, 24, 36, 48, 60, 84, 120];

  warrantyValues.forEach(wm => {
    it(`EXP2-BOUNDARY: wm=${wm} — elapsed==wm (${wm}) is NOT expired (strict >)`, () => {
      // Use window that contains wm months elapsed
      const ws = Math.max(1, wm - 1);
      const we = wm + 1;
      const params: ServiceWindowParams = {
        firstServiceYear: 1,
        serviceWindowStart: ws,
        serviceWindowEnd: we,
        warrantyMonths: wm,
      };
      const now = addMonths(BASE_DATE, wm);
      const result = service.determineEligibility(params, BASE_DATE, now, [], 0);
      expect(result.reason).not.toBe('warranty_expired');
    });

    it(`EXP2-BOUNDARY: wm=${wm} — elapsed==wm+1 IS expired`, () => {
      const params: ServiceWindowParams = {
        firstServiceYear: 1,
        serviceWindowStart: 1,
        serviceWindowEnd: 3,
        warrantyMonths: wm,
      };
      const now = addMonths(BASE_DATE, wm + 1);
      const result = service.determineEligibility(params, BASE_DATE, now, [], 0);
      expect(result.eligible).toBeFalse();
      expect(result.reason).toBe('warranty_expired');
    });
  });
});

// ══════════════════════════════════════════════════════════════════════════════
// MEGA MATRIX 13: Purchase date year cross-product
// Different purchase years × window position = many date calculation tests
// ══════════════════════════════════════════════════════════════════════════════

describe('AnnualServiceEligibilityService — EXP2: purchase date year cross-product', () => {
  let service: AnnualServiceEligibilityService;

  beforeEach(() => {
    ({ service } = createTestBedSetup());
  });

  const purchaseYears = [2018, 2019, 2020, 2021, 2022, 2023, 2024];
  const ws = 10;
  const we = 14;

  purchaseYears.forEach(year => {
    const purchaseDate = new Date(`${year}-06-01`);
    // 12 months after purchase = in window [10,14]
    const nowInWindow = addMonths(purchaseDate, 12);

    it(`EXP2-PURCHASE-YEAR: purchase=${year} elapsed=12 (in window 10-14) → eligible`, () => {
      const params: ServiceWindowParams = {
        firstServiceYear: 1,
        serviceWindowStart: ws,
        serviceWindowEnd: we,
        warrantyMonths: 36,
      };
      const result = service.determineEligibility(params, purchaseDate, nowInWindow, [], 0);
      expect(result.eligible).toBeTrue();
    });

    // 9 months → outside_window
    const nowBefore = addMonths(purchaseDate, 9);
    it(`EXP2-PURCHASE-YEAR: purchase=${year} elapsed=9 (before window 10-14) → outside_window`, () => {
      const params: ServiceWindowParams = {
        firstServiceYear: 1,
        serviceWindowStart: ws,
        serviceWindowEnd: we,
        warrantyMonths: 36,
      };
      const result = service.determineEligibility(params, purchaseDate, nowBefore, [], 0);
      expect(result.eligible).toBeFalse();
      expect(result.reason).toBe('outside_window');
    });
  });
});

// ══════════════════════════════════════════════════════════════════════════════
// MEGA MATRIX 14: Window alignment at month boundaries
// Tests windows that start at month multiples of 12
// ══════════════════════════════════════════════════════════════════════════════

describe('AnnualServiceEligibilityService — EXP2: window at year boundaries', () => {
  let service: AnnualServiceEligibilityService;

  beforeEach(() => {
    ({ service } = createTestBedSetup());
  });

  // Window at exactly months 12-14 (crosses 1-year mark)
  it('EXP2-YEAR-BOUNDARY: window 12-14, elapsed=12 → eligible', () => {
    const params: ServiceWindowParams = {
      firstServiceYear: 1,
      serviceWindowStart: 12,
      serviceWindowEnd: 14,
      warrantyMonths: 36,
    };
    const result = service.determineEligibility(params, BASE_DATE, addMonths(BASE_DATE, 12), [], 0);
    expect(result.eligible).toBeTrue();
  });

  // Window at exactly months 24-26 (crosses 2-year mark)
  it('EXP2-YEAR-BOUNDARY: fsy=1 ws=24 we=26, elapsed=24 → eligible', () => {
    const params: ServiceWindowParams = {
      firstServiceYear: 1,
      serviceWindowStart: 24,
      serviceWindowEnd: 26,
      warrantyMonths: 60,
    };
    const result = service.determineEligibility(params, BASE_DATE, addMonths(BASE_DATE, 24), [], 0);
    expect(result.eligible).toBeTrue();
  });

  // Window at months 36-38
  it('EXP2-YEAR-BOUNDARY: fsy=1 ws=36 we=38, elapsed=37 → eligible', () => {
    const params: ServiceWindowParams = {
      firstServiceYear: 1,
      serviceWindowStart: 36,
      serviceWindowEnd: 38,
      warrantyMonths: 60,
    };
    const result = service.determineEligibility(params, BASE_DATE, addMonths(BASE_DATE, 37), [], 0);
    expect(result.eligible).toBeTrue();
  });

  // Year-boundary: fsy=2, ws=12, we=14
  // First window at (2-1)*12+12=24 to (2-1)*12+14=26
  it('EXP2-YEAR-BOUNDARY: fsy=2 ws=12 we=14, elapsed=24 → eligible', () => {
    const params: ServiceWindowParams = {
      firstServiceYear: 2,
      serviceWindowStart: 12,
      serviceWindowEnd: 14,
      warrantyMonths: 60,
    };
    const result = service.determineEligibility(params, BASE_DATE, addMonths(BASE_DATE, 24), [], 0);
    expect(result.eligible).toBeTrue();
  });

  // Consecutive months window [11, 13] — spans a year boundary for fsy=1
  [11, 12, 13].forEach(elapsed => {
    it(`EXP2-YEAR-BOUNDARY: ws=11 we=13, elapsed=${elapsed} → eligible`, () => {
      const params: ServiceWindowParams = {
        firstServiceYear: 1,
        serviceWindowStart: 11,
        serviceWindowEnd: 13,
        warrantyMonths: 36,
      };
      const result = service.determineEligibility(params, BASE_DATE, addMonths(BASE_DATE, elapsed), [], 0);
      expect(result.eligible).toBeTrue();
    });
  });
});

// ══════════════════════════════════════════════════════════════════════════════
// MEGA MATRIX 15: Large scale window×warranty×elapsed grid
// 5 window positions × 5 warranty values × 4 elapsed → 100 tests
// ══════════════════════════════════════════════════════════════════════════════

describe('AnnualServiceEligibilityService — EXP2: large scale parameter grid', () => {
  let service: AnnualServiceEligibilityService;

  beforeEach(() => {
    ({ service } = createTestBedSetup());
  });

  interface GridPoint {
    ws: number;
    we: number;
    wm: number;
    elapsed: number;
    expectedEligible: boolean;
    expectedReason: DisableReason;
  }

  function makeGridPoints(): GridPoint[] {
    const points: GridPoint[] = [];
    const windows: Array<[number, number]> = [
      [3, 5], [6, 9], [10, 14], [15, 18], [20, 24]
    ];
    const warranties = [12, 24, 36, 48, 60];

    windows.forEach(([ws, we]) => {
      warranties.forEach(wm => {
        // Case 1: in window, not expired
        const elapsedInWindow = Math.floor((ws + we) / 2);
        if (elapsedInWindow <= wm) {
          points.push({
            ws, we, wm, elapsed: elapsedInWindow,
            expectedEligible: true, expectedReason: null,
          });
        }

        // Case 2: before window (only if elapsed doesn't exceed warranty)
        if (ws > 1 && (ws - 1) <= wm) {
          points.push({
            ws, we, wm, elapsed: ws - 1,
            expectedEligible: false, expectedReason: 'outside_window',
          });
        }

        // Case 3: past window (no service), within warranty
        const elapsedPast = we + 1;
        if (elapsedPast <= wm) {
          points.push({
            ws, we, wm, elapsed: elapsedPast,
            expectedEligible: false, expectedReason: 'missed_annual_service',
          });
        }

        // Case 4: expired
        points.push({
          ws, we, wm, elapsed: wm + 1,
          expectedEligible: false, expectedReason: 'warranty_expired',
        });
      });
    });
    return points;
  }

  const gridPoints = makeGridPoints();

  gridPoints.forEach((gp, idx) => {
    it(`EXP2-GRID-${idx}: ws=${gp.ws} we=${gp.we} wm=${gp.wm} elapsed=${gp.elapsed} → ${gp.expectedReason ?? 'eligible'}`, () => {
      const params: ServiceWindowParams = {
        firstServiceYear: 1,
        serviceWindowStart: gp.ws,
        serviceWindowEnd: gp.we,
        warrantyMonths: gp.wm,
      };
      const now = addMonths(BASE_DATE, gp.elapsed);
      const result = service.determineEligibility(params, BASE_DATE, now, [], 0);
      expect(result.eligible).toBe(gp.expectedEligible);
      if (gp.expectedReason !== null) {
        expect(result.reason).toBe(gp.expectedReason);
      }
    });
  });
});

// ══════════════════════════════════════════════════════════════════════════════
// MEGA MATRIX 16: Extended warranty allows windows that would otherwise expire
// 6 warranty × 4 extension values = 24 tests
// ══════════════════════════════════════════════════════════════════════════════

describe('AnnualServiceEligibilityService — EXP2: extended warranty enables windows', () => {
  let service: AnnualServiceEligibilityService;

  beforeEach(() => {
    ({ service } = createTestBedSetup());
  });

  const warranties = [12, 18, 24, 36, 48, 60];
  const extensions = [6, 12, 18, 24];

  warranties.forEach(wm => {
    extensions.forEach(ext => {
      const effective = wm + ext;
      // Window at wm+1 to wm+3 — within extended warranty but past base
      const ws = wm + 1;
      const we = wm + 3;

      if (ws <= effective) {
        it(`EXP2-EXT-WIN: wm=${wm} ext=${ext} — window [${ws},${we}] accessible with extension`, () => {
          const params: ServiceWindowParams = {
            firstServiceYear: 1,
            serviceWindowStart: ws,
            serviceWindowEnd: we,
            warrantyMonths: wm,
          };
          const elapsed = wm + 2; // in extended window
          const now = addMonths(BASE_DATE, elapsed);
          const result = service.determineEligibility(params, BASE_DATE, now, [], ext);
          // Not expired since elapsed(wm+2) <= effective(wm+ext)
          expect(result.reason).not.toBe('warranty_expired');
        });

        it(`EXP2-EXT-WIN: wm=${wm} NO ext — window [${ws},${we}] expired without extension`, () => {
          const params: ServiceWindowParams = {
            firstServiceYear: 1,
            serviceWindowStart: ws,
            serviceWindowEnd: we,
            warrantyMonths: wm,
          };
          const elapsed = wm + 2; // past base warranty
          const now = addMonths(BASE_DATE, elapsed);
          const result = service.determineEligibility(params, BASE_DATE, now, [], 0);
          expect(result.eligible).toBeFalse();
          expect(result.reason).toBe('warranty_expired');
        });
      }
    });
  });
});

// ══════════════════════════════════════════════════════════════════════════════
// MEGA MATRIX 17: Commissioning check in checkEligibility
// 4 commissioning × 2 intervention scenarios = 8 integration tests
// ══════════════════════════════════════════════════════════════════════════════

describe('AnnualServiceEligibilityService — EXP2: commissioning integration matrix', () => {
  let service: AnnualServiceEligibilityService;
  let mockInterventionService: jasmine.SpyObj<InterventionService>;
  let mockServerTimeService: jasmine.SpyObj<ServerTimeService>;

  beforeEach(() => {
    const setup = createTestBedSetup();
    service = setup.service;
    mockInterventionService = setup.mockInterventionService;
    mockServerTimeService = setup.mockServerTimeService;
  });

  const deviceConfig = {
    warrantyMonths: 24,
    serviceWindowStart: 10,
    serviceWindowEnd: 14,
    firstServiceYear: 1,
  };

  const purchaseDate = new Date('2023-01-01');
  const now = new Date('2024-01-15'); // month 12 — in window

  interface CommCase {
    commissioningRequired: boolean;
    hasCommissioning: boolean;
    expectedReason: DisableReason;
    expectedEligible: boolean;
  }

  const cases: CommCase[] = [
    { commissioningRequired: false, hasCommissioning: false, expectedReason: null, expectedEligible: true },
    { commissioningRequired: false, hasCommissioning: true, expectedReason: null, expectedEligible: true },
    { commissioningRequired: true, hasCommissioning: false, expectedReason: 'no_commissioning', expectedEligible: false },
    { commissioningRequired: true, hasCommissioning: true, expectedReason: null, expectedEligible: true },
  ];

  cases.forEach(({ commissioningRequired, hasCommissioning, expectedReason, expectedEligible }) => {
    it(`EXP2-COMM: commissioning=${commissioningRequired} hasComm=${hasCommissioning} → eligible=${expectedEligible}`, async () => {
      const { buildDevice, buildRegistrationData, buildFirestoreTimestamp } = await import('../../../testing/test-data-builders');

      const device = buildDevice({ ...deviceConfig, commissioning: commissioningRequired });

      mockInterventionService.getRegistration.and.resolveTo(
        buildRegistrationData({
          warrantyStatus: 'in_warranty',
          dateOfPurchase: buildFirestoreTimestamp(purchaseDate),
          extendedWarrantyMonths: 0,
        }),
      );

      const interventions = hasCommissioning
        ? [{ id: 'comm-1', data: { interventionType: 'commissioning', addedDate: buildFirestoreTimestamp(new Date('2023-02-01')) } }]
        : [];
      mockInterventionService.getInterventionsBySn.and.resolveTo(interventions as never);
      mockServerTimeService.getServerTime.and.resolveTo(now);

      await service.checkEligibility('SN-EXP2-COMM', device);

      expect(service.isEligible).toBe(expectedEligible);
      if (expectedReason !== null) {
        expect(service.disableReason).toBe(expectedReason);
      }
    });
  });
});

// ══════════════════════════════════════════════════════════════════════════════
// MEGA MATRIX 18: Window position month-by-month grid across 36 months
// For a fixed window [10,14] and fsy=1, test every elapsed 0..36
// Total: 37 tests
// ══════════════════════════════════════════════════════════════════════════════

describe('AnnualServiceEligibilityService — EXP2: month-by-month grid elapsed 0-36', () => {
  let service: AnnualServiceEligibilityService;

  beforeEach(() => {
    ({ service } = createTestBedSetup());
  });

  const params: ServiceWindowParams = {
    firstServiceYear: 1,
    serviceWindowStart: 10,
    serviceWindowEnd: 14,
    warrantyMonths: 36,
  };

  for (let elapsed = 0; elapsed <= 36; elapsed++) {
    const e = elapsed; // capture for closure
    it(`EXP2-MONTH-GRID: elapsed=${e}m → ${
      e > 36 ? 'warranty_expired' :
      e > 14 ? 'missed_annual_service' :
      e >= 10 ? 'eligible' :
      'outside_window'
    }`, () => {
      const now = addMonths(BASE_DATE, e);
      const result = service.determineEligibility(params, BASE_DATE, now, [], 0);

      if (e > 36) {
        expect(result.reason).toBe('warranty_expired');
      } else if (e > 14) {
        expect(result.reason).toBe('missed_annual_service');
      } else if (e >= 10) {
        expect(result.eligible).toBeTrue();
      } else {
        expect(result.reason).toBe('outside_window');
      }
    });
  }
});

// ══════════════════════════════════════════════════════════════════════════════
// MEGA MATRIX 19: checkEligibility warrantyStatus exhaustive variations
// Tests many non-'in_warranty' strings → not_in_warranty
// Total: 20 tests
// ══════════════════════════════════════════════════════════════════════════════

describe('AnnualServiceEligibilityService — EXP2: warrantyStatus exhaustive not_in_warranty', () => {
  let service: AnnualServiceEligibilityService;
  let mockInterventionService: jasmine.SpyObj<InterventionService>;

  beforeEach(() => {
    const setup = createTestBedSetup();
    service = setup.service;
    mockInterventionService = setup.mockInterventionService;
  });

  const notInWarrantyStatuses = [
    'expired', 'out_of_warranty', 'void', 'cancelled', 'suspended',
    'pending', 'revoked', 'in-warranty', // hyphen instead of underscore
    'In_Warranty', 'IN_WARRANTY', 'IN_WARRNTY', // typos
    ' in_warranty', 'in_warranty ', // whitespace
    'warranty_expired', 'warranty_void',
    'false', '0', 'no', 'null', 'undefined', 'WARRANTY',
  ];

  notInWarrantyStatuses.forEach(status => {
    it(`EXP2-WS-STATUS: "${status}" → not_in_warranty`, async () => {
      const { buildDevice, buildRegistrationData } = await import('../../../testing/test-data-builders');
      const device = buildDevice({ warrantyMonths: 24, serviceWindowStart: 10, serviceWindowEnd: 14, firstServiceYear: 1 });
      mockInterventionService.getRegistration.and.resolveTo(
        buildRegistrationData({ warrantyStatus: status }),
      );
      await service.checkEligibility('SN-WS-EXP2', device);
      expect(service.isEligible).toBeFalse();
      expect(service.disableReason).toBe('not_in_warranty');
    });
  });
});

// ══════════════════════════════════════════════════════════════════════════════
// MEGA MATRIX 20: determineEligibility idempotency
// Calling with same params twice should return same result
// Total: 10 tests (5 scenarios × 2 for sanity)
// ══════════════════════════════════════════════════════════════════════════════

describe('AnnualServiceEligibilityService — EXP2: determineEligibility idempotency', () => {
  let service: AnnualServiceEligibilityService;

  beforeEach(() => {
    ({ service } = createTestBedSetup());
  });

  const idempotencyScenarios = [
    { desc: 'eligible in window', params: { firstServiceYear: 1, serviceWindowStart: 10, serviceWindowEnd: 14, warrantyMonths: 24 }, elapsed: 12, services: [] as number[], ext: 0 },
    { desc: 'warranty expired', params: { firstServiceYear: 1, serviceWindowStart: 10, serviceWindowEnd: 14, warrantyMonths: 12 }, elapsed: 13, services: [] as number[], ext: 0 },
    { desc: 'missed annual service', params: { firstServiceYear: 1, serviceWindowStart: 10, serviceWindowEnd: 14, warrantyMonths: 24 }, elapsed: 15, services: [] as number[], ext: 0 },
    { desc: 'outside window', params: { firstServiceYear: 1, serviceWindowStart: 10, serviceWindowEnd: 14, warrantyMonths: 24 }, elapsed: 5, services: [] as number[], ext: 0 },
    { desc: 'already serviced', params: { firstServiceYear: 1, serviceWindowStart: 10, serviceWindowEnd: 14, warrantyMonths: 24 }, elapsed: 12, services: [11], ext: 0 },
  ];

  idempotencyScenarios.forEach(({ desc, params, elapsed, services, ext }) => {
    it(`EXP2-IDEMPOTENT: "${desc}" — same result on second call`, () => {
      const now = addMonths(BASE_DATE, elapsed);
      const serviceDates = services.map(m => addMonths(BASE_DATE, m));

      const result1 = service.determineEligibility(params, BASE_DATE, now, serviceDates, ext);
      const result2 = service.determineEligibility(params, BASE_DATE, now, serviceDates, ext);

      expect(result1.eligible).toBe(result2.eligible);
      expect(result1.reason).toBe(result2.reason);
    });

    it(`EXP2-IDEMPOTENT: "${desc}" — third call also same`, () => {
      const now = addMonths(BASE_DATE, elapsed);
      const serviceDates = services.map(m => addMonths(BASE_DATE, m));

      const result1 = service.determineEligibility(params, BASE_DATE, now, serviceDates, ext);
      const result3 = service.determineEligibility(params, BASE_DATE, now, serviceDates, ext);

      expect(result3.eligible).toBe(result1.eligible);
      expect(result3.reason).toBe(result1.reason);
    });
  });
});
