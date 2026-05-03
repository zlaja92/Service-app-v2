import { Part, PartGroup } from './part.model';

describe('Part Model', () => {
  describe('PartGroup interface', () => {
    it('TC-PT-01: should accept PartGroup with all fields including optional id', () => {
      const partGroup: PartGroup = {
        id: 'pg-001',
        name: 'Filters',
        deviceId: 'device-abc',
      };

      expect(partGroup.id).toBe('pg-001');
      expect(partGroup.name).toBe('Filters');
      expect(partGroup.deviceId).toBe('device-abc');
    });

    it('TC-PT-02: should accept PartGroup without optional id', () => {
      const partGroup: PartGroup = {
        name: 'Gaskets',
        deviceId: 'device-xyz',
      };

      expect(partGroup.id).toBeUndefined();
      expect(partGroup.name).toBe('Gaskets');
      expect(partGroup.deviceId).toBe('device-xyz');
    });

    // ─── Parameterizovani testovi: PartGroup sa razlicitim imenima ─────────────
    const groupNameCases = [
      'Filters',
      'Gaskets',
      'Seals',
      'Pumps',
      'Sensors',
      'Valves',
      'Boards',
      'Fans',
      'Coils',
      'Thermostats',
      'Expansion Tanks',
      'Heat Exchangers',
    ];

    groupNameCases.forEach((name) => {
      it(`PartGroup should accept name="${name}"`, () => {
        const pg: PartGroup = { name, deviceId: 'device-001' };
        expect(pg.name).toBe(name);
        expect(typeof pg.name).toBe('string');
      });

      it(`PartGroup name="${name}" should be non-empty`, () => {
        const pg: PartGroup = { name, deviceId: 'device-001' };
        expect(pg.name.length).toBeGreaterThan(0);
      });
    });

    // ─── Parameterizovani testovi: PartGroup sa razlicitim deviceId ───────────
    const deviceIdCases = [
      'device-001',
      'GENUS-ONE-24',
      'HP-NIMBUS-8',
      'AC-UNIT-001',
      'dev_123',
      'a',
      'device-' + 'x'.repeat(50),
    ];

    deviceIdCases.forEach((deviceId) => {
      it(`PartGroup should accept deviceId="${deviceId.substring(0, 30)}"`, () => {
        const pg: PartGroup = { name: 'Filters', deviceId };
        expect(pg.deviceId).toBe(deviceId);
        expect(typeof pg.deviceId).toBe('string');
      });
    });

    // ─── PartGroup id variants ────────────────────────────────────────────────
    const idCases = [
      'pg-001',
      'pg-abc-def',
      '123456',
      'GROUP_ID_001',
      'a'.repeat(100),
    ];

    idCases.forEach((id) => {
      it(`PartGroup should accept id="${id.substring(0, 30)}"`, () => {
        const pg: PartGroup = { id, name: 'Filters', deviceId: 'device-001' };
        expect(pg.id).toBe(id);
        expect(typeof pg.id).toBe('string');
      });
    });

    it('PartGroup without id: id property should be undefined', () => {
      const pg: PartGroup = { name: 'Test', deviceId: 'dev-001' };
      expect(pg.id).toBeUndefined();
    });

    it('PartGroup name can be empty string', () => {
      const pg: PartGroup = { name: '', deviceId: 'dev-001' };
      expect(pg.name).toBe('');
    });

    it('PartGroup deviceId can be empty string', () => {
      const pg: PartGroup = { name: 'Test', deviceId: '' };
      expect(pg.deviceId).toBe('');
    });

    it('PartGroup name can be 1000 chars', () => {
      const longName = 'N'.repeat(1000);
      const pg: PartGroup = { name: longName, deviceId: 'dev-001' };
      expect(pg.name.length).toBe(1000);
    });

    it('PartGroup should have 2 or 3 own properties depending on id presence', () => {
      const withId: PartGroup = { id: 'pg-1', name: 'T', deviceId: 'd-1' };
      const withoutId: PartGroup = { name: 'T', deviceId: 'd-1' };
      expect(Object.keys(withId).length).toBe(3);
      expect(Object.keys(withoutId).length).toBe(2);
    });

    it('PartGroup should be JSON serializable', () => {
      const pg: PartGroup = { id: 'pg-001', name: 'Filters', deviceId: 'dev-001' };
      const parsed: PartGroup = JSON.parse(JSON.stringify(pg));
      expect(parsed.id).toBe('pg-001');
      expect(parsed.name).toBe('Filters');
      expect(parsed.deviceId).toBe('dev-001');
    });

    it('two PartGroups with same data should be deeply equal', () => {
      const pg1: PartGroup = { id: 'pg-001', name: 'Filters', deviceId: 'dev-001' };
      const pg2: PartGroup = { id: 'pg-001', name: 'Filters', deviceId: 'dev-001' };
      expect(pg1).toEqual(pg2);
    });

    it('PartGroup can accept unicode name', () => {
      const pg: PartGroup = { name: 'Filteri šljake', deviceId: 'dev-001' };
      expect(pg.name).toContain('š');
    });

    // ─── Array of PartGroups ──────────────────────────────────────────────────
    it('array of PartGroups should work correctly', () => {
      const groups: PartGroup[] = [
        { id: 'pg-001', name: 'Filters', deviceId: 'dev-001' },
        { id: 'pg-002', name: 'Gaskets', deviceId: 'dev-001' },
        { name: 'Seals', deviceId: 'dev-002' },
      ];
      expect(groups.length).toBe(3);
      expect(groups[0].name).toBe('Filters');
      expect(groups[2].id).toBeUndefined();
    });
  });

  describe('Part interface', () => {
    it('TC-PT-03: should accept Part with all fields and populated imageUrls', () => {
      const part: Part = {
        id: 'part-001',
        name: 'Air Filter',
        code: 'AF-001',
        price: 12.5,
        groupId: 'pg-001',
        deviceId: 'device-abc',
        inWarranty: true,
        imageUrls: ['https://example.com/img1.jpg', 'https://example.com/img2.jpg'],
      };

      expect(part.id).toBe('part-001');
      expect(part.name).toBe('Air Filter');
      expect(part.code).toBe('AF-001');
      expect(part.price).toBe(12.5);
      expect(part.groupId).toBe('pg-001');
      expect(part.deviceId).toBe('device-abc');
      expect(part.inWarranty).toBe(true);
      expect(part.imageUrls.length).toBe(2);
    });

    it('TC-PT-04: should accept Part without id and with empty imageUrls', () => {
      const part: Part = {
        name: 'Gasket',
        code: 'GSK-002',
        price: 3.99,
        groupId: 'pg-002',
        deviceId: 'device-xyz',
        inWarranty: false,
        imageUrls: [],
      };

      expect(part.id).toBeUndefined();
      expect(part.imageUrls).toEqual([]);
      expect(part.imageUrls.length).toBe(0);
    });

    it('TC-PT-05: imageUrls should be a string array', () => {
      const part: Part = {
        name: 'Seal',
        code: 'SL-003',
        price: 2.5,
        groupId: 'pg-001',
        deviceId: 'device-abc',
        inWarranty: false,
        imageUrls: ['url-1', 'url-2', 'url-3'],
      };

      expect(Array.isArray(part.imageUrls)).toBe(true);
      part.imageUrls.forEach((url) => {
        expect(typeof url).toBe('string');
      });
    });

    // ─── Parameterizovani testovi: price boundary values ─────────────────────
    const priceCases = [0, 0.01, 0.99, 1, 5, 12.5, 99.99, 100, 999.99, 10000];

    priceCases.forEach((price) => {
      it(`Part should accept price=${price}`, () => {
        const part: Part = {
          name: 'Test',
          code: 'T-001',
          price,
          groupId: 'pg-001',
          deviceId: 'dev-001',
          inWarranty: false,
          imageUrls: [],
        };
        expect(part.price).toBe(price);
      });

      it(`Part price=${price} should be a number`, () => {
        const part: Part = {
          name: 'Test',
          code: 'T-001',
          price,
          groupId: 'pg-001',
          deviceId: 'dev-001',
          inWarranty: false,
          imageUrls: [],
        };
        expect(typeof part.price).toBe('number');
      });
    });

    it('Part should accept price=0 (free part)', () => {
      const part: Part = {
        name: 'Test',
        code: 'T-001',
        price: 0,
        groupId: 'pg-001',
        deviceId: 'dev-001',
        inWarranty: false,
        imageUrls: [],
      };
      expect(part.price).toBe(0);
    });

    it('Part should accept negative price', () => {
      const part: Part = {
        name: 'Test',
        code: 'T-001',
        price: -1,
        groupId: 'pg-001',
        deviceId: 'dev-001',
        inWarranty: false,
        imageUrls: [],
      };
      expect(part.price).toBe(-1);
    });

    // ─── Parameterizovani testovi: inWarranty ────────────────────────────────
    [true, false].forEach((inWarranty) => {
      it(`Part inWarranty=${inWarranty} should be accepted`, () => {
        const part: Part = {
          name: 'Test',
          code: 'T-001',
          price: 10,
          groupId: 'pg-001',
          deviceId: 'dev-001',
          inWarranty,
          imageUrls: [],
        };
        expect(part.inWarranty).toBe(inWarranty);
        expect(typeof part.inWarranty).toBe('boolean');
      });
    });

    // ─── Parameterizovani testovi: imageUrls count ───────────────────────────
    const imageCountCases = [0, 1, 2, 3, 5, 10];

    imageCountCases.forEach((count) => {
      it(`Part should accept ${count} imageUrls`, () => {
        const imageUrls = Array.from({ length: count }, (_, i) => `https://example.com/img${i}.jpg`);
        const part: Part = {
          name: 'Test',
          code: 'T-001',
          price: 10,
          groupId: 'pg-001',
          deviceId: 'dev-001',
          inWarranty: false,
          imageUrls,
        };
        expect(part.imageUrls.length).toBe(count);
      });
    });

    // ─── Parameterizovani testovi: razliciti dijelovi ────────────────────────
    const partDataCases: Array<[string, string, number, boolean]> = [
      ['Air Filter', 'AF-001', 12.50, true],
      ['Gasket', 'GSK-002', 3.99, false],
      ['Seal', 'SL-003', 2.50, true],
      ['Pump', 'PMP-004', 150.00, false],
      ['Sensor NTC', 'SNS-005', 25.00, true],
      ['Gas Valve', 'VLV-006', 89.99, false],
      ['PCB Board', 'BRD-007', 250.00, true],
      ['Thermostat', 'THS-008', 35.00, false],
      ['Fan Motor', 'FAN-009', 120.00, true],
      ['Heat Coil', 'COL-010', 75.00, false],
      ['Expansion Tank', 'ET-011', 55.00, true],
      ['Safety Valve', 'SV-012', 18.00, false],
    ];

    partDataCases.forEach(([name, code, price, inWarranty]) => {
      it(`Part name="${name}" code="${code}" price=${price} inWarranty=${inWarranty} should be valid`, () => {
        const part: Part = {
          name,
          code,
          price,
          groupId: 'pg-001',
          deviceId: 'dev-001',
          inWarranty,
          imageUrls: [],
        };
        expect(part.name).toBe(name);
        expect(part.code).toBe(code);
        expect(part.price).toBe(price);
        expect(part.inWarranty).toBe(inWarranty);
      });
    });

    // ─── Required fields presence ─────────────────────────────────────────────
    const requiredPartFields = ['name', 'code', 'price', 'groupId', 'deviceId', 'inWarranty', 'imageUrls'];

    requiredPartFields.forEach((field) => {
      it(`Part should have required field: ${field}`, () => {
        const part: Part = {
          name: 'Test',
          code: 'T-001',
          price: 10,
          groupId: 'pg-001',
          deviceId: 'dev-001',
          inWarranty: false,
          imageUrls: [],
        };
        expect(field in part).toBe(true);
      });
    });

    // ─── imageUrls content ────────────────────────────────────────────────────
    it('Part imageUrls can contain http URLs', () => {
      const part: Part = {
        name: 'Test',
        code: 'T-001',
        price: 10,
        groupId: 'pg-001',
        deviceId: 'dev-001',
        inWarranty: false,
        imageUrls: ['http://example.com/1.jpg', 'https://cdn.example.com/2.png'],
      };
      expect(part.imageUrls[0]).toContain('http://');
      expect(part.imageUrls[1]).toContain('https://');
    });

    it('Part imageUrls can contain Firebase Storage URLs', () => {
      const gsUrl = 'https://storage.googleapis.com/project/tenant/part.jpg';
      const part: Part = {
        name: 'Test',
        code: 'T-001',
        price: 10,
        groupId: 'pg-001',
        deviceId: 'dev-001',
        inWarranty: false,
        imageUrls: [gsUrl],
      };
      expect(part.imageUrls[0]).toContain('googleapis.com');
    });

    // ─── Part without id ──────────────────────────────────────────────────────
    it('Part id should be undefined when not provided', () => {
      const part: Part = {
        name: 'Test',
        code: 'T-001',
        price: 10,
        groupId: 'pg-001',
        deviceId: 'dev-001',
        inWarranty: false,
        imageUrls: [],
      };
      expect(part.id).toBeUndefined();
    });

    // ─── Part with id ─────────────────────────────────────────────────────────
    it('Part id should be present when provided', () => {
      const part: Part = {
        id: 'part-test-001',
        name: 'Test',
        code: 'T-001',
        price: 10,
        groupId: 'pg-001',
        deviceId: 'dev-001',
        inWarranty: false,
        imageUrls: [],
      };
      expect(part.id).toBe('part-test-001');
    });

    // ─── Code edge cases ──────────────────────────────────────────────────────
    it('Part code can be empty string', () => {
      const part: Part = {
        name: 'Test',
        code: '',
        price: 10,
        groupId: 'pg-001',
        deviceId: 'dev-001',
        inWarranty: false,
        imageUrls: [],
      };
      expect(part.code).toBe('');
    });

    it('Part code can contain special characters', () => {
      const part: Part = {
        name: 'Test',
        code: 'AF-001/A',
        price: 10,
        groupId: 'pg-001',
        deviceId: 'dev-001',
        inWarranty: false,
        imageUrls: [],
      };
      expect(part.code).toBe('AF-001/A');
    });

    // ─── JSON serialization ───────────────────────────────────────────────────
    it('Part should be JSON serializable', () => {
      const part: Part = {
        id: 'part-001',
        name: 'Air Filter',
        code: 'AF-001',
        price: 12.5,
        groupId: 'pg-001',
        deviceId: 'dev-001',
        inWarranty: true,
        imageUrls: ['url1', 'url2'],
      };
      const parsed: Part = JSON.parse(JSON.stringify(part));
      expect(parsed.name).toBe('Air Filter');
      expect(parsed.price).toBe(12.5);
      expect(parsed.imageUrls.length).toBe(2);
    });

    // ─── Object spread ────────────────────────────────────────────────────────
    it('Part can be spread into new Part with overrides', () => {
      const original: Part = {
        id: 'part-001',
        name: 'Air Filter',
        code: 'AF-001',
        price: 12.5,
        groupId: 'pg-001',
        deviceId: 'dev-001',
        inWarranty: true,
        imageUrls: ['url1'],
      };
      const modified: Part = { ...original, price: 15.0 };
      expect(modified.price).toBe(15.0);
      expect(original.price).toBe(12.5);
    });

    // ─── Array of Parts ───────────────────────────────────────────────────────
    it('array of Parts should work correctly', () => {
      const parts: Part[] = partDataCases.map(([name, code, price, inWarranty]) => ({
        name,
        code,
        price,
        groupId: 'pg-001',
        deviceId: 'dev-001',
        inWarranty,
        imageUrls: [],
      }));
      expect(parts.length).toBe(partDataCases.length);
      parts.forEach((p) => {
        expect(typeof p.name).toBe('string');
        expect(typeof p.price).toBe('number');
        expect(typeof p.inWarranty).toBe('boolean');
        expect(Array.isArray(p.imageUrls)).toBe(true);
      });
    });

    // ─── Edge case: name and code with unicode ────────────────────────────────
    it('Part name can contain Cyrillic characters', () => {
      const part: Part = {
        name: 'Воздушный фильтр',
        code: 'AF-001',
        price: 10,
        groupId: 'pg-001',
        deviceId: 'dev-001',
        inWarranty: false,
        imageUrls: [],
      };
      expect(part.name).toBe('Воздушный фильтр');
    });

    it('Part name can contain diacritics', () => {
      const part: Part = {
        name: 'Filtar šljake čestice',
        code: 'FSC-001',
        price: 10,
        groupId: 'pg-001',
        deviceId: 'dev-001',
        inWarranty: false,
        imageUrls: [],
      };
      expect(part.name).toContain('š');
      expect(part.name).toContain('č');
    });
  });
});
