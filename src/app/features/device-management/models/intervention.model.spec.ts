import { DeviceType } from '../../../shared/models/device.model';
import {
  InterventionType,
  INTERVENTION_OPTIONS,
  COMMISSIONING_TYPES,
  ANNUAL_SERVICE_TYPES,
  INTERVENTION_DISPLAY_FIELDS,
  REGISTRATION_DISPLAY_FIELDS,
  HIDDEN_FIELDS,
  FAULT_DESCRIPTIONS,
  ERROR_CODES,
  DEFAULT_ERROR,
} from './intervention.model';

// ─── 1. InterventionType enum completeness ─────────────────────────

describe('InterventionType enum', () => {
  it('should define all 5 intervention types with correct values', () => {
    expect(InterventionType.COMMISSIONING).toBe('commissioning');
    expect(InterventionType.ANNUAL_SERVICE).toBe('annual_service');
    expect(InterventionType.INTERVENTION_REPAIR).toBe('interventionRepair');
    expect(InterventionType.INTERVENTION_NOISE).toBe('intervention_noise');
    expect(InterventionType.INTERVENTION_REPLACE).toBe('intervention_replace');
  });

  it('should have exactly 5 enum members', () => {
    const keys = Object.keys(InterventionType);
    expect(keys.length).toBe(5);
  });

  // ─── Parameterizovani testovi za InterventionType ─────────────────────────
  const interventionTypeCases: Array<[keyof typeof InterventionType, string]> = [
    ['COMMISSIONING', 'commissioning'],
    ['ANNUAL_SERVICE', 'annual_service'],
    ['INTERVENTION_REPAIR', 'interventionRepair'],
    ['INTERVENTION_NOISE', 'intervention_noise'],
    ['INTERVENTION_REPLACE', 'intervention_replace'],
  ];

  interventionTypeCases.forEach(([key, value]) => {
    it(`InterventionType.${key} should equal "${value}"`, () => {
      expect(InterventionType[key]).toBe(value);
    });

    it(`InterventionType.${key} should be a string`, () => {
      expect(typeof InterventionType[key]).toBe('string');
    });

    it(`InterventionType.${key} should be non-empty`, () => {
      expect(InterventionType[key].length).toBeGreaterThan(0);
    });

    it(`InterventionType.${key} should be lowercase`, () => {
      expect(InterventionType[key]).toBe(InterventionType[key].toLowerCase());
    });

    it(`InterventionType.${key} should not contain spaces`, () => {
      expect(InterventionType[key]).not.toContain(' ');
    });
  });

  it('InterventionType values should all be unique', () => {
    const values = Object.values(InterventionType);
    const unique = new Set(values);
    expect(unique.size).toBe(values.length);
  });

  it('InterventionType should not contain numeric values', () => {
    Object.values(InterventionType).forEach((val) => {
      expect(isNaN(Number(val))).toBe(true);
    });
  });
});

// ─── 2. INTERVENTION_OPTIONS mapping per DeviceType ───────────────

describe('INTERVENTION_OPTIONS', () => {
  it('should contain entries for BOILER, GAS_BOILER, HEAT_PUMP, AIR_CONDITION', () => {
    expect(INTERVENTION_OPTIONS[DeviceType.BOILER]).toBeDefined();
    expect(INTERVENTION_OPTIONS[DeviceType.GAS_BOILER]).toBeDefined();
    expect(INTERVENTION_OPTIONS[DeviceType.HEAT_PUMP]).toBeDefined();
    expect(INTERVENTION_OPTIONS[DeviceType.AIR_CONDITION]).toBeDefined();
  });

  it('should have 3 options for BOILER (repair, noise, replace)', () => {
    const options = INTERVENTION_OPTIONS[DeviceType.BOILER]!;
    expect(options.length).toBe(3);

    const keys = options.map(o => o.key);
    expect(keys).toContain(InterventionType.INTERVENTION_REPAIR);
    expect(keys).toContain(InterventionType.INTERVENTION_NOISE);
    expect(keys).toContain(InterventionType.INTERVENTION_REPLACE);
  });

  it('should have 1 option for GAS_BOILER (repair only)', () => {
    const options = INTERVENTION_OPTIONS[DeviceType.GAS_BOILER]!;
    expect(options.length).toBe(1);
    expect(options[0].key).toBe(InterventionType.INTERVENTION_REPAIR);
  });

  it('should have 1 option for HEAT_PUMP (repair only)', () => {
    const options = INTERVENTION_OPTIONS[DeviceType.HEAT_PUMP]!;
    expect(options.length).toBe(1);
    expect(options[0].key).toBe(InterventionType.INTERVENTION_REPAIR);
  });

  it('should have 1 option for AIR_CONDITION (repair only)', () => {
    const options = INTERVENTION_OPTIONS[DeviceType.AIR_CONDITION]!;
    expect(options.length).toBe(1);
    expect(options[0].key).toBe(InterventionType.INTERVENTION_REPAIR);
  });

  it('should not include COMMISSIONING type in any INTERVENTION_OPTIONS entry', () => {
    for (const deviceType of Object.values(DeviceType)) {
      const options = INTERVENTION_OPTIONS[deviceType] ?? [];
      const hasCommissioning = options.some(o => o.key === InterventionType.COMMISSIONING);
      expect(hasCommissioning).withContext(`DeviceType ${deviceType} should not have COMMISSIONING in INTERVENTION_OPTIONS`).toBeFalse();
    }
  });

  it('should not include ANNUAL_SERVICE type in any INTERVENTION_OPTIONS entry', () => {
    for (const deviceType of Object.values(DeviceType)) {
      const options = INTERVENTION_OPTIONS[deviceType] ?? [];
      const hasAnnual = options.some(o => o.key === InterventionType.ANNUAL_SERVICE);
      expect(hasAnnual).withContext(`DeviceType ${deviceType} should not have ANNUAL_SERVICE in INTERVENTION_OPTIONS`).toBeFalse();
    }
  });

  it('each option should have a non-empty translatable label string', () => {
    for (const [deviceType, options] of Object.entries(INTERVENTION_OPTIONS)) {
      for (const option of options!) {
        expect(typeof option.label).withContext(`${deviceType} → ${option.key}`).toBe('string');
        expect(option.label.length).withContext(`${deviceType} → ${option.key}`).toBeGreaterThan(0);
      }
    }
  });

  it('should return undefined (not empty array) for non-existent device type', () => {
    const nonExistentType = 'unknown-type' as DeviceType;
    expect(INTERVENTION_OPTIONS[nonExistentType]).toBeUndefined();
  });

  // ─── Parameterizovani testovi: svaka opcija po DeviceType ──────────────────
  const allDeviceTypes = Object.values(DeviceType);

  allDeviceTypes.forEach((deviceType) => {
    it(`INTERVENTION_OPTIONS[${deviceType}] should be defined`, () => {
      expect(INTERVENTION_OPTIONS[deviceType]).toBeDefined();
    });

    it(`INTERVENTION_OPTIONS[${deviceType}] should be an array`, () => {
      expect(Array.isArray(INTERVENTION_OPTIONS[deviceType])).toBe(true);
    });

    it(`INTERVENTION_OPTIONS[${deviceType}] should have at least 1 option`, () => {
      const options = INTERVENTION_OPTIONS[deviceType]!;
      expect(options.length).toBeGreaterThanOrEqual(1);
    });

    const options = INTERVENTION_OPTIONS[deviceType] ?? [];
    options.forEach((option, idx) => {
      it(`INTERVENTION_OPTIONS[${deviceType}][${idx}].key should be a valid InterventionType`, () => {
        expect(Object.values(InterventionType)).toContain(option.key);
      });

      it(`INTERVENTION_OPTIONS[${deviceType}][${idx}].label should start with "intervention_type_"`, () => {
        expect(option.label.startsWith('intervention_type_')).withContext(
          `option.label="${option.label}" for device=${deviceType}`
        ).toBeTrue();
      });

      it(`INTERVENTION_OPTIONS[${deviceType}][${idx}].label should be non-empty`, () => {
        expect(option.label.length).toBeGreaterThan(0);
      });

      it(`INTERVENTION_OPTIONS[${deviceType}][${idx}] should have key and label properties`, () => {
        expect('key' in option).toBe(true);
        expect('label' in option).toBe(true);
      });
    });
  });

  // ─── BOILER - svaka od 3 opcije detaljno ─────────────────────────────────
  it('BOILER INTERVENTION_REPAIR option should have correct label', () => {
    const options = INTERVENTION_OPTIONS[DeviceType.BOILER]!;
    const repair = options.find(o => o.key === InterventionType.INTERVENTION_REPAIR);
    expect(repair).toBeDefined();
    expect(repair!.label).toBe('intervention_type_repair_boiler');
  });

  it('BOILER INTERVENTION_NOISE option should have correct label', () => {
    const options = INTERVENTION_OPTIONS[DeviceType.BOILER]!;
    const noise = options.find(o => o.key === InterventionType.INTERVENTION_NOISE);
    expect(noise).toBeDefined();
    expect(noise!.label).toBe('intervention_type_noise_boiler');
  });

  it('BOILER INTERVENTION_REPLACE option should have correct label', () => {
    const options = INTERVENTION_OPTIONS[DeviceType.BOILER]!;
    const replace = options.find(o => o.key === InterventionType.INTERVENTION_REPLACE);
    expect(replace).toBeDefined();
    expect(replace!.label).toBe('intervention_type_replace_boiler');
  });

  it('GAS_BOILER INTERVENTION_REPAIR option should have correct label', () => {
    const options = INTERVENTION_OPTIONS[DeviceType.GAS_BOILER]!;
    expect(options[0].label).toBe('intervention_type_repair_gas_boiler');
  });

  it('HEAT_PUMP INTERVENTION_REPAIR option should have correct label', () => {
    const options = INTERVENTION_OPTIONS[DeviceType.HEAT_PUMP]!;
    expect(options[0].label).toBe('intervention_type_repair_heat_pump');
  });

  it('AIR_CONDITION INTERVENTION_REPAIR option should have correct label', () => {
    const options = INTERVENTION_OPTIONS[DeviceType.AIR_CONDITION]!;
    expect(options[0].label).toBe('intervention_type_repair_air_condition');
  });
});

// ─── 3. COMMISSIONING_TYPES mapping per DeviceType ────────────────

describe('COMMISSIONING_TYPES', () => {
  it('should define commissioning for GAS_BOILER with correct key and label', () => {
    const entry = COMMISSIONING_TYPES[DeviceType.GAS_BOILER];
    expect(entry).toBeDefined();
    expect(entry!.key).toBe(InterventionType.COMMISSIONING);
    expect(entry!.label).toBe('intervention_type_commissioning_gas_boiler');
  });

  it('should define commissioning for HEAT_PUMP with correct key and label', () => {
    const entry = COMMISSIONING_TYPES[DeviceType.HEAT_PUMP];
    expect(entry).toBeDefined();
    expect(entry!.key).toBe(InterventionType.COMMISSIONING);
    expect(entry!.label).toBe('intervention_type_commissioning_heat_pump');
  });

  it('should NOT define commissioning for BOILER', () => {
    expect(COMMISSIONING_TYPES[DeviceType.BOILER]).toBeUndefined();
  });

  it('should NOT define commissioning for AIR_CONDITION', () => {
    expect(COMMISSIONING_TYPES[DeviceType.AIR_CONDITION]).toBeUndefined();
  });

  // ─── Parameterizovani testovi za COMMISSIONING_TYPES ─────────────────────
  const commissioningDefinedTypes: DeviceType[] = [DeviceType.GAS_BOILER, DeviceType.HEAT_PUMP];
  const commissioningUndefinedTypes: DeviceType[] = [DeviceType.BOILER, DeviceType.AIR_CONDITION];

  commissioningDefinedTypes.forEach((deviceType) => {
    it(`COMMISSIONING_TYPES[${deviceType}] should be defined`, () => {
      expect(COMMISSIONING_TYPES[deviceType]).toBeDefined();
    });

    it(`COMMISSIONING_TYPES[${deviceType}].key should be InterventionType.COMMISSIONING`, () => {
      expect(COMMISSIONING_TYPES[deviceType]!.key).toBe(InterventionType.COMMISSIONING);
    });

    it(`COMMISSIONING_TYPES[${deviceType}].label should be a non-empty string`, () => {
      const label = COMMISSIONING_TYPES[deviceType]!.label;
      expect(typeof label).toBe('string');
      expect(label.length).toBeGreaterThan(0);
    });

    it(`COMMISSIONING_TYPES[${deviceType}].label should start with "intervention_type_commissioning_"`, () => {
      const label = COMMISSIONING_TYPES[deviceType]!.label;
      expect(label.startsWith('intervention_type_commissioning_')).toBeTrue();
    });
  });

  commissioningUndefinedTypes.forEach((deviceType) => {
    it(`COMMISSIONING_TYPES[${deviceType}] should be undefined`, () => {
      expect(COMMISSIONING_TYPES[deviceType]).toBeUndefined();
    });
  });
});

// ─── 4. ANNUAL_SERVICE_TYPES mapping per DeviceType ───────────────

describe('ANNUAL_SERVICE_TYPES', () => {
  it('should define annual service for GAS_BOILER with correct key and label', () => {
    const entry = ANNUAL_SERVICE_TYPES[DeviceType.GAS_BOILER];
    expect(entry).toBeDefined();
    expect(entry!.key).toBe(InterventionType.ANNUAL_SERVICE);
    expect(entry!.label).toBe('intervention_type_annual_gas_boiler');
  });

  it('should define annual service for HEAT_PUMP with correct key and label', () => {
    const entry = ANNUAL_SERVICE_TYPES[DeviceType.HEAT_PUMP];
    expect(entry).toBeDefined();
    expect(entry!.key).toBe(InterventionType.ANNUAL_SERVICE);
    expect(entry!.label).toBe('intervention_type_annual_heat_pump');
  });

  it('should NOT define annual service for BOILER', () => {
    expect(ANNUAL_SERVICE_TYPES[DeviceType.BOILER]).toBeUndefined();
  });

  it('should NOT define annual service for AIR_CONDITION', () => {
    expect(ANNUAL_SERVICE_TYPES[DeviceType.AIR_CONDITION]).toBeUndefined();
  });

  // ─── Parameterizovani testovi za ANNUAL_SERVICE_TYPES ────────────────────
  const annualDefinedTypes: DeviceType[] = [DeviceType.GAS_BOILER, DeviceType.HEAT_PUMP];
  const annualUndefinedTypes: DeviceType[] = [DeviceType.BOILER, DeviceType.AIR_CONDITION];

  annualDefinedTypes.forEach((deviceType) => {
    it(`ANNUAL_SERVICE_TYPES[${deviceType}] should be defined`, () => {
      expect(ANNUAL_SERVICE_TYPES[deviceType]).toBeDefined();
    });

    it(`ANNUAL_SERVICE_TYPES[${deviceType}].key should be InterventionType.ANNUAL_SERVICE`, () => {
      expect(ANNUAL_SERVICE_TYPES[deviceType]!.key).toBe(InterventionType.ANNUAL_SERVICE);
    });

    it(`ANNUAL_SERVICE_TYPES[${deviceType}].label should be a non-empty string`, () => {
      const label = ANNUAL_SERVICE_TYPES[deviceType]!.label;
      expect(typeof label).toBe('string');
      expect(label.length).toBeGreaterThan(0);
    });

    it(`ANNUAL_SERVICE_TYPES[${deviceType}].label should start with "intervention_type_annual_"`, () => {
      const label = ANNUAL_SERVICE_TYPES[deviceType]!.label;
      expect(label.startsWith('intervention_type_annual_')).toBeTrue();
    });
  });

  annualUndefinedTypes.forEach((deviceType) => {
    it(`ANNUAL_SERVICE_TYPES[${deviceType}] should be undefined`, () => {
      expect(ANNUAL_SERVICE_TYPES[deviceType]).toBeUndefined();
    });
  });
});

// ─── 5. Display field lists per intervention type ─────────────────

describe('INTERVENTION_DISPLAY_FIELDS', () => {
  it('should include core intervention fields in correct order', () => {
    expect(INTERVENTION_DISPLAY_FIELDS[0]).toBe('interventionType');
    expect(INTERVENTION_DISPLAY_FIELDS[1]).toBe('interventionFault');
    expect(INTERVENTION_DISPLAY_FIELDS[2]).toBe('interventionDescription');
    expect(INTERVENTION_DISPLAY_FIELDS[3]).toBe('interventionLocation');
  });

  it('should include installer info fields', () => {
    expect(INTERVENTION_DISPLAY_FIELDS).toContain('installerName');
    expect(INTERVENTION_DISPLAY_FIELDS).toContain('installerPhoneNumber');
  });

  it('should include callAccepted field', () => {
    expect(INTERVENTION_DISPLAY_FIELDS).toContain('callAccepted');
  });

  it('should include all 4 spare part fields', () => {
    expect(INTERVENTION_DISPLAY_FIELDS).toContain('sparePart1');
    expect(INTERVENTION_DISPLAY_FIELDS).toContain('sparePart2');
    expect(INTERVENTION_DISPLAY_FIELDS).toContain('sparePart3');
    expect(INTERVENTION_DISPLAY_FIELDS).toContain('sparePart4');
  });

  it('should include addedBy, addedDate, error, note fields', () => {
    expect(INTERVENTION_DISPLAY_FIELDS).toContain('addedBy');
    expect(INTERVENTION_DISPLAY_FIELDS).toContain('addedDate');
    expect(INTERVENTION_DISPLAY_FIELDS).toContain('error');
    expect(INTERVENTION_DISPLAY_FIELDS).toContain('note');
  });

  it('should have exactly 20 fields', () => {
    expect(INTERVENTION_DISPLAY_FIELDS.length).toBe(20);
  });

  // ─── Parameterizovani testovi: svako polje u INTERVENTION_DISPLAY_FIELDS ───
  const expectedInterventionDisplayFields = [
    'interventionType',
    'interventionFault',
    'interventionDescription',
    'interventionLocation',
    'visits',
    'warrantyStatus',
    'installerName',
    'installerPhoneNumber',
    'callAccepted',
    'sparePart1',
    'sparePart2',
    'sparePart3',
    'sparePart4',
    'serviceCenter',
    'addedBy',
    'addedDate',
    'error',
    'note',
    'faultDescription',
    'workDescription',
  ];

  expectedInterventionDisplayFields.forEach((field, idx) => {
    it(`INTERVENTION_DISPLAY_FIELDS should contain "${field}"`, () => {
      expect(INTERVENTION_DISPLAY_FIELDS).toContain(field);
    });

    it(`INTERVENTION_DISPLAY_FIELDS[${idx}] should be "${field}" (order check)`, () => {
      expect(INTERVENTION_DISPLAY_FIELDS[idx]).toBe(field);
    });
  });

  it('INTERVENTION_DISPLAY_FIELDS should be an array', () => {
    expect(Array.isArray(INTERVENTION_DISPLAY_FIELDS)).toBe(true);
  });

  it('INTERVENTION_DISPLAY_FIELDS entries should all be strings', () => {
    INTERVENTION_DISPLAY_FIELDS.forEach((f) => {
      expect(typeof f).toBe('string');
      expect(f.length).toBeGreaterThan(0);
    });
  });

  it('INTERVENTION_DISPLAY_FIELDS should have no duplicate entries', () => {
    const unique = new Set(INTERVENTION_DISPLAY_FIELDS);
    expect(unique.size).toBe(INTERVENTION_DISPLAY_FIELDS.length);
  });
});

describe('REGISTRATION_DISPLAY_FIELDS', () => {
  it('should include registeredAt, warrantyStatus, warrantyDate, comment, registeredBy', () => {
    expect(REGISTRATION_DISPLAY_FIELDS).toContain('registeredAt');
    expect(REGISTRATION_DISPLAY_FIELDS).toContain('warrantyStatus');
    expect(REGISTRATION_DISPLAY_FIELDS).toContain('warrantyDate');
    expect(REGISTRATION_DISPLAY_FIELDS).toContain('comment');
    expect(REGISTRATION_DISPLAY_FIELDS).toContain('registeredBy');
  });

  it('should have exactly 5 fields', () => {
    expect(REGISTRATION_DISPLAY_FIELDS.length).toBe(5);
  });

  // ─── Parameterizovani testovi: svako polje u REGISTRATION_DISPLAY_FIELDS ───
  const expectedRegistrationFields = ['registeredAt', 'warrantyStatus', 'warrantyDate', 'comment', 'registeredBy'];

  expectedRegistrationFields.forEach((field, idx) => {
    it(`REGISTRATION_DISPLAY_FIELDS should contain "${field}"`, () => {
      expect(REGISTRATION_DISPLAY_FIELDS).toContain(field);
    });

    it(`REGISTRATION_DISPLAY_FIELDS[${idx}] should be "${field}" (order check)`, () => {
      expect(REGISTRATION_DISPLAY_FIELDS[idx]).toBe(field);
    });
  });

  it('REGISTRATION_DISPLAY_FIELDS should be an array', () => {
    expect(Array.isArray(REGISTRATION_DISPLAY_FIELDS)).toBe(true);
  });

  it('REGISTRATION_DISPLAY_FIELDS entries should all be strings', () => {
    REGISTRATION_DISPLAY_FIELDS.forEach((f) => {
      expect(typeof f).toBe('string');
    });
  });

  it('REGISTRATION_DISPLAY_FIELDS should have no duplicate entries', () => {
    const unique = new Set(REGISTRATION_DISPLAY_FIELDS);
    expect(unique.size).toBe(REGISTRATION_DISPLAY_FIELDS.length);
  });
});

// ─── 6. Hidden fields ─────────────────────────────────────────────

describe('HIDDEN_FIELDS', () => {
  it('should include sn, deviceCode, deviceName, deviceType, exported', () => {
    expect(HIDDEN_FIELDS).toContain('sn');
    expect(HIDDEN_FIELDS).toContain('deviceCode');
    expect(HIDDEN_FIELDS).toContain('deviceName');
    expect(HIDDEN_FIELDS).toContain('deviceType');
    expect(HIDDEN_FIELDS).toContain('exported');
  });

  it('should have exactly 5 hidden fields', () => {
    expect(HIDDEN_FIELDS.length).toBe(5);
  });

  it('should not contain any intervention display fields', () => {
    for (const field of HIDDEN_FIELDS) {
      expect(INTERVENTION_DISPLAY_FIELDS).not.toContain(field);
    }
  });

  // ─── Parameterizovani testovi: svako polje u HIDDEN_FIELDS ────────────────
  const expectedHiddenFields = ['sn', 'deviceCode', 'deviceName', 'deviceType', 'exported'];

  expectedHiddenFields.forEach((field, idx) => {
    it(`HIDDEN_FIELDS should contain "${field}"`, () => {
      expect(HIDDEN_FIELDS).toContain(field);
    });

    it(`HIDDEN_FIELDS[${idx}] should be "${field}" (order check)`, () => {
      expect(HIDDEN_FIELDS[idx]).toBe(field);
    });
  });

  it('HIDDEN_FIELDS should be an array', () => {
    expect(Array.isArray(HIDDEN_FIELDS)).toBe(true);
  });

  it('HIDDEN_FIELDS entries should all be strings', () => {
    HIDDEN_FIELDS.forEach((f) => {
      expect(typeof f).toBe('string');
      expect(f.length).toBeGreaterThan(0);
    });
  });

  it('HIDDEN_FIELDS should have no duplicate entries', () => {
    const unique = new Set(HIDDEN_FIELDS);
    expect(unique.size).toBe(HIDDEN_FIELDS.length);
  });

  it('HIDDEN_FIELDS should not intersect with REGISTRATION_DISPLAY_FIELDS', () => {
    for (const field of HIDDEN_FIELDS) {
      expect(REGISTRATION_DISPLAY_FIELDS).not.toContain(field);
    }
  });
});

// ─── 7. FAULT_DESCRIPTIONS per device type ────────────────────────

describe('FAULT_DESCRIPTIONS', () => {
  it('should contain entries for all 4 device types', () => {
    expect(FAULT_DESCRIPTIONS[DeviceType.BOILER]).toBeDefined();
    expect(FAULT_DESCRIPTIONS[DeviceType.GAS_BOILER]).toBeDefined();
    expect(FAULT_DESCRIPTIONS[DeviceType.HEAT_PUMP]).toBeDefined();
    expect(FAULT_DESCRIPTIONS[DeviceType.AIR_CONDITION]).toBeDefined();
  });

  it('should have 23 fault descriptions for BOILER', () => {
    expect(FAULT_DESCRIPTIONS[DeviceType.BOILER].length).toBe(23);
  });

  it('should have 25 fault descriptions for GAS_BOILER', () => {
    expect(FAULT_DESCRIPTIONS[DeviceType.GAS_BOILER].length).toBe(25);
  });

  it('should have non-empty arrays for HEAT_PUMP and AIR_CONDITION', () => {
    expect(FAULT_DESCRIPTIONS[DeviceType.HEAT_PUMP].length).toBeGreaterThan(0);
    expect(FAULT_DESCRIPTIONS[DeviceType.AIR_CONDITION].length).toBeGreaterThan(0);
  });

  it('each entry should be a non-empty string', () => {
    for (const deviceType of Object.values(DeviceType)) {
      for (const fault of FAULT_DESCRIPTIONS[deviceType]) {
        expect(typeof fault).toBe('string');
        expect(fault.length).toBeGreaterThan(0);
      }
    }
  });

  // ─── Parameterizovani testovi: svaki BOILER fault ─────────────────────────
  const expectedBoilerFaults = [
    'NE GREJE, SIJA SIJALICA',
    'NE GREJE, NE SIJA SIJALICA',
    'IZBACUJE SKLOPKA',
    'ZVECKA U BOJLERU',
    'VODA IZ BOJLERA ŽUTA',
    'BUKA PRILIKOM ZAGREVANJA',
    'CURENJE GREJAČA',
    'CURENJE SIGURNOSNOG VENTILA',
    'CURI VODA IZ BOJLERA',
    'GREJAČ NEISPRAVAN',
    'DISPLEJ NEISPRAVAN',
    'ELEKTRONSKA PLOČA NEISPRAVNA',
    'MIRIS PRILIKOM RADA',
    'OLABAVLJEN DEO',
    'POKLOPAC BOJLERA',
    'PREGREVA SE VODA',
    'PROBLEM SA PRITISKOM',
    'PROCUREO KAZAN',
    'TERMOSTAT NEISPRAVAN',
    'UREĐAJ NE GREJE',
    'VODA SE BRZO HLADI',
    'ŽICE GREJAČA VEZANE POGREŠNO',
    'ZUJANJE-PIŠTANJE PRILKOM RADA',
  ];

  expectedBoilerFaults.forEach((fault, idx) => {
    it(`FAULT_DESCRIPTIONS[BOILER][${idx}] should be "${fault.substring(0, 40)}"`, () => {
      expect(FAULT_DESCRIPTIONS[DeviceType.BOILER][idx]).toBe(fault);
    });

    it(`FAULT_DESCRIPTIONS[BOILER] should contain "${fault.substring(0, 40)}"`, () => {
      expect(FAULT_DESCRIPTIONS[DeviceType.BOILER]).toContain(fault);
    });
  });

  // ─── Parameterizovani testovi: svaki GAS_BOILER fault ────────────────────
  const expectedGasBoilerFaults = [
    'BUKA PRILIKOM ZAGREVANJA',
    'CURENJE SIGURNOSNOG VENTILA',
    'CURI VODA IZ KOTLA',
    'NEISPRAVAN DISPLEJ',
    'GASNI VENTIL NEISPRAVAN',
    'GREŠKA ELEKTRONSKE PLOČE',
    'IZMENJIVAČ NE RADI ZAPUŠEN',
    'PUMPA NEISPRAVNA',
    'MANOMETAR NE PRIKAZUJE PRITISAK',
    'NEISPRAVNE ELEKTRODE',
    'NEMA MODULACIJE',
    'OLABAVLJEN DEO',
    'PREGREVA SE VODA',
    'VAZDUŠNI PRESOSTAT NEISPRAVAN',
    'VODENI PRESOSTAT NEISPRAVAN',
    'SLAVINA ZA DOPUNU NIJE ISPRAVNA',
    'NTC T NEISPRAVAN',
    'UREĐAJ NE PALI',
    'VENTILATOR NEISPRAVAN',
    'NEISPRAVAN SERVO MOTOR',
    'NEISPARVAN TROKRAKI VENTIL',
    'NEISPRAVAN REED RELEJ',
    'NEISPRAVAN MERAČ PROTOKA',
    'NEISPAVAN ULOŽAK TROKRAKOG',
    'GODIŠNJI SERVIS',
  ];

  expectedGasBoilerFaults.forEach((fault, idx) => {
    it(`FAULT_DESCRIPTIONS[GAS_BOILER][${idx}] should be "${fault.substring(0, 40)}"`, () => {
      expect(FAULT_DESCRIPTIONS[DeviceType.GAS_BOILER][idx]).toBe(fault);
    });

    it(`FAULT_DESCRIPTIONS[GAS_BOILER] should contain "${fault.substring(0, 40)}"`, () => {
      expect(FAULT_DESCRIPTIONS[DeviceType.GAS_BOILER]).toContain(fault);
    });
  });

  // ─── HEAT_PUMP fault checks ───────────────────────────────────────────────
  it('HEAT_PUMP faults should have 24 entries', () => {
    expect(FAULT_DESCRIPTIONS[DeviceType.HEAT_PUMP].length).toBe(24);
  });

  it('AIR_CONDITION faults should have 24 entries', () => {
    expect(FAULT_DESCRIPTIONS[DeviceType.AIR_CONDITION].length).toBe(24);
  });

  FAULT_DESCRIPTIONS[DeviceType.HEAT_PUMP].forEach((fault, idx) => {
    it(`FAULT_DESCRIPTIONS[HEAT_PUMP][${idx}] should be a non-empty string`, () => {
      expect(typeof fault).toBe('string');
      expect(fault.length).toBeGreaterThan(0);
    });
  });

  FAULT_DESCRIPTIONS[DeviceType.AIR_CONDITION].forEach((fault, idx) => {
    it(`FAULT_DESCRIPTIONS[AIR_CONDITION][${idx}] should be a non-empty string`, () => {
      expect(typeof fault).toBe('string');
      expect(fault.length).toBeGreaterThan(0);
    });
  });

  // ─── Cross-device type checks ─────────────────────────────────────────────
  const allDeviceTypes = Object.values(DeviceType);

  allDeviceTypes.forEach((deviceType) => {
    it(`FAULT_DESCRIPTIONS[${deviceType}] should be an array`, () => {
      expect(Array.isArray(FAULT_DESCRIPTIONS[deviceType])).toBe(true);
    });

    it(`FAULT_DESCRIPTIONS[${deviceType}] should have at least 1 entry`, () => {
      expect(FAULT_DESCRIPTIONS[deviceType].length).toBeGreaterThan(0);
    });

    it(`FAULT_DESCRIPTIONS[${deviceType}] entries should not contain empty strings`, () => {
      for (const fault of FAULT_DESCRIPTIONS[deviceType]) {
        expect(fault.trim().length).toBeGreaterThan(0);
      }
    });

    it(`FAULT_DESCRIPTIONS[${deviceType}] should have unique entries`, () => {
      const faults = FAULT_DESCRIPTIONS[deviceType];
      const unique = new Set(faults);
      expect(unique.size).toBe(faults.length);
    });
  });
});

// ─── 8. ERROR_CODES per device type ───────────────────────────────

describe('ERROR_CODES', () => {
  it('should contain entries for all 4 device types', () => {
    expect(ERROR_CODES[DeviceType.BOILER]).toBeDefined();
    expect(ERROR_CODES[DeviceType.GAS_BOILER]).toBeDefined();
    expect(ERROR_CODES[DeviceType.HEAT_PUMP]).toBeDefined();
    expect(ERROR_CODES[DeviceType.AIR_CONDITION]).toBeDefined();
  });

  it('BOILER, GAS_BOILER and AIR_CONDITION should share the same error codes array', () => {
    expect(ERROR_CODES[DeviceType.BOILER]).toBe(ERROR_CODES[DeviceType.GAS_BOILER]);
    expect(ERROR_CODES[DeviceType.BOILER]).toBe(ERROR_CODES[DeviceType.AIR_CONDITION]);
  });

  it('HEAT_PUMP should have a different error codes array from BOILER', () => {
    expect(ERROR_CODES[DeviceType.HEAT_PUMP]).not.toBe(ERROR_CODES[DeviceType.BOILER]);
  });

  it('each error code array should start with DEFAULT_ERROR', () => {
    for (const deviceType of Object.values(DeviceType)) {
      expect(ERROR_CODES[deviceType][0]).toBe(DEFAULT_ERROR);
    }
  });

  it('DEFAULT_ERROR should equal "error_no_error"', () => {
    expect(DEFAULT_ERROR).toBe('error_no_error');
  });

  it('HEAT_PUMP should have more than 40 error codes', () => {
    expect(ERROR_CODES[DeviceType.HEAT_PUMP].length).toBeGreaterThan(40);
  });

  it('non-existent device type should return undefined', () => {
    const nonExistentType = 'unknown-type' as DeviceType;
    expect(ERROR_CODES[nonExistentType]).toBeUndefined();
  });

  // ─── Parameterizovani testovi: svaki BOILER/GAS/AC error code ─────────────
  const boilerErrorCodes = ERROR_CODES[DeviceType.BOILER];

  boilerErrorCodes.forEach((code, idx) => {
    it(`ERROR_CODES[BOILER][${idx}] "${code.substring(0, 40)}" should be a non-empty string`, () => {
      expect(typeof code).toBe('string');
      expect(code.length).toBeGreaterThan(0);
    });
  });

  // ─── Parameterizovani testovi: svaki HEAT_PUMP error code ────────────────
  const heatPumpErrorCodes = ERROR_CODES[DeviceType.HEAT_PUMP];

  heatPumpErrorCodes.forEach((code, idx) => {
    it(`ERROR_CODES[HEAT_PUMP][${idx}] "${code.substring(0, 40)}" should be a non-empty string`, () => {
      expect(typeof code).toBe('string');
      expect(code.length).toBeGreaterThan(0);
    });
  });

  // ─── Cross-device type checks ─────────────────────────────────────────────
  const allDeviceTypes = Object.values(DeviceType);

  allDeviceTypes.forEach((deviceType) => {
    it(`ERROR_CODES[${deviceType}] should be an array`, () => {
      expect(Array.isArray(ERROR_CODES[deviceType])).toBe(true);
    });

    it(`ERROR_CODES[${deviceType}] should have at least 1 entry`, () => {
      expect(ERROR_CODES[deviceType].length).toBeGreaterThan(0);
    });

    it(`ERROR_CODES[${deviceType}][0] should be DEFAULT_ERROR`, () => {
      expect(ERROR_CODES[deviceType][0]).toBe(DEFAULT_ERROR);
    });

    it(`ERROR_CODES[${deviceType}] entries should all be strings`, () => {
      for (const code of ERROR_CODES[deviceType]) {
        expect(typeof code).toBe('string');
      }
    });

    it(`ERROR_CODES[${deviceType}] entries should all be non-empty`, () => {
      for (const code of ERROR_CODES[deviceType]) {
        expect(code.length).toBeGreaterThan(0);
      }
    });

    it(`ERROR_CODES[${deviceType}] should have unique entries`, () => {
      const codes = ERROR_CODES[deviceType];
      const unique = new Set(codes);
      expect(unique.size).toBe(codes.length);
    });
  });

  // ─── Specific error codes existence checks ────────────────────────────────
  it('BOILER errors should contain "101 - Pregrevanje"', () => {
    expect(ERROR_CODES[DeviceType.BOILER]).toContain('101 - Pregrevanje');
  });

  it('BOILER errors should contain "501 - Izostanak plamena (Nakon 5 puta sa P6)"', () => {
    expect(ERROR_CODES[DeviceType.BOILER]).toContain('501 - Izostanak plamena (Nakon 5 puta sa P6)');
  });

  it('HEAT_PUMP errors should contain "905 - Greška kompresora"', () => {
    expect(ERROR_CODES[DeviceType.HEAT_PUMP]).toContain('905 - Greška kompresora');
  });

  it('HEAT_PUMP errors should contain "918 - Greška pumpe"', () => {
    expect(ERROR_CODES[DeviceType.HEAT_PUMP]).toContain('918 - Greška pumpe');
  });

  it('DEFAULT_ERROR should be in every device type error array', () => {
    for (const deviceType of Object.values(DeviceType)) {
      expect(ERROR_CODES[deviceType]).toContain(DEFAULT_ERROR);
    }
  });
});
