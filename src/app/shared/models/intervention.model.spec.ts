import { Intervention, InterventionPart, InterventionType } from './intervention.model';

describe('Intervention Model (shared/models)', () => {
  describe('InterventionType interface', () => {
    it('TC-IN-01: should accept valid InterventionType with name and code', () => {
      const interventionType: InterventionType = {
        name: 'Annual Service',
        code: 'AS',
      };

      expect(interventionType.name).toBe('Annual Service');
      expect(interventionType.code).toBe('AS');
    });

    // ─── Parameterizovani testovi: InterventionType sa razlicitim vrijednostima
    const interventionTypeCases: Array<[string, string]> = [
      ['Annual Service', 'AS'],
      ['Commissioning', 'COMMIS'],
      ['Repair', 'REP'],
      ['Noise Intervention', 'NOISE'],
      ['Replace', 'REPLACE'],
      ['Emergency', 'EMG'],
      ['Warranty Check', 'WC'],
      ['Inspection', 'INSP'],
    ];

    interventionTypeCases.forEach(([name, code]) => {
      it(`InterventionType name="${name}" code="${code}" should be valid`, () => {
        const type: InterventionType = { name, code };
        expect(type.name).toBe(name);
        expect(type.code).toBe(code);
      });

      it(`InterventionType name="${name}" should be string`, () => {
        const type: InterventionType = { name, code };
        expect(typeof type.name).toBe('string');
      });

      it(`InterventionType code="${code}" should be string`, () => {
        const type: InterventionType = { name, code };
        expect(typeof type.code).toBe('string');
      });

      it(`InterventionType with name="${name}" should have non-empty name`, () => {
        const type: InterventionType = { name, code };
        expect(type.name.length).toBeGreaterThan(0);
      });

      it(`InterventionType with code="${code}" should have non-empty code`, () => {
        const type: InterventionType = { name, code };
        expect(type.code.length).toBeGreaterThan(0);
      });
    });

    it('InterventionType should have exactly 2 fields', () => {
      const type: InterventionType = { name: 'Test', code: 'T' };
      expect(Object.keys(type).length).toBe(2);
    });

    it('InterventionType should be JSON serializable', () => {
      const type: InterventionType = { name: 'Annual Service', code: 'AS' };
      const parsed: InterventionType = JSON.parse(JSON.stringify(type));
      expect(parsed.name).toBe('Annual Service');
      expect(parsed.code).toBe('AS');
    });

    it('InterventionType code can be empty string', () => {
      const type: InterventionType = { name: 'Unknown', code: '' };
      expect(type.code).toBe('');
    });

    it('InterventionType name can be empty string', () => {
      const type: InterventionType = { name: '', code: 'X' };
      expect(type.name).toBe('');
    });

    it('InterventionType can accept unicode name', () => {
      const type: InterventionType = { name: 'Godišnji servis', code: 'GS' };
      expect(type.name).toBe('Godišnji servis');
    });
  });

  describe('InterventionPart interface', () => {
    it('TC-IN-02: should accept valid InterventionPart with name, code, quantity', () => {
      const part: InterventionPart = {
        name: 'Filter',
        code: 'FLT-001',
        quantity: 2,
      };

      expect(part.name).toBe('Filter');
      expect(part.code).toBe('FLT-001');
      expect(part.quantity).toBe(2);
    });

    it('TC-IN-03: should accept InterventionPart with quantity 0', () => {
      const part: InterventionPart = {
        name: 'Filter',
        code: 'FLT-001',
        quantity: 0,
      };

      expect(part.quantity).toBe(0);
    });

    // ─── Parameterizovani testovi: InterventionPart quantity boundary values ───
    const quantityCases = [0, 1, 2, 5, 10, 100, 1000, Number.MAX_SAFE_INTEGER];

    quantityCases.forEach((quantity) => {
      it(`InterventionPart should accept quantity=${quantity}`, () => {
        const part: InterventionPart = { name: 'Test', code: 'T-001', quantity };
        expect(part.quantity).toBe(quantity);
      });

      it(`InterventionPart quantity=${quantity} should be a number`, () => {
        const part: InterventionPart = { name: 'Test', code: 'T-001', quantity };
        expect(typeof part.quantity).toBe('number');
      });
    });

    it('InterventionPart should accept negative quantity', () => {
      const part: InterventionPart = { name: 'Test', code: 'T-001', quantity: -1 };
      expect(part.quantity).toBe(-1);
    });

    it('InterventionPart should accept fractional quantity', () => {
      const part: InterventionPart = { name: 'Test', code: 'T-001', quantity: 0.5 };
      expect(part.quantity).toBe(0.5);
    });

    // ─── Parameterizovani testovi: razliciti dijelovi ─────────────────────────
    const partCases: Array<[string, string, number]> = [
      ['Air Filter', 'AF-001', 1],
      ['Gasket', 'GSK-002', 2],
      ['Seal', 'SL-003', 3],
      ['Pump', 'PMP-004', 1],
      ['Sensor', 'SNS-005', 1],
      ['Valve', 'VLV-006', 2],
      ['Board', 'BRD-007', 1],
      ['Thermostat', 'THS-008', 1],
      ['Fan', 'FAN-009', 1],
      ['Coil', 'COL-010', 1],
    ];

    partCases.forEach(([name, code, quantity]) => {
      it(`InterventionPart name="${name}" code="${code}" qty=${quantity} should be valid`, () => {
        const part: InterventionPart = { name, code, quantity };
        expect(part.name).toBe(name);
        expect(part.code).toBe(code);
        expect(part.quantity).toBe(quantity);
      });
    });

    it('InterventionPart should have exactly 3 fields', () => {
      const part: InterventionPart = { name: 'Test', code: 'T-001', quantity: 1 };
      expect(Object.keys(part).length).toBe(3);
    });

    it('InterventionPart name should be a string', () => {
      const part: InterventionPart = { name: 'Filter', code: 'F-001', quantity: 1 };
      expect(typeof part.name).toBe('string');
    });

    it('InterventionPart code should be a string', () => {
      const part: InterventionPart = { name: 'Filter', code: 'F-001', quantity: 1 };
      expect(typeof part.code).toBe('string');
    });

    it('InterventionPart name can be empty string', () => {
      const part: InterventionPart = { name: '', code: 'F-001', quantity: 1 };
      expect(part.name).toBe('');
    });

    it('InterventionPart code can be empty string', () => {
      const part: InterventionPart = { name: 'Filter', code: '', quantity: 1 };
      expect(part.code).toBe('');
    });

    it('InterventionPart name can be long string', () => {
      const longName = 'P'.repeat(500);
      const part: InterventionPart = { name: longName, code: 'X', quantity: 1 };
      expect(part.name.length).toBe(500);
    });

    it('InterventionPart should be JSON serializable', () => {
      const part: InterventionPart = { name: 'Filter', code: 'F-001', quantity: 3 };
      const parsed: InterventionPart = JSON.parse(JSON.stringify(part));
      expect(parsed.name).toBe('Filter');
      expect(parsed.code).toBe('F-001');
      expect(parsed.quantity).toBe(3);
    });

    it('InterventionPart can accept unicode name', () => {
      const part: InterventionPart = { name: 'Gasna grlica - šraf', code: 'GAS-001', quantity: 1 };
      expect(part.name).toContain('š');
    });
  });

  describe('Intervention interface', () => {
    it('TC-IN-04: should accept Intervention with all required fields and empty parts array', () => {
      const intervention: Intervention = {
        barcode: 'BC1234567890',
        date: new Date('2024-03-10'),
        type: { name: 'Annual Service', code: 'AS' },
        servicer: 'servicer-001',
        description: 'Redovni servis',
        notes: '',
        errorCode: 'E01',
        distance: 15,
        parts: [],
      };

      expect(intervention.barcode).toBe('BC1234567890');
      expect(intervention.date).toEqual(new Date('2024-03-10'));
      expect(intervention.type.code).toBe('AS');
      expect(intervention.servicer).toBe('servicer-001');
      expect(intervention.parts).toEqual([]);
      expect(intervention.parts.length).toBe(0);
    });

    it('TC-IN-05: should accept Intervention with optional id and setup', () => {
      const intervention: Intervention = {
        id: 'inv-abc-123',
        barcode: 'BC1234567890',
        date: new Date('2024-03-10'),
        type: { name: 'Annual Service', code: 'AS' },
        servicer: 'servicer-001',
        description: 'Redovni servis',
        notes: '',
        errorCode: '',
        distance: 0,
        parts: [],
        setup: { gasType: 'natural', pressure: '2.5' },
      };

      expect(intervention.id).toBe('inv-abc-123');
      expect(intervention.setup).toEqual({ gasType: 'natural', pressure: '2.5' });
    });

    it('TC-IN-06: should accept Intervention with multiple parts', () => {
      const parts: InterventionPart[] = [
        { name: 'Filter', code: 'FLT-001', quantity: 1 },
        { name: 'Gasket', code: 'GSK-002', quantity: 2 },
      ];

      const intervention: Intervention = {
        barcode: 'BC9876543210',
        date: new Date('2024-04-01'),
        type: { name: 'Repair', code: 'REP' },
        servicer: 'servicer-002',
        description: 'Popravka',
        notes: 'Urgentno',
        errorCode: 'E05',
        distance: 30,
        parts,
      };

      expect(intervention.parts.length).toBe(2);
      expect(intervention.parts[0].code).toBe('FLT-001');
      expect(intervention.parts[1].quantity).toBe(2);
    });

    it('TC-IN-07: Intervention should NOT have dateOfPurchase field', () => {
      const intervention: Intervention = {
        barcode: 'BC1234567890',
        date: new Date('2024-03-10'),
        type: { name: 'Annual Service', code: 'AS' },
        servicer: 'servicer-001',
        description: 'Test',
        notes: '',
        errorCode: '',
        distance: 0,
        parts: [],
      };

      expect('dateOfPurchase' in intervention).toBe(false);
    });

    // ─── Parameterizovani testovi: Intervention distance boundary values ────────
    const distanceCases = [0, 1, 5, 10, 15, 20, 30, 50, 100, 500];

    distanceCases.forEach((distance) => {
      it(`Intervention should accept distance=${distance}`, () => {
        const intervention: Intervention = {
          barcode: 'BC001',
          date: new Date(),
          type: { name: 'Service', code: 'S' },
          servicer: 'svc',
          description: 'Test',
          notes: '',
          errorCode: '',
          distance,
          parts: [],
        };
        expect(intervention.distance).toBe(distance);
      });
    });

    // ─── Parameterizovani testovi: Intervention parts count ────────────────────
    const partsCases = [0, 1, 2, 3, 4, 5, 10];

    partsCases.forEach((count) => {
      it(`Intervention should accept ${count} parts`, () => {
        const parts: InterventionPart[] = Array.from({ length: count }, (_, i) => ({
          name: `Part ${i}`,
          code: `P-${String(i).padStart(3, '0')}`,
          quantity: 1,
        }));

        const intervention: Intervention = {
          barcode: 'BC001',
          date: new Date(),
          type: { name: 'Service', code: 'S' },
          servicer: 'svc',
          description: 'Test',
          notes: '',
          errorCode: '',
          distance: 0,
          parts,
        };

        expect(intervention.parts.length).toBe(count);
      });
    });

    // ─── Parameterizovani testovi: Intervention date edge cases ────────────────
    const dateCases = [
      new Date('2000-01-01'),
      new Date('2020-06-15'),
      new Date('2024-03-10'),
      new Date('2025-12-31'),
      new Date('1970-01-01'),  // epoch
    ];

    dateCases.forEach((date) => {
      it(`Intervention should accept date ${date.toISOString().slice(0, 10)}`, () => {
        const intervention: Intervention = {
          barcode: 'BC001',
          date,
          type: { name: 'Service', code: 'S' },
          servicer: 'svc',
          description: 'Test',
          notes: '',
          errorCode: '',
          distance: 0,
          parts: [],
        };
        expect(intervention.date).toEqual(date);
        expect(intervention.date instanceof Date).toBe(true);
      });
    });

    // ─── Parameterizovani testovi: errorCode values ───────────────────────────
    const errorCodeCases = ['', 'E01', 'E05', 'E99', 'error_no_error', '905 - Greška', '9E5'];

    errorCodeCases.forEach((errorCode) => {
      it(`Intervention should accept errorCode="${errorCode}"`, () => {
        const intervention: Intervention = {
          barcode: 'BC001',
          date: new Date(),
          type: { name: 'Service', code: 'S' },
          servicer: 'svc',
          description: 'Test',
          notes: '',
          errorCode,
          distance: 0,
          parts: [],
        };
        expect(intervention.errorCode).toBe(errorCode);
      });
    });

    // ─── Parameterizovani testovi: barcode formats ────────────────────────────
    const barcodeCases = [
      'BC1234567890',
      'SN1234567890123456789',
      '123456789012',
      'AAABBBCCC',
      'A'.repeat(50),
    ];

    barcodeCases.forEach((barcode) => {
      it(`Intervention should accept barcode="${barcode.substring(0, 30)}"`, () => {
        const intervention: Intervention = {
          barcode,
          date: new Date(),
          type: { name: 'Service', code: 'S' },
          servicer: 'svc',
          description: 'Test',
          notes: '',
          errorCode: '',
          distance: 0,
          parts: [],
        };
        expect(intervention.barcode).toBe(barcode);
      });
    });

    // ─── Optional id ──────────────────────────────────────────────────────────
    it('Intervention id should be undefined when not provided', () => {
      const intervention: Intervention = {
        barcode: 'BC001',
        date: new Date(),
        type: { name: 'Service', code: 'S' },
        servicer: 'svc',
        description: 'Test',
        notes: '',
        errorCode: '',
        distance: 0,
        parts: [],
      };
      expect(intervention.id).toBeUndefined();
    });

    it('Intervention id should be present when provided', () => {
      const intervention: Intervention = {
        id: 'inv-001',
        barcode: 'BC001',
        date: new Date(),
        type: { name: 'Service', code: 'S' },
        servicer: 'svc',
        description: 'Test',
        notes: '',
        errorCode: '',
        distance: 0,
        parts: [],
      };
      expect(intervention.id).toBe('inv-001');
    });

    // ─── Optional setup ───────────────────────────────────────────────────────
    it('Intervention setup should be undefined when not provided', () => {
      const intervention: Intervention = {
        barcode: 'BC001',
        date: new Date(),
        type: { name: 'Service', code: 'S' },
        servicer: 'svc',
        description: 'Test',
        notes: '',
        errorCode: '',
        distance: 0,
        parts: [],
      };
      expect(intervention.setup).toBeUndefined();
    });

    it('Intervention setup can contain arbitrary key-value pairs', () => {
      const setup: Record<string, unknown> = {
        gasType: 'natural',
        pressure: '2.5',
        voltage: '230',
        leakTested: true,
        zones: 3,
      };

      const intervention: Intervention = {
        barcode: 'BC001',
        date: new Date(),
        type: { name: 'Service', code: 'S' },
        servicer: 'svc',
        description: 'Test',
        notes: '',
        errorCode: '',
        distance: 0,
        parts: [],
        setup,
      };

      expect(intervention.setup!['gasType']).toBe('natural');
      expect(intervention.setup!['leakTested']).toBe(true);
      expect(intervention.setup!['zones']).toBe(3);
    });

    it('Intervention setup can be empty object', () => {
      const intervention: Intervention = {
        barcode: 'BC001',
        date: new Date(),
        type: { name: 'Service', code: 'S' },
        servicer: 'svc',
        description: 'Test',
        notes: '',
        errorCode: '',
        distance: 0,
        parts: [],
        setup: {},
      };
      expect(intervention.setup).toEqual({});
    });

    // ─── Required fields presence ─────────────────────────────────────────────
    const requiredInterventionFields = [
      'barcode', 'date', 'type', 'servicer', 'description', 'notes', 'errorCode', 'distance', 'parts',
    ];

    requiredInterventionFields.forEach((field) => {
      it(`Intervention should have required field: ${field}`, () => {
        const intervention: Intervention = {
          barcode: 'BC001',
          date: new Date(),
          type: { name: 'Service', code: 'S' },
          servicer: 'svc',
          description: 'Test',
          notes: '',
          errorCode: '',
          distance: 0,
          parts: [],
        };
        expect(field in intervention).toBe(true);
      });
    });

    // ─── notes edge cases ─────────────────────────────────────────────────────
    it('Intervention notes can be empty string', () => {
      const intervention: Intervention = {
        barcode: 'BC001',
        date: new Date(),
        type: { name: 'S', code: 'S' },
        servicer: 'svc',
        description: 'Test',
        notes: '',
        errorCode: '',
        distance: 0,
        parts: [],
      };
      expect(intervention.notes).toBe('');
    });

    it('Intervention notes can be a long text', () => {
      const longNote = 'Note '.repeat(200);
      const intervention: Intervention = {
        barcode: 'BC001',
        date: new Date(),
        type: { name: 'S', code: 'S' },
        servicer: 'svc',
        description: 'Test',
        notes: longNote,
        errorCode: '',
        distance: 0,
        parts: [],
      };
      expect(intervention.notes.length).toBeGreaterThan(100);
    });

    it('Intervention description can contain unicode text', () => {
      const intervention: Intervention = {
        barcode: 'BC001',
        date: new Date(),
        type: { name: 'S', code: 'S' },
        servicer: 'svc',
        description: 'Redovni godišnji servis - zamenjen filtar šljake',
        notes: '',
        errorCode: '',
        distance: 0,
        parts: [],
      };
      expect(intervention.description).toContain('šljake');
    });

    // ─── type field deep checks ───────────────────────────────────────────────
    it('Intervention type.name should be a string', () => {
      const intervention: Intervention = {
        barcode: 'BC001',
        date: new Date(),
        type: { name: 'Annual Service', code: 'AS' },
        servicer: 'svc',
        description: 'Test',
        notes: '',
        errorCode: '',
        distance: 0,
        parts: [],
      };
      expect(typeof intervention.type.name).toBe('string');
    });

    it('Intervention type.code should be a string', () => {
      const intervention: Intervention = {
        barcode: 'BC001',
        date: new Date(),
        type: { name: 'Annual Service', code: 'AS' },
        servicer: 'svc',
        description: 'Test',
        notes: '',
        errorCode: '',
        distance: 0,
        parts: [],
      };
      expect(typeof intervention.type.code).toBe('string');
    });
  });
});
