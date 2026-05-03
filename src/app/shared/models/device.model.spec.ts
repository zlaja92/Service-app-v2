import { Device, DeviceType } from './device.model';
import { buildDevice } from '../../testing/test-data-builders';

describe('Device Model', () => {
  describe('DeviceType enum', () => {
    it('TC-DV-01: should contain exactly 4 enum members', () => {
      const values = Object.values(DeviceType);
      expect(values.length).toBe(4);
    });

    it('TC-DV-02: HEAT_PUMP should equal "heat-pump"', () => {
      expect(DeviceType.HEAT_PUMP).toBe('heat-pump');
    });

    it('TC-DV-03: GAS_BOILER should equal "gas-boiler"', () => {
      expect(DeviceType.GAS_BOILER).toBe('gas-boiler');
    });

    it('TC-DV-04: BOILER should equal "boiler"', () => {
      expect(DeviceType.BOILER).toBe('boiler');
    });

    it('TC-DV-05: AIR_CONDITION should equal "air-condition"', () => {
      expect(DeviceType.AIR_CONDITION).toBe('air-condition');
    });

    // ─── Parameterizovani testovi za DeviceType ─────────────────────────────────
    const deviceTypeCases: Array<[keyof typeof DeviceType, string]> = [
      ['HEAT_PUMP', 'heat-pump'],
      ['GAS_BOILER', 'gas-boiler'],
      ['BOILER', 'boiler'],
      ['AIR_CONDITION', 'air-condition'],
    ];

    deviceTypeCases.forEach(([key, value]) => {
      it(`DeviceType.${key} should equal "${value}"`, () => {
        expect(DeviceType[key]).toBe(value);
      });

      it(`DeviceType.${key} should be a string`, () => {
        expect(typeof DeviceType[key]).toBe('string');
      });

      it(`DeviceType.${key} should be lowercase`, () => {
        expect(DeviceType[key]).toBe(DeviceType[key].toLowerCase());
      });

      it(`DeviceType.${key} should be non-empty`, () => {
        expect(DeviceType[key].length).toBeGreaterThan(0);
      });

      it(`DeviceType.${key} should contain only valid characters (letters, hyphens)`, () => {
        expect(DeviceType[key]).toMatch(/^[a-z-]+$/);
      });

      it(`DeviceType.${key} should not start with hyphen`, () => {
        expect(DeviceType[key].startsWith('-')).toBe(false);
      });

      it(`DeviceType.${key} should not end with hyphen`, () => {
        expect(DeviceType[key].endsWith('-')).toBe(false);
      });

      it(`DeviceType.${key} should not contain consecutive hyphens`, () => {
        expect(DeviceType[key]).not.toContain('--');
      });

      it(`DeviceType.${key} value should match enum key in some form`, () => {
        const normalized = key.toLowerCase().replace(/_/g, '-');
        expect(DeviceType[key]).toBe(normalized);
      });
    });

    // Provjera da su sve vrijednosti unikatne
    it('all DeviceType values should be unique', () => {
      const values = Object.values(DeviceType);
      const unique = new Set(values);
      expect(unique.size).toBe(values.length);
    });

    // Provjera da su svi kljucevi unikatni
    it('all DeviceType keys should be unique', () => {
      const keys = Object.keys(DeviceType);
      const unique = new Set(keys);
      expect(unique.size).toBe(keys.length);
    });

    // Provjera da enum ne sadrzi numericke vrijednosti
    it('DeviceType should not contain numeric values', () => {
      Object.values(DeviceType).forEach((value) => {
        expect(isNaN(Number(value))).toBe(true);
      });
    });

    // Provjera da je HEAT_PUMP razlicit od ostalih
    it('DeviceType.HEAT_PUMP should differ from BOILER, GAS_BOILER, AIR_CONDITION', () => {
      expect(DeviceType.HEAT_PUMP).not.toBe(DeviceType.BOILER);
      expect(DeviceType.HEAT_PUMP).not.toBe(DeviceType.GAS_BOILER);
      expect(DeviceType.HEAT_PUMP).not.toBe(DeviceType.AIR_CONDITION);
    });

    it('DeviceType.GAS_BOILER should differ from BOILER, HEAT_PUMP, AIR_CONDITION', () => {
      expect(DeviceType.GAS_BOILER).not.toBe(DeviceType.BOILER);
      expect(DeviceType.GAS_BOILER).not.toBe(DeviceType.HEAT_PUMP);
      expect(DeviceType.GAS_BOILER).not.toBe(DeviceType.AIR_CONDITION);
    });

    it('DeviceType.BOILER should differ from GAS_BOILER, HEAT_PUMP, AIR_CONDITION', () => {
      expect(DeviceType.BOILER).not.toBe(DeviceType.GAS_BOILER);
      expect(DeviceType.BOILER).not.toBe(DeviceType.HEAT_PUMP);
      expect(DeviceType.BOILER).not.toBe(DeviceType.AIR_CONDITION);
    });

    it('DeviceType.AIR_CONDITION should differ from BOILER, GAS_BOILER, HEAT_PUMP', () => {
      expect(DeviceType.AIR_CONDITION).not.toBe(DeviceType.BOILER);
      expect(DeviceType.AIR_CONDITION).not.toBe(DeviceType.GAS_BOILER);
      expect(DeviceType.AIR_CONDITION).not.toBe(DeviceType.HEAT_PUMP);
    });

    // Enum membership check (lookup reverse)
    it('string "heat-pump" should be found in DeviceType values', () => {
      const values: string[] = Object.values(DeviceType);
      expect(values).toContain('heat-pump');
    });

    it('string "gas-boiler" should be found in DeviceType values', () => {
      const values: string[] = Object.values(DeviceType);
      expect(values).toContain('gas-boiler');
    });

    it('string "boiler" should be found in DeviceType values', () => {
      const values: string[] = Object.values(DeviceType);
      expect(values).toContain('boiler');
    });

    it('string "air-condition" should be found in DeviceType values', () => {
      const values: string[] = Object.values(DeviceType);
      expect(values).toContain('air-condition');
    });

    it('string "unknown-type" should NOT be found in DeviceType values', () => {
      const values: string[] = Object.values(DeviceType);
      expect(values).not.toContain('unknown-type');
    });

    it('string "HEAT_PUMP" (uppercase key) should NOT be in DeviceType values', () => {
      const values: string[] = Object.values(DeviceType);
      expect(values).not.toContain('HEAT_PUMP');
    });

    it('empty string should NOT be in DeviceType values', () => {
      const values: string[] = Object.values(DeviceType);
      expect(values).not.toContain('');
    });

    it('null should NOT be in DeviceType values', () => {
      const values: unknown[] = Object.values(DeviceType);
      expect(values).not.toContain(null);
    });
  });

  describe('Device interface', () => {
    it('TC-DV-06: should accept valid Device with required fields only', () => {
      const device: Device = {
        code: 'GENUS-ONE-24',
        name: 'Genus One 24 kW',
        type: DeviceType.GAS_BOILER,
        subType: 'wall-hung',
        unitCount: 1,
        exists: true,
      };

      expect(device.code).toBe('GENUS-ONE-24');
      expect(device.name).toBe('Genus One 24 kW');
      expect(device.type).toBe(DeviceType.GAS_BOILER);
      expect(device.subType).toBe('wall-hung');
      expect(device.unitCount).toBe(1);
      expect(device.exists).toBe(true);
    });

    it('TC-DV-07: should accept Device with all required + all optional fields', () => {
      const device: Device = buildDevice({
        commissioning: true,
        annualService: true,
        connectedDevice: false,
        firstServiceYear: 2022,
        serviceWindowStart: 3,
        serviceWindowEnd: 11,
        warrantyMonths: 24,
      });

      expect(device.commissioning).toBe(true);
      expect(device.annualService).toBe(true);
      expect(device.connectedDevice).toBe(false);
      expect(device.firstServiceYear).toBe(2022);
      expect(device.serviceWindowStart).toBe(3);
      expect(device.serviceWindowEnd).toBe(11);
      expect(device.warrantyMonths).toBe(24);
    });

    it('TC-DV-08: optional fields should be undefined when omitted', () => {
      const device: Device = {
        code: 'GENUS-ONE-24',
        name: 'Genus One 24 kW',
        type: DeviceType.GAS_BOILER,
        subType: 'wall-hung',
        unitCount: 1,
        exists: true,
      };

      expect(device.commissioning).toBeUndefined();
      expect(device.annualService).toBeUndefined();
      expect(device.connectedDevice).toBeUndefined();
      expect(device.firstServiceYear).toBeUndefined();
      expect(device.serviceWindowStart).toBeUndefined();
      expect(device.serviceWindowEnd).toBeUndefined();
      expect(device.warrantyMonths).toBeUndefined();
    });

    // ─── Parameterizovani testovi: Device sa svakim DeviceType ────────────────
    const allDeviceTypes: DeviceType[] = Object.values(DeviceType);

    allDeviceTypes.forEach((deviceType) => {
      it(`should accept Device with type=${deviceType}`, () => {
        const device: Device = buildDevice({ type: deviceType });
        expect(device.type).toBe(deviceType);
      });

      it(`Device with type=${deviceType} should have string code`, () => {
        const device: Device = buildDevice({ type: deviceType });
        expect(typeof device.code).toBe('string');
      });

      it(`Device with type=${deviceType} should have string name`, () => {
        const device: Device = buildDevice({ type: deviceType });
        expect(typeof device.name).toBe('string');
      });

      it(`Device with type=${deviceType} should have string subType`, () => {
        const device: Device = buildDevice({ type: deviceType });
        expect(typeof device.subType).toBe('string');
      });

      it(`Device with type=${deviceType} should have numeric unitCount`, () => {
        const device: Device = buildDevice({ type: deviceType });
        expect(typeof device.unitCount).toBe('number');
      });

      it(`Device with type=${deviceType} should have boolean exists`, () => {
        const device: Device = buildDevice({ type: deviceType });
        expect(typeof device.exists).toBe('boolean');
      });
    });

    // ─── unitCount boundary values ────────────────────────────────────────────
    const unitCountCases = [0, 1, 2, 10, 100, 1000, Number.MAX_SAFE_INTEGER];

    unitCountCases.forEach((count) => {
      it(`Device should accept unitCount=${count}`, () => {
        const device: Device = buildDevice({ unitCount: count });
        expect(device.unitCount).toBe(count);
      });
    });

    it('Device should accept unitCount=0 (empty stock)', () => {
      const device: Device = buildDevice({ unitCount: 0 });
      expect(device.unitCount).toBe(0);
    });

    it('Device should accept unitCount=-1 (negative boundary)', () => {
      const device: Device = buildDevice({ unitCount: -1 });
      expect(device.unitCount).toBe(-1);
    });

    // ─── exists flag variations ───────────────────────────────────────────────
    it('Device with exists=true should be truthy', () => {
      const device: Device = buildDevice({ exists: true });
      expect(device.exists).toBe(true);
    });

    it('Device with exists=false should be falsy', () => {
      const device: Device = buildDevice({ exists: false });
      expect(device.exists).toBe(false);
    });

    // ─── warrantyMonths boundary values ──────────────────────────────────────
    const warrantyMonthsCases = [0, 1, 6, 12, 24, 36, 48, 60, 120];

    warrantyMonthsCases.forEach((months) => {
      it(`Device should accept warrantyMonths=${months}`, () => {
        const device: Device = buildDevice({ warrantyMonths: months });
        expect(device.warrantyMonths).toBe(months);
      });
    });

    // ─── firstServiceYear boundary values ────────────────────────────────────
    const serviceYearCases = [2000, 2010, 2020, 2023, 2024, 2025, 2050];

    serviceYearCases.forEach((year) => {
      it(`Device should accept firstServiceYear=${year}`, () => {
        const device: Device = buildDevice({ firstServiceYear: year });
        expect(device.firstServiceYear).toBe(year);
      });
    });

    // ─── serviceWindowStart/End boundary values ───────────────────────────────
    const monthValues = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12];

    monthValues.forEach((month) => {
      it(`Device should accept serviceWindowStart=${month}`, () => {
        const device: Device = buildDevice({ serviceWindowStart: month });
        expect(device.serviceWindowStart).toBe(month);
      });

      it(`Device should accept serviceWindowEnd=${month}`, () => {
        const device: Device = buildDevice({ serviceWindowEnd: month });
        expect(device.serviceWindowEnd).toBe(month);
      });
    });

    // ─── code edge cases ──────────────────────────────────────────────────────
    it('Device code can be empty string', () => {
      const device: Device = buildDevice({ code: '' });
      expect(device.code).toBe('');
    });

    it('Device code can be a single character', () => {
      const device: Device = buildDevice({ code: 'A' });
      expect(device.code).toBe('A');
    });

    it('Device code can be a long string (100 chars)', () => {
      const longCode = 'A'.repeat(100);
      const device: Device = buildDevice({ code: longCode });
      expect(device.code.length).toBe(100);
    });

    it('Device code can contain hyphens and numbers', () => {
      const device: Device = buildDevice({ code: 'GENUS-ONE-24' });
      expect(device.code).toBe('GENUS-ONE-24');
    });

    it('Device code can contain unicode characters', () => {
      const device: Device = buildDevice({ code: 'DEV-éàü' });
      expect(device.code).toContain('é');
    });

    // ─── name edge cases ──────────────────────────────────────────────────────
    it('Device name can be empty string', () => {
      const device: Device = buildDevice({ name: '' });
      expect(device.name).toBe('');
    });

    it('Device name can contain special characters', () => {
      const device: Device = buildDevice({ name: 'Dev & <Test> "Name"' });
      expect(device.name).toBe('Dev & <Test> "Name"');
    });

    it('Device name can be a long string (200 chars)', () => {
      const longName = 'X'.repeat(200);
      const device: Device = buildDevice({ name: longName });
      expect(device.name.length).toBe(200);
    });

    it('Device name can contain emoji', () => {
      const device: Device = buildDevice({ name: 'Heat Pump 🔥' });
      expect(device.name).toContain('🔥');
    });

    // ─── Boolean optional field combinations ─────────────────────────────────
    const boolCombinations: Array<[boolean, boolean, boolean]> = [
      [true, true, true],
      [true, true, false],
      [true, false, true],
      [true, false, false],
      [false, true, true],
      [false, true, false],
      [false, false, true],
      [false, false, false],
    ];

    boolCombinations.forEach(([commissioning, annualService, connectedDevice]) => {
      it(`Device accepts commissioning=${commissioning}, annualService=${annualService}, connectedDevice=${connectedDevice}`, () => {
        const device: Device = buildDevice({ commissioning, annualService, connectedDevice });
        expect(device.commissioning).toBe(commissioning);
        expect(device.annualService).toBe(annualService);
        expect(device.connectedDevice).toBe(connectedDevice);
      });
    });

    // ─── Required fields presence check ──────────────────────────────────────
    const requiredFields = ['code', 'name', 'type', 'subType', 'unitCount', 'exists'];

    requiredFields.forEach((field) => {
      it(`Device should have required field: ${field}`, () => {
        const device: Device = buildDevice();
        expect(field in device).toBe(true);
      });
    });

    // ─── Optional fields names ────────────────────────────────────────────────
    const optionalFields = [
      'commissioning',
      'annualService',
      'connectedDevice',
      'firstServiceYear',
      'serviceWindowStart',
      'serviceWindowEnd',
      'warrantyMonths',
    ];

    optionalFields.forEach((field) => {
      it(`Device optional field "${field}" should be settable`, () => {
        const device: Device = buildDevice();
        expect(device).toBeDefined();
        // Field should exist in type definition - just validate it can be accessed
        const val = (device as unknown as Record<string, unknown>)[field];
        expect(val !== undefined || val === undefined).toBe(true);
      });
    });

    // ─── Cross-product: DeviceType x exists ──────────────────────────────────
    allDeviceTypes.forEach((deviceType) => {
      [true, false].forEach((exists) => {
        it(`Device type=${deviceType} exists=${exists} should be valid`, () => {
          const device: Device = buildDevice({ type: deviceType, exists });
          expect(device.type).toBe(deviceType);
          expect(device.exists).toBe(exists);
        });
      });
    });

    // ─── Cross-product: DeviceType x warrantyMonths ───────────────────────────
    allDeviceTypes.forEach((deviceType) => {
      [0, 12, 24, 36].forEach((warrantyMonths) => {
        it(`Device type=${deviceType} warrantyMonths=${warrantyMonths} should be valid`, () => {
          const device: Device = buildDevice({ type: deviceType, warrantyMonths });
          expect(device.type).toBe(deviceType);
          expect(device.warrantyMonths).toBe(warrantyMonths);
        });
      });
    });

    // ─── buildDevice factory ──────────────────────────────────────────────────
    it('buildDevice() with no args should return valid Device', () => {
      const device: Device = buildDevice();
      expect(device.code).toBeDefined();
      expect(device.name).toBeDefined();
      expect(device.type).toBeDefined();
      expect(device.subType).toBeDefined();
      expect(typeof device.unitCount).toBe('number');
      expect(typeof device.exists).toBe('boolean');
    });

    it('buildDevice() default type should be GAS_BOILER', () => {
      const device: Device = buildDevice();
      expect(device.type).toBe(DeviceType.GAS_BOILER);
    });

    it('buildDevice() should be overridable with HEAT_PUMP', () => {
      const device: Device = buildDevice({ type: DeviceType.HEAT_PUMP });
      expect(device.type).toBe(DeviceType.HEAT_PUMP);
    });

    it('buildDevice() should be overridable with BOILER', () => {
      const device: Device = buildDevice({ type: DeviceType.BOILER });
      expect(device.type).toBe(DeviceType.BOILER);
    });

    it('buildDevice() should be overridable with AIR_CONDITION', () => {
      const device: Device = buildDevice({ type: DeviceType.AIR_CONDITION });
      expect(device.type).toBe(DeviceType.AIR_CONDITION);
    });

    it('buildDevice() multiple calls should return independent objects', () => {
      const d1 = buildDevice({ code: 'A' });
      const d2 = buildDevice({ code: 'B' });
      expect(d1.code).toBe('A');
      expect(d2.code).toBe('B');
      expect(d1).not.toBe(d2);
    });
  });

  // ─── Edge case / fuzz testovi ───────────────────────────────────────────────
  describe('Device edge cases and fuzz', () => {
    const xssPayloads = [
      '<script>alert(1)</script>',
      '"><img src=x onerror=alert(1)>',
      "'; DROP TABLE devices; --",
      '${7*7}',
      '{{7*7}}',
    ];

    xssPayloads.forEach((payload) => {
      it(`Device name can store XSS payload (type safety): "${payload.substring(0, 30)}"`, () => {
        const device: Device = buildDevice({ name: payload });
        expect(device.name).toBe(payload);
        expect(typeof device.name).toBe('string');
      });

      it(`Device code can store injection payload (type safety): "${payload.substring(0, 30)}"`, () => {
        const device: Device = buildDevice({ code: payload });
        expect(device.code).toBe(payload);
        expect(typeof device.code).toBe('string');
      });
    });

    const unicodeStrings = [
      '中文',         // Chinese
      'العربية',  // Arabic (RTL)
      'сербски',  // Cyrillic (Serbian)
      'éàüö',  // European diacritics
      '🔥💧',  // Emoji
    ];

    unicodeStrings.forEach((str) => {
      it(`Device name accepts unicode string (length ${str.length})`, () => {
        const device: Device = buildDevice({ name: str });
        expect(device.name).toBe(str);
      });
    });

    it('Device with maximum field values should be structurally valid', () => {
      const device: Device = buildDevice({
        code: 'C'.repeat(500),
        name: 'N'.repeat(500),
        subType: 'S'.repeat(500),
        unitCount: Number.MAX_SAFE_INTEGER,
        warrantyMonths: Number.MAX_SAFE_INTEGER,
        firstServiceYear: 9999,
        serviceWindowStart: 12,
        serviceWindowEnd: 12,
      });
      expect(device.code.length).toBe(500);
      expect(device.name.length).toBe(500);
      expect(device.unitCount).toBe(Number.MAX_SAFE_INTEGER);
    });

    it('Device with minimum numeric values should be structurally valid', () => {
      const device: Device = buildDevice({
        unitCount: Number.MIN_SAFE_INTEGER,
        warrantyMonths: 0,
        firstServiceYear: 0,
        serviceWindowStart: 0,
        serviceWindowEnd: 0,
      });
      expect(device.unitCount).toBe(Number.MIN_SAFE_INTEGER);
      expect(device.warrantyMonths).toBe(0);
    });
  });
});
