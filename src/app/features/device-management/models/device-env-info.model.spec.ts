import { DeviceType } from '../../../shared/models/device.model';
import {
  requiresEnvInfo,
  ENV_INFO_FIELDS,
  ENV_INFO_SECTIONS,
  EnvInfoFieldConfig,
  OUTDOOR_FUSE_OPTIONS,
  INDOOR_FUSE_OPTIONS,
  OUTDOOR_WIRE_OPTIONS,
  INDOOR_WIRE_OPTIONS,
  MODBUS_CABLE_OPTIONS,
  FID_OPTIONS,
  YES_NO_OPTIONS,
  ZONE_OPTIONS,
  GAS_TYPE_OPTIONS,
} from './device-env-info.model';

// ─── 1. requiresEnvInfo helper ────────────────────────────────────

describe('requiresEnvInfo()', () => {
  it('should return true for HEAT_PUMP', () => {
    expect(requiresEnvInfo(DeviceType.HEAT_PUMP)).toBeTrue();
  });

  it('should return true for GAS_BOILER', () => {
    expect(requiresEnvInfo(DeviceType.GAS_BOILER)).toBeTrue();
  });

  it('should return false for BOILER', () => {
    expect(requiresEnvInfo(DeviceType.BOILER)).toBeFalse();
  });

  it('should return false for AIR_CONDITION', () => {
    expect(requiresEnvInfo(DeviceType.AIR_CONDITION)).toBeFalse();
  });

  // ─── Parameterizovani testovi za requiresEnvInfo ──────────────────────────
  const envInfoRequiredTypes: DeviceType[] = [DeviceType.HEAT_PUMP, DeviceType.GAS_BOILER];
  const envInfoNotRequiredTypes: DeviceType[] = [DeviceType.BOILER, DeviceType.AIR_CONDITION];

  envInfoRequiredTypes.forEach((deviceType) => {
    it(`requiresEnvInfo(${deviceType}) should return true`, () => {
      expect(requiresEnvInfo(deviceType)).toBeTrue();
    });

    it(`requiresEnvInfo(${deviceType}) result should be boolean`, () => {
      expect(typeof requiresEnvInfo(deviceType)).toBe('boolean');
    });
  });

  envInfoNotRequiredTypes.forEach((deviceType) => {
    it(`requiresEnvInfo(${deviceType}) should return false`, () => {
      expect(requiresEnvInfo(deviceType)).toBeFalse();
    });

    it(`requiresEnvInfo(${deviceType}) result should be boolean`, () => {
      expect(typeof requiresEnvInfo(deviceType)).toBe('boolean');
    });
  });

  it('requiresEnvInfo should return boolean for all device types', () => {
    for (const deviceType of Object.values(DeviceType)) {
      expect(typeof requiresEnvInfo(deviceType)).toBe('boolean');
    }
  });

  it('requiresEnvInfo returns true for exactly 2 device types', () => {
    const trueCount = Object.values(DeviceType).filter((dt) => requiresEnvInfo(dt)).length;
    expect(trueCount).toBe(2);
  });

  it('requiresEnvInfo returns false for exactly 2 device types', () => {
    const falseCount = Object.values(DeviceType).filter((dt) => !requiresEnvInfo(dt)).length;
    expect(falseCount).toBe(2);
  });
});

// ─── 2. ENV_INFO_FIELDS field counts ─────────────────────────────

describe('ENV_INFO_FIELDS', () => {
  it('should have 29 fields for HEAT_PUMP', () => {
    const fields = ENV_INFO_FIELDS[DeviceType.HEAT_PUMP];
    expect(fields).toBeDefined();
    expect(fields!.length).toBe(29);
  });

  it('should have 13 fields for GAS_BOILER', () => {
    const fields = ENV_INFO_FIELDS[DeviceType.GAS_BOILER];
    expect(fields).toBeDefined();
    expect(fields!.length).toBe(13);
  });

  it('should not have fields defined for BOILER', () => {
    expect(ENV_INFO_FIELDS[DeviceType.BOILER]).toBeUndefined();
  });

  it('should not have fields defined for AIR_CONDITION', () => {
    expect(ENV_INFO_FIELDS[DeviceType.AIR_CONDITION]).toBeUndefined();
  });

  // ─── 3. HEAT_PUMP covers all 4 sections ─────────────────────────

  it('HEAT_PUMP fields should cover all 4 sections: electrical, hydraulic, freon, systemOp', () => {
    const fields = ENV_INFO_FIELDS[DeviceType.HEAT_PUMP]!;
    const sections = new Set(fields.map(f => f.section));
    expect(sections.has('electrical')).toBeTrue();
    expect(sections.has('hydraulic')).toBeTrue();
    expect(sections.has('freon')).toBeTrue();
    expect(sections.has('systemOp')).toBeTrue();
  });

  it('HEAT_PUMP electrical section should have 8 fields', () => {
    const fields = ENV_INFO_FIELDS[DeviceType.HEAT_PUMP]!;
    const electrical = fields.filter(f => f.section === 'electrical');
    expect(electrical.length).toBe(8);
  });

  it('HEAT_PUMP hydraulic section should have 8 fields', () => {
    const fields = ENV_INFO_FIELDS[DeviceType.HEAT_PUMP]!;
    const hydraulic = fields.filter(f => f.section === 'hydraulic');
    expect(hydraulic.length).toBe(8);
  });

  it('HEAT_PUMP freon section should have 4 fields', () => {
    const fields = ENV_INFO_FIELDS[DeviceType.HEAT_PUMP]!;
    const freon = fields.filter(f => f.section === 'freon');
    expect(freon.length).toBe(4);
  });

  it('HEAT_PUMP systemOp section should have 9 fields', () => {
    const fields = ENV_INFO_FIELDS[DeviceType.HEAT_PUMP]!;
    const systemOp = fields.filter(f => f.section === 'systemOp');
    expect(systemOp.length).toBe(9);
  });

  // ─── 4. GAS_BOILER has single section ───────────────────────────

  it('GAS_BOILER fields should all belong to the "gasBoiler" section', () => {
    const fields = ENV_INFO_FIELDS[DeviceType.GAS_BOILER]!;
    const sections = new Set(fields.map(f => f.section));
    expect(sections.size).toBe(1);
    expect(sections.has('gasBoiler')).toBeTrue();
  });

  // ─── 5. Select fields have options array ─────────────────────────

  it('each select field for HEAT_PUMP should have a non-empty options array', () => {
    const fields = ENV_INFO_FIELDS[DeviceType.HEAT_PUMP]!;
    const selectFields = fields.filter(f => f.type === 'select');
    expect(selectFields.length).toBeGreaterThan(0);
    for (const field of selectFields) {
      expect(field.options).withContext(`field ${field.key}`).toBeDefined();
      expect(field.options!.length).withContext(`field ${field.key}`).toBeGreaterThan(0);
    }
  });

  it('each select field for GAS_BOILER should have a non-empty options array', () => {
    const fields = ENV_INFO_FIELDS[DeviceType.GAS_BOILER]!;
    const selectFields = fields.filter(f => f.type === 'select');
    expect(selectFields.length).toBeGreaterThan(0);
    for (const field of selectFields) {
      expect(field.options).withContext(`field ${field.key}`).toBeDefined();
      expect(field.options!.length).withContext(`field ${field.key}`).toBeGreaterThan(0);
    }
  });

  // ─── 6. Number fields have unit ─────────────────────────────────

  it('each number field for HEAT_PUMP should have a unit defined', () => {
    const fields = ENV_INFO_FIELDS[DeviceType.HEAT_PUMP]!;
    const numberFields = fields.filter(f => f.type === 'number');
    expect(numberFields.length).toBeGreaterThan(0);
    for (const field of numberFields) {
      expect(field.unit).withContext(`field ${field.key}`).toBeDefined();
      expect(field.unit!.length).withContext(`field ${field.key}`).toBeGreaterThan(0);
    }
  });

  it('each number field for GAS_BOILER should have a unit defined', () => {
    const fields = ENV_INFO_FIELDS[DeviceType.GAS_BOILER]!;
    const numberFields = fields.filter(f => f.type === 'number');
    expect(numberFields.length).toBeGreaterThan(0);
    for (const field of numberFields) {
      expect(field.unit).withContext(`field ${field.key}`).toBeDefined();
      expect(field.unit!.length).withContext(`field ${field.key}`).toBeGreaterThan(0);
    }
  });

  // ─── Bonus: field key uniqueness within each device type ─────────
  it('HEAT_PUMP field keys should be unique', () => {
    const fields = ENV_INFO_FIELDS[DeviceType.HEAT_PUMP]!;
    const keys = fields.map(f => f.key);
    const uniqueKeys = new Set(keys);
    expect(uniqueKeys.size).toBe(keys.length);
  });

  it('GAS_BOILER field keys should be unique', () => {
    const fields = ENV_INFO_FIELDS[DeviceType.GAS_BOILER]!;
    const keys = fields.map(f => f.key);
    const uniqueKeys = new Set(keys);
    expect(uniqueKeys.size).toBe(keys.length);
  });

  // ─── Bonus: i18n key convention ──────────────────────────────────

  it('HEAT_PUMP field labels should follow env_info_* i18n key convention', () => {
    const fields = ENV_INFO_FIELDS[DeviceType.HEAT_PUMP]!;
    for (const field of fields) {
      expect(field.label.startsWith('env_info_')).withContext(`field ${field.key} has label "${field.label}"`).toBeTrue();
    }
  });

  it('GAS_BOILER field labels should follow env_info_* i18n key convention', () => {
    const fields = ENV_INFO_FIELDS[DeviceType.GAS_BOILER]!;
    for (const field of fields) {
      expect(field.label.startsWith('env_info_')).withContext(`field ${field.key} has label "${field.label}"`).toBeTrue();
    }
  });

  it('HEAT_PUMP select options should follow env_info_opt_* i18n key convention', () => {
    const fields = ENV_INFO_FIELDS[DeviceType.HEAT_PUMP]!;
    const selectFields = fields.filter(f => f.type === 'select');
    for (const field of selectFields) {
      for (const option of field.options!) {
        expect(option.startsWith('env_info_opt_')).withContext(`field ${field.key} has option "${option}"`).toBeTrue();
      }
    }
  });

  // ─── Parameterizovani testovi: svako HEAT_PUMP polje detaljno ──────────────
  const expectedHeatPumpFields: Array<{ key: string; label: string; type: 'select' | 'number'; section: string }> = [
    { key: 'outdoorFuse', label: 'env_info_outdoor_fuse', type: 'select', section: 'electrical' },
    { key: 'indoorFuse', label: 'env_info_indoor_fuse', type: 'select', section: 'electrical' },
    { key: 'outdoorWire', label: 'env_info_outdoor_wire', type: 'select', section: 'electrical' },
    { key: 'indoorWire', label: 'env_info_indoor_wire', type: 'select', section: 'electrical' },
    { key: 'modbusCable', label: 'env_info_modbus_cable', type: 'select', section: 'electrical' },
    { key: 'modbusSeparated', label: 'env_info_modbus_separated', type: 'select', section: 'electrical' },
    { key: 'outdoorFID', label: 'env_info_outdoor_fid', type: 'select', section: 'electrical' },
    { key: 'indoorFID', label: 'env_info_indoor_fid', type: 'select', section: 'electrical' },
    { key: 'cooling', label: 'env_info_cooling', type: 'select', section: 'hydraulic' },
    { key: 'sanitaryBoiler', label: 'env_info_sanitary_boiler', type: 'select', section: 'hydraulic' },
    { key: 'buffer', label: 'env_info_buffer', type: 'select', section: 'hydraulic' },
    { key: 'zoneNumber', label: 'env_info_zone_number', type: 'select', section: 'hydraulic' },
    { key: 'hydraulicSwitch', label: 'env_info_hydraulic_switch', type: 'select', section: 'hydraulic' },
    { key: 'magneticFilter', label: 'env_info_magnetic_filter', type: 'select', section: 'hydraulic' },
    { key: 'additionalExpansionTank', label: 'env_info_additional_expansion_tank', type: 'select', section: 'hydraulic' },
    { key: 'additionalExpansionTankPTV', label: 'env_info_additional_expansion_tank_ptv', type: 'select', section: 'hydraulic' },
    { key: 'freonSysTested', label: 'env_info_freon_sys_tested', type: 'select', section: 'freon' },
    { key: 'sysVacuumed', label: 'env_info_sys_vacuumed', type: 'select', section: 'freon' },
    { key: 'pipeLength', label: 'env_info_pipe_length', type: 'number', section: 'freon' },
    { key: 'additionalFreon', label: 'env_info_additional_freon', type: 'number', section: 'freon' },
    { key: 'sysWaterPressure', label: 'env_info_sys_water_pressure', type: 'number', section: 'systemOp' },
    { key: 'outdoorTemp', label: 'env_info_outdoor_temp', type: 'number', section: 'systemOp' },
    { key: 'waterTempOnStart', label: 'env_info_water_temp_on_start', type: 'number', section: 'systemOp' },
    { key: 'returnWaterTemp', label: 'env_info_return_water_temp', type: 'number', section: 'systemOp' },
    { key: 'evaporatorTemp', label: 'env_info_evaporator_temp', type: 'number', section: 'systemOp' },
    { key: 'compressorTemp', label: 'env_info_compressor_temp', type: 'number', section: 'systemOp' },
    { key: 'evaporatorPressure', label: 'env_info_evaporator_pressure', type: 'number', section: 'systemOp' },
    { key: 'condensationPressure', label: 'env_info_condensation_pressure', type: 'number', section: 'systemOp' },
    { key: 'waterFlow', label: 'env_info_water_flow', type: 'number', section: 'systemOp' },
  ];

  expectedHeatPumpFields.forEach(({ key, label, type, section }) => {
    it(`HEAT_PUMP should have field key="${key}"`, () => {
      const fields = ENV_INFO_FIELDS[DeviceType.HEAT_PUMP]!;
      const field = fields.find(f => f.key === key);
      expect(field).withContext(`field "${key}" should exist`).toBeDefined();
    });

    it(`HEAT_PUMP field "${key}" should have label="${label}"`, () => {
      const fields = ENV_INFO_FIELDS[DeviceType.HEAT_PUMP]!;
      const field = fields.find(f => f.key === key);
      expect(field!.label).toBe(label);
    });

    it(`HEAT_PUMP field "${key}" should have type="${type}"`, () => {
      const fields = ENV_INFO_FIELDS[DeviceType.HEAT_PUMP]!;
      const field = fields.find(f => f.key === key);
      expect(field!.type).toBe(type);
    });

    it(`HEAT_PUMP field "${key}" should belong to section="${section}"`, () => {
      const fields = ENV_INFO_FIELDS[DeviceType.HEAT_PUMP]!;
      const field = fields.find(f => f.key === key);
      expect(field!.section).toBe(section);
    });

    it(`HEAT_PUMP field "${key}" label should start with "env_info_"`, () => {
      const fields = ENV_INFO_FIELDS[DeviceType.HEAT_PUMP]!;
      const field = fields.find(f => f.key === key);
      expect(field!.label.startsWith('env_info_')).toBeTrue();
    });
  });

  // ─── Parameterizovani testovi: svako GAS_BOILER polje detaljno ────────────
  const expectedGasBoilerFields: Array<{ key: string; label: string; type: 'select' | 'number'; section: string }> = [
    { key: 'gasType', label: 'env_info_gas_type', type: 'select', section: 'gasBoiler' },
    { key: 'voltage', label: 'env_info_voltage', type: 'number', section: 'gasBoiler' },
    { key: 'inputGasPressure', label: 'env_info_input_gas_pressure', type: 'number', section: 'gasBoiler' },
    { key: 'minGasPressure', label: 'env_info_min_gas_pressure', type: 'number', section: 'gasBoiler' },
    { key: 'maxGasPressure', label: 'env_info_max_gas_pressure', type: 'number', section: 'gasBoiler' },
    { key: 'minGasBoilerPower', label: 'env_info_min_gas_boiler_power', type: 'number', section: 'gasBoiler' },
    { key: 'maxGasBoilerPower', label: 'env_info_max_gas_boiler_power', type: 'number', section: 'gasBoiler' },
    { key: 'expansionPressure', label: 'env_info_expansion_pressure', type: 'number', section: 'gasBoiler' },
    { key: 'sysPressure', label: 'env_info_sys_pressure', type: 'number', section: 'gasBoiler' },
    { key: 'testedOnGasLeakage', label: 'env_info_tested_on_gas_leakage', type: 'select', section: 'gasBoiler' },
    { key: 'gasHoseReplaced', label: 'env_info_gas_hose_replaced', type: 'select', section: 'gasBoiler' },
    { key: 'accordingManufacturerInstalled', label: 'env_info_according_manufacturer', type: 'select', section: 'gasBoiler' },
    { key: 'readyForUse', label: 'env_info_ready_for_use', type: 'select', section: 'gasBoiler' },
  ];

  expectedGasBoilerFields.forEach(({ key, label, type, section }) => {
    it(`GAS_BOILER should have field key="${key}"`, () => {
      const fields = ENV_INFO_FIELDS[DeviceType.GAS_BOILER]!;
      const field = fields.find(f => f.key === key);
      expect(field).withContext(`field "${key}" should exist`).toBeDefined();
    });

    it(`GAS_BOILER field "${key}" should have label="${label}"`, () => {
      const fields = ENV_INFO_FIELDS[DeviceType.GAS_BOILER]!;
      const field = fields.find(f => f.key === key);
      expect(field!.label).toBe(label);
    });

    it(`GAS_BOILER field "${key}" should have type="${type}"`, () => {
      const fields = ENV_INFO_FIELDS[DeviceType.GAS_BOILER]!;
      const field = fields.find(f => f.key === key);
      expect(field!.type).toBe(type);
    });

    it(`GAS_BOILER field "${key}" should belong to section="${section}"`, () => {
      const fields = ENV_INFO_FIELDS[DeviceType.GAS_BOILER]!;
      const field = fields.find(f => f.key === key);
      expect(field!.section).toBe(section);
    });

    it(`GAS_BOILER field "${key}" label should start with "env_info_"`, () => {
      const fields = ENV_INFO_FIELDS[DeviceType.GAS_BOILER]!;
      const field = fields.find(f => f.key === key);
      expect(field!.label.startsWith('env_info_')).toBeTrue();
    });
  });

  // ─── Type-level checks ────────────────────────────────────────────────────
  it('HEAT_PUMP field type values should only be "select" or "number"', () => {
    const fields = ENV_INFO_FIELDS[DeviceType.HEAT_PUMP]!;
    for (const field of fields) {
      expect(['select', 'number']).toContain(field.type);
    }
  });

  it('GAS_BOILER field type values should only be "select" or "number"', () => {
    const fields = ENV_INFO_FIELDS[DeviceType.GAS_BOILER]!;
    for (const field of fields) {
      expect(['select', 'number']).toContain(field.type);
    }
  });

  // ─── Number fields count checks ───────────────────────────────────────────
  it('HEAT_PUMP should have 11 number fields', () => {
    const fields = ENV_INFO_FIELDS[DeviceType.HEAT_PUMP]!;
    const numberFields = fields.filter(f => f.type === 'number');
    expect(numberFields.length).toBe(11);
  });

  it('HEAT_PUMP should have 18 select fields', () => {
    const fields = ENV_INFO_FIELDS[DeviceType.HEAT_PUMP]!;
    const selectFields = fields.filter(f => f.type === 'select');
    expect(selectFields.length).toBe(18);
  });

  it('GAS_BOILER should have 8 number fields', () => {
    const fields = ENV_INFO_FIELDS[DeviceType.GAS_BOILER]!;
    const numberFields = fields.filter(f => f.type === 'number');
    expect(numberFields.length).toBe(8);
  });

  it('GAS_BOILER should have 5 select fields', () => {
    const fields = ENV_INFO_FIELDS[DeviceType.GAS_BOILER]!;
    const selectFields = fields.filter(f => f.type === 'select');
    expect(selectFields.length).toBe(5);
  });

  // ─── Unit checks for HEAT_PUMP number fields ──────────────────────────────
  const expectedHpNumberUnits: Array<[string, string]> = [
    ['pipeLength', 'm'],
    ['additionalFreon', 'Kg'],
    ['sysWaterPressure', 'bar'],
    ['outdoorTemp', '°C'],
    ['waterTempOnStart', '°C'],
    ['returnWaterTemp', '°C'],
    ['evaporatorTemp', '°C'],
    ['compressorTemp', '°C'],
    ['evaporatorPressure', 'bar'],
    ['condensationPressure', 'bar'],
    ['waterFlow', 'l/min'],
  ];

  expectedHpNumberUnits.forEach(([key, unit]) => {
    it(`HEAT_PUMP number field "${key}" should have unit="${unit}"`, () => {
      const fields = ENV_INFO_FIELDS[DeviceType.HEAT_PUMP]!;
      const field = fields.find(f => f.key === key);
      expect(field).toBeDefined();
      expect(field!.unit).toBe(unit);
    });
  });

  // ─── Unit checks for GAS_BOILER number fields ─────────────────────────────
  const expectedGbNumberUnits: Array<[string, string]> = [
    ['voltage', 'V'],
    ['inputGasPressure', 'mbar'],
    ['minGasPressure', 'mbar'],
    ['maxGasPressure', 'mbar'],
    ['minGasBoilerPower', '% CO2'],
    ['maxGasBoilerPower', '% CO2'],
    ['expansionPressure', 'bar'],
    ['sysPressure', 'bar'],
  ];

  expectedGbNumberUnits.forEach(([key, unit]) => {
    it(`GAS_BOILER number field "${key}" should have unit="${unit}"`, () => {
      const fields = ENV_INFO_FIELDS[DeviceType.GAS_BOILER]!;
      const field = fields.find(f => f.key === key);
      expect(field).toBeDefined();
      expect(field!.unit).toBe(unit);
    });
  });

  // ─── GAS_BOILER select fields should not have unit ────────────────────────
  it('GAS_BOILER select fields should not have unit', () => {
    const fields = ENV_INFO_FIELDS[DeviceType.GAS_BOILER]!;
    const selectFields = fields.filter(f => f.type === 'select');
    for (const field of selectFields) {
      expect(field.unit).withContext(`select field "${field.key}" should not have unit`).toBeUndefined();
    }
  });
});

// ─── Select Options exhaustive coverage ──────────────────────────

describe('OUTDOOR_FUSE_OPTIONS', () => {
  const expectedOptions = [
    'env_info_opt_c10a',
    'env_info_opt_c13a',
    'env_info_opt_c16a',
    'env_info_opt_c20a',
    'env_info_opt_c25a',
    'env_info_opt_c32a',
    'env_info_opt_no_fuse',
  ];

  it('should have exactly 7 options', () => {
    expect(OUTDOOR_FUSE_OPTIONS.length).toBe(7);
  });

  expectedOptions.forEach((option, idx) => {
    it(`OUTDOOR_FUSE_OPTIONS[${idx}] should be "${option}"`, () => {
      expect(OUTDOOR_FUSE_OPTIONS[idx]).toBe(option);
    });

    it(`OUTDOOR_FUSE_OPTIONS should contain "${option}"`, () => {
      expect(OUTDOOR_FUSE_OPTIONS).toContain(option);
    });

    it(`OUTDOOR_FUSE_OPTIONS option "${option}" should start with "env_info_opt_"`, () => {
      expect(option.startsWith('env_info_opt_')).toBeTrue();
    });

    it(`OUTDOOR_FUSE_OPTIONS option "${option}" should be non-empty`, () => {
      expect(option.length).toBeGreaterThan(0);
    });

    it(`OUTDOOR_FUSE_OPTIONS option "${option}" should be a string`, () => {
      expect(typeof option).toBe('string');
    });
  });

  it('OUTDOOR_FUSE_OPTIONS should have unique options', () => {
    const unique = new Set(OUTDOOR_FUSE_OPTIONS);
    expect(unique.size).toBe(OUTDOOR_FUSE_OPTIONS.length);
  });
});

describe('INDOOR_FUSE_OPTIONS', () => {
  const expectedOptions = [
    'env_info_opt_c2_4a',
    'env_info_opt_c10a',
    'env_info_opt_c13a',
    'env_info_opt_c16a',
    'env_info_opt_c20a',
    'env_info_opt_c25a',
    'env_info_opt_c32a',
    'env_info_opt_no_fuse',
  ];

  it('should have exactly 8 options', () => {
    expect(INDOOR_FUSE_OPTIONS.length).toBe(8);
  });

  expectedOptions.forEach((option, idx) => {
    it(`INDOOR_FUSE_OPTIONS[${idx}] should be "${option}"`, () => {
      expect(INDOOR_FUSE_OPTIONS[idx]).toBe(option);
    });

    it(`INDOOR_FUSE_OPTIONS should contain "${option}"`, () => {
      expect(INDOOR_FUSE_OPTIONS).toContain(option);
    });

    it(`INDOOR_FUSE_OPTIONS option "${option}" should start with "env_info_opt_"`, () => {
      expect(option.startsWith('env_info_opt_')).toBeTrue();
    });

    it(`INDOOR_FUSE_OPTIONS option "${option}" should be non-empty`, () => {
      expect(option.length).toBeGreaterThan(0);
    });
  });

  it('INDOOR_FUSE_OPTIONS has one more option than OUTDOOR_FUSE_OPTIONS (c2_4a)', () => {
    expect(INDOOR_FUSE_OPTIONS.length).toBe(OUTDOOR_FUSE_OPTIONS.length + 1);
  });

  it('INDOOR_FUSE_OPTIONS should contain env_info_opt_c2_4a which OUTDOOR_FUSE_OPTIONS does not', () => {
    expect(INDOOR_FUSE_OPTIONS).toContain('env_info_opt_c2_4a');
    expect(OUTDOOR_FUSE_OPTIONS).not.toContain('env_info_opt_c2_4a');
  });

  it('INDOOR_FUSE_OPTIONS should have unique options', () => {
    const unique = new Set(INDOOR_FUSE_OPTIONS);
    expect(unique.size).toBe(INDOOR_FUSE_OPTIONS.length);
  });
});

describe('OUTDOOR_WIRE_OPTIONS', () => {
  const expectedOptions = [
    'env_info_opt_3x2_5',
    'env_info_opt_3x4',
    'env_info_opt_3x6',
    'env_info_opt_5x2_5',
    'env_info_opt_5x4',
    'env_info_opt_5x6',
    'env_info_opt_none_listed',
  ];

  it('should have exactly 7 options', () => {
    expect(OUTDOOR_WIRE_OPTIONS.length).toBe(7);
  });

  expectedOptions.forEach((option, idx) => {
    it(`OUTDOOR_WIRE_OPTIONS[${idx}] should be "${option}"`, () => {
      expect(OUTDOOR_WIRE_OPTIONS[idx]).toBe(option);
    });

    it(`OUTDOOR_WIRE_OPTIONS should contain "${option}"`, () => {
      expect(OUTDOOR_WIRE_OPTIONS).toContain(option);
    });

    it(`OUTDOOR_WIRE_OPTIONS option "${option}" should start with "env_info_opt_"`, () => {
      expect(option.startsWith('env_info_opt_')).toBeTrue();
    });
  });

  it('OUTDOOR_WIRE_OPTIONS should have unique options', () => {
    const unique = new Set(OUTDOOR_WIRE_OPTIONS);
    expect(unique.size).toBe(OUTDOOR_WIRE_OPTIONS.length);
  });
});

describe('INDOOR_WIRE_OPTIONS', () => {
  const expectedOptions = [
    'env_info_opt_3x0_75',
    'env_info_opt_3x1_5',
    'env_info_opt_3x2_5',
    'env_info_opt_3x4',
    'env_info_opt_3x6',
    'env_info_opt_5x2_5',
    'env_info_opt_5x4',
    'env_info_opt_5x6',
    'env_info_opt_none_listed',
  ];

  it('should have exactly 9 options', () => {
    expect(INDOOR_WIRE_OPTIONS.length).toBe(9);
  });

  expectedOptions.forEach((option, idx) => {
    it(`INDOOR_WIRE_OPTIONS[${idx}] should be "${option}"`, () => {
      expect(INDOOR_WIRE_OPTIONS[idx]).toBe(option);
    });

    it(`INDOOR_WIRE_OPTIONS should contain "${option}"`, () => {
      expect(INDOOR_WIRE_OPTIONS).toContain(option);
    });

    it(`INDOOR_WIRE_OPTIONS option "${option}" should start with "env_info_opt_"`, () => {
      expect(option.startsWith('env_info_opt_')).toBeTrue();
    });
  });

  it('INDOOR_WIRE_OPTIONS has 2 more options than OUTDOOR_WIRE_OPTIONS', () => {
    expect(INDOOR_WIRE_OPTIONS.length).toBe(OUTDOOR_WIRE_OPTIONS.length + 2);
  });

  it('INDOOR_WIRE_OPTIONS should have unique options', () => {
    const unique = new Set(INDOOR_WIRE_OPTIONS);
    expect(unique.size).toBe(INDOOR_WIRE_OPTIONS.length);
  });
});

describe('MODBUS_CABLE_OPTIONS', () => {
  const expectedOptions = [
    'env_info_opt_shielded_2x075',
    'env_info_opt_shielded_2x15',
    'env_info_opt_shielded_3x075',
    'env_info_opt_shielded_3x15',
    'env_info_opt_unshielded_2x075',
    'env_info_opt_unshielded_2x15',
    'env_info_opt_unshielded_3x075',
    'env_info_opt_unshielded_3x15',
  ];

  it('should have exactly 8 options', () => {
    expect(MODBUS_CABLE_OPTIONS.length).toBe(8);
  });

  expectedOptions.forEach((option, idx) => {
    it(`MODBUS_CABLE_OPTIONS[${idx}] should be "${option}"`, () => {
      expect(MODBUS_CABLE_OPTIONS[idx]).toBe(option);
    });

    it(`MODBUS_CABLE_OPTIONS should contain "${option}"`, () => {
      expect(MODBUS_CABLE_OPTIONS).toContain(option);
    });

    it(`MODBUS_CABLE_OPTIONS option "${option}" should start with "env_info_opt_"`, () => {
      expect(option.startsWith('env_info_opt_')).toBeTrue();
    });
  });

  it('MODBUS_CABLE_OPTIONS should have 4 shielded options', () => {
    const shielded = MODBUS_CABLE_OPTIONS.filter(o => o.includes('shielded_') && !o.includes('unshielded_'));
    expect(shielded.length).toBe(4);
  });

  it('MODBUS_CABLE_OPTIONS should have 4 unshielded options', () => {
    const unshielded = MODBUS_CABLE_OPTIONS.filter(o => o.includes('unshielded_'));
    expect(unshielded.length).toBe(4);
  });

  it('MODBUS_CABLE_OPTIONS should have unique options', () => {
    const unique = new Set(MODBUS_CABLE_OPTIONS);
    expect(unique.size).toBe(MODBUS_CABLE_OPTIONS.length);
  });
});

describe('FID_OPTIONS', () => {
  const expectedOptions = [
    'env_info_opt_a30',
    'env_info_opt_b30',
    'env_info_opt_f30',
    'env_info_opt_no_fid',
  ];

  it('should have exactly 4 options', () => {
    expect(FID_OPTIONS.length).toBe(4);
  });

  expectedOptions.forEach((option, idx) => {
    it(`FID_OPTIONS[${idx}] should be "${option}"`, () => {
      expect(FID_OPTIONS[idx]).toBe(option);
    });

    it(`FID_OPTIONS should contain "${option}"`, () => {
      expect(FID_OPTIONS).toContain(option);
    });

    it(`FID_OPTIONS option "${option}" should start with "env_info_opt_"`, () => {
      expect(option.startsWith('env_info_opt_')).toBeTrue();
    });
  });

  it('FID_OPTIONS should have unique options', () => {
    const unique = new Set(FID_OPTIONS);
    expect(unique.size).toBe(FID_OPTIONS.length);
  });

  it('FID_OPTIONS should contain no_fid option', () => {
    expect(FID_OPTIONS).toContain('env_info_opt_no_fid');
  });
});

describe('YES_NO_OPTIONS', () => {
  const expectedOptions = [
    'env_info_opt_yes',
    'env_info_opt_no',
  ];

  it('should have exactly 2 options', () => {
    expect(YES_NO_OPTIONS.length).toBe(2);
  });

  expectedOptions.forEach((option, idx) => {
    it(`YES_NO_OPTIONS[${idx}] should be "${option}"`, () => {
      expect(YES_NO_OPTIONS[idx]).toBe(option);
    });

    it(`YES_NO_OPTIONS should contain "${option}"`, () => {
      expect(YES_NO_OPTIONS).toContain(option);
    });

    it(`YES_NO_OPTIONS option "${option}" should start with "env_info_opt_"`, () => {
      expect(option.startsWith('env_info_opt_')).toBeTrue();
    });
  });

  it('YES_NO_OPTIONS[0] should be yes option', () => {
    expect(YES_NO_OPTIONS[0]).toBe('env_info_opt_yes');
  });

  it('YES_NO_OPTIONS[1] should be no option', () => {
    expect(YES_NO_OPTIONS[1]).toBe('env_info_opt_no');
  });

  it('YES_NO_OPTIONS should have unique options', () => {
    const unique = new Set(YES_NO_OPTIONS);
    expect(unique.size).toBe(YES_NO_OPTIONS.length);
  });
});

describe('ZONE_OPTIONS', () => {
  const expectedOptions = [
    'env_info_opt_zone_1',
    'env_info_opt_zone_2',
    'env_info_opt_zone_3',
    'env_info_opt_zone_4',
    'env_info_opt_zone_5',
    'env_info_opt_zone_6',
  ];

  it('should have exactly 6 options', () => {
    expect(ZONE_OPTIONS.length).toBe(6);
  });

  expectedOptions.forEach((option, idx) => {
    it(`ZONE_OPTIONS[${idx}] should be "${option}"`, () => {
      expect(ZONE_OPTIONS[idx]).toBe(option);
    });

    it(`ZONE_OPTIONS should contain "${option}"`, () => {
      expect(ZONE_OPTIONS).toContain(option);
    });

    it(`ZONE_OPTIONS option "${option}" should start with "env_info_opt_zone_"`, () => {
      expect(option.startsWith('env_info_opt_zone_')).toBeTrue();
    });

    it(`ZONE_OPTIONS option "${option}" should end with zone number ${idx + 1}`, () => {
      expect(option.endsWith(String(idx + 1))).toBeTrue();
    });
  });

  it('ZONE_OPTIONS should have unique options', () => {
    const unique = new Set(ZONE_OPTIONS);
    expect(unique.size).toBe(ZONE_OPTIONS.length);
  });

  it('ZONE_OPTIONS zones should be numbered 1-6 consecutively', () => {
    ZONE_OPTIONS.forEach((opt, idx) => {
      expect(opt).toBe(`env_info_opt_zone_${idx + 1}`);
    });
  });
});

describe('GAS_TYPE_OPTIONS', () => {
  const expectedOptions = [
    'env_info_opt_gas_natural',
    'env_info_opt_gas_lpg',
  ];

  it('should have exactly 2 options', () => {
    expect(GAS_TYPE_OPTIONS.length).toBe(2);
  });

  expectedOptions.forEach((option, idx) => {
    it(`GAS_TYPE_OPTIONS[${idx}] should be "${option}"`, () => {
      expect(GAS_TYPE_OPTIONS[idx]).toBe(option);
    });

    it(`GAS_TYPE_OPTIONS should contain "${option}"`, () => {
      expect(GAS_TYPE_OPTIONS).toContain(option);
    });

    it(`GAS_TYPE_OPTIONS option "${option}" should start with "env_info_opt_gas_"`, () => {
      expect(option.startsWith('env_info_opt_gas_')).toBeTrue();
    });
  });

  it('GAS_TYPE_OPTIONS[0] should be natural gas option', () => {
    expect(GAS_TYPE_OPTIONS[0]).toBe('env_info_opt_gas_natural');
  });

  it('GAS_TYPE_OPTIONS[1] should be LPG option', () => {
    expect(GAS_TYPE_OPTIONS[1]).toBe('env_info_opt_gas_lpg');
  });

  it('GAS_TYPE_OPTIONS should have unique options', () => {
    const unique = new Set(GAS_TYPE_OPTIONS);
    expect(unique.size).toBe(GAS_TYPE_OPTIONS.length);
  });
});

// ─── All select options: exhaustive cross-check ──────────────────

describe('Select options exhaustive i18n key validation', () => {
  const allOptionArrays: Array<[string, string[]]> = [
    ['OUTDOOR_FUSE_OPTIONS', OUTDOOR_FUSE_OPTIONS],
    ['INDOOR_FUSE_OPTIONS', INDOOR_FUSE_OPTIONS],
    ['OUTDOOR_WIRE_OPTIONS', OUTDOOR_WIRE_OPTIONS],
    ['INDOOR_WIRE_OPTIONS', INDOOR_WIRE_OPTIONS],
    ['MODBUS_CABLE_OPTIONS', MODBUS_CABLE_OPTIONS],
    ['FID_OPTIONS', FID_OPTIONS],
    ['YES_NO_OPTIONS', YES_NO_OPTIONS],
    ['ZONE_OPTIONS', ZONE_OPTIONS],
    ['GAS_TYPE_OPTIONS', GAS_TYPE_OPTIONS],
  ];

  allOptionArrays.forEach(([name, options]) => {
    it(`${name} should be an array`, () => {
      expect(Array.isArray(options)).toBe(true);
    });

    it(`${name} should have at least 1 option`, () => {
      expect(options.length).toBeGreaterThanOrEqual(1);
    });

    it(`${name} all options should be strings`, () => {
      options.forEach((opt) => {
        expect(typeof opt).toBe('string');
      });
    });

    it(`${name} all options should start with "env_info_opt_"`, () => {
      options.forEach((opt) => {
        expect(opt.startsWith('env_info_opt_')).withContext(`option "${opt}"`).toBeTrue();
      });
    });

    it(`${name} all options should be non-empty`, () => {
      options.forEach((opt) => {
        expect(opt.length).toBeGreaterThan(0);
      });
    });

    it(`${name} options should be unique`, () => {
      const unique = new Set(options);
      expect(unique.size).toBe(options.length);
    });

    it(`${name} options should be lowercase`, () => {
      options.forEach((opt) => {
        expect(opt).toBe(opt.toLowerCase());
      });
    });
  });
});

// ─── ENV_INFO_SECTIONS ────────────────────────────────────────────

describe('ENV_INFO_SECTIONS', () => {
  it('HEAT_PUMP should have exactly 4 sections', () => {
    const sections = ENV_INFO_SECTIONS[DeviceType.HEAT_PUMP];
    expect(sections).toBeDefined();
    expect(sections!.length).toBe(4);
  });

  it('HEAT_PUMP sections should have correct keys and labels', () => {
    const sections = ENV_INFO_SECTIONS[DeviceType.HEAT_PUMP]!;
    const sectionMap = new Map(sections.map(s => [s.key, s.label]));

    expect(sectionMap.get('electrical')).toBe('env_info_section_electrical');
    expect(sectionMap.get('hydraulic')).toBe('env_info_section_hydraulic');
    expect(sectionMap.get('freon')).toBe('env_info_section_freon');
    expect(sectionMap.get('systemOp')).toBe('env_info_section_system_operation');
  });

  it('GAS_BOILER should have exactly 1 section', () => {
    const sections = ENV_INFO_SECTIONS[DeviceType.GAS_BOILER];
    expect(sections).toBeDefined();
    expect(sections!.length).toBe(1);
  });

  it('GAS_BOILER section should have key "gasBoiler" and correct label', () => {
    const sections = ENV_INFO_SECTIONS[DeviceType.GAS_BOILER]!;
    expect(sections[0].key).toBe('gasBoiler');
    expect(sections[0].label).toBe('env_info_section_gas_boiler');
  });

  it('should not define sections for BOILER', () => {
    expect(ENV_INFO_SECTIONS[DeviceType.BOILER]).toBeUndefined();
  });

  it('should not define sections for AIR_CONDITION', () => {
    expect(ENV_INFO_SECTIONS[DeviceType.AIR_CONDITION]).toBeUndefined();
  });

  it('HEAT_PUMP section keys should match sections referenced in ENV_INFO_FIELDS', () => {
    const sectionKeys = new Set(ENV_INFO_SECTIONS[DeviceType.HEAT_PUMP]!.map(s => s.key));
    const fieldSections = new Set(ENV_INFO_FIELDS[DeviceType.HEAT_PUMP]!.map(f => f.section));
    for (const section of fieldSections) {
      expect(sectionKeys.has(section)).withContext(`section "${section}" used in fields but not defined in sections`).toBeTrue();
    }
  });

  it('GAS_BOILER section key should match sections referenced in ENV_INFO_FIELDS', () => {
    const sectionKeys = new Set(ENV_INFO_SECTIONS[DeviceType.GAS_BOILER]!.map(s => s.key));
    const fieldSections = new Set(ENV_INFO_FIELDS[DeviceType.GAS_BOILER]!.map(f => f.section));
    for (const section of fieldSections) {
      expect(sectionKeys.has(section)).withContext(`section "${section}" used in fields but not defined in sections`).toBeTrue();
    }
  });

  it('all section labels should follow env_info_section_* i18n key convention', () => {
    for (const deviceType of [DeviceType.HEAT_PUMP, DeviceType.GAS_BOILER]) {
      const sections = ENV_INFO_SECTIONS[deviceType]!;
      for (const section of sections) {
        expect(section.label.startsWith('env_info_section_')).withContext(`section ${section.key} has label "${section.label}"`).toBeTrue();
      }
    }
  });

  // ─── Parameterizovani testovi: HEAT_PUMP sekcije detaljno ─────────────────
  const expectedHeatPumpSections: Array<{ key: string; label: string }> = [
    { key: 'electrical', label: 'env_info_section_electrical' },
    { key: 'hydraulic', label: 'env_info_section_hydraulic' },
    { key: 'freon', label: 'env_info_section_freon' },
    { key: 'systemOp', label: 'env_info_section_system_operation' },
  ];

  expectedHeatPumpSections.forEach(({ key, label }) => {
    it(`HEAT_PUMP sections should contain section with key="${key}"`, () => {
      const sections = ENV_INFO_SECTIONS[DeviceType.HEAT_PUMP]!;
      const section = sections.find(s => s.key === key);
      expect(section).toBeDefined();
    });

    it(`HEAT_PUMP section "${key}" should have label="${label}"`, () => {
      const sections = ENV_INFO_SECTIONS[DeviceType.HEAT_PUMP]!;
      const section = sections.find(s => s.key === key);
      expect(section!.label).toBe(label);
    });

    it(`HEAT_PUMP section "${key}" label should start with "env_info_section_"`, () => {
      const sections = ENV_INFO_SECTIONS[DeviceType.HEAT_PUMP]!;
      const section = sections.find(s => s.key === key);
      expect(section!.label.startsWith('env_info_section_')).toBeTrue();
    });
  });

  it('HEAT_PUMP section keys should be unique', () => {
    const sections = ENV_INFO_SECTIONS[DeviceType.HEAT_PUMP]!;
    const keys = sections.map(s => s.key);
    const unique = new Set(keys);
    expect(unique.size).toBe(keys.length);
  });

  it('HEAT_PUMP section labels should be unique', () => {
    const sections = ENV_INFO_SECTIONS[DeviceType.HEAT_PUMP]!;
    const labels = sections.map(s => s.label);
    const unique = new Set(labels);
    expect(unique.size).toBe(labels.length);
  });

  it('GAS_BOILER section key should be string', () => {
    const sections = ENV_INFO_SECTIONS[DeviceType.GAS_BOILER]!;
    expect(typeof sections[0].key).toBe('string');
  });

  it('GAS_BOILER section label should be string', () => {
    const sections = ENV_INFO_SECTIONS[DeviceType.GAS_BOILER]!;
    expect(typeof sections[0].label).toBe('string');
  });

  // ─── Section-field consistency ────────────────────────────────────────────
  it('no HEAT_PUMP field should reference a section not in ENV_INFO_SECTIONS', () => {
    const definedSectionKeys = new Set(ENV_INFO_SECTIONS[DeviceType.HEAT_PUMP]!.map(s => s.key));
    const fields = ENV_INFO_FIELDS[DeviceType.HEAT_PUMP]!;
    for (const field of fields) {
      expect(definedSectionKeys.has(field.section)).withContext(
        `field "${field.key}" references section "${field.section}" which is not defined`
      ).toBeTrue();
    }
  });

  it('no GAS_BOILER field should reference a section not in ENV_INFO_SECTIONS', () => {
    const definedSectionKeys = new Set(ENV_INFO_SECTIONS[DeviceType.GAS_BOILER]!.map(s => s.key));
    const fields = ENV_INFO_FIELDS[DeviceType.GAS_BOILER]!;
    for (const field of fields) {
      expect(definedSectionKeys.has(field.section)).withContext(
        `field "${field.key}" references section "${field.section}" which is not defined`
      ).toBeTrue();
    }
  });
});

// ─── EnvInfoFieldConfig interface structural validation ───────────

describe('EnvInfoFieldConfig interface structural validation', () => {
  it('HEAT_PUMP fields should all have key, label, type, section properties', () => {
    const fields = ENV_INFO_FIELDS[DeviceType.HEAT_PUMP]!;
    for (const field of fields) {
      expect('key' in field).withContext(`field missing "key"`).toBe(true);
      expect('label' in field).withContext(`field "${field.key}" missing "label"`).toBe(true);
      expect('type' in field).withContext(`field "${field.key}" missing "type"`).toBe(true);
      expect('section' in field).withContext(`field "${field.key}" missing "section"`).toBe(true);
    }
  });

  it('GAS_BOILER fields should all have key, label, type, section properties', () => {
    const fields = ENV_INFO_FIELDS[DeviceType.GAS_BOILER]!;
    for (const field of fields) {
      expect('key' in field).withContext(`field missing "key"`).toBe(true);
      expect('label' in field).withContext(`field "${field.key}" missing "label"`).toBe(true);
      expect('type' in field).withContext(`field "${field.key}" missing "type"`).toBe(true);
      expect('section' in field).withContext(`field "${field.key}" missing "section"`).toBe(true);
    }
  });

  it('HEAT_PUMP field keys should all be non-empty strings', () => {
    const fields = ENV_INFO_FIELDS[DeviceType.HEAT_PUMP]!;
    for (const field of fields) {
      expect(typeof field.key).toBe('string');
      expect(field.key.length).toBeGreaterThan(0);
    }
  });

  it('GAS_BOILER field labels should all be non-empty strings', () => {
    const fields = ENV_INFO_FIELDS[DeviceType.GAS_BOILER]!;
    for (const field of fields) {
      expect(typeof field.label).toBe('string');
      expect(field.label.length).toBeGreaterThan(0);
    }
  });

  it('HEAT_PUMP select fields should have options array, number fields should not require options', () => {
    const fields = ENV_INFO_FIELDS[DeviceType.HEAT_PUMP]!;
    const selectFields = fields.filter(f => f.type === 'select');
    const numberFields = fields.filter(f => f.type === 'number');

    for (const sf of selectFields) {
      expect(sf.options).withContext(`select field "${sf.key}" should have options`).toBeDefined();
    }
    for (const nf of numberFields) {
      expect(nf.options).withContext(`number field "${nf.key}" should not have options`).toBeUndefined();
    }
  });

  it('GAS_BOILER select fields should have options, number fields should not have options', () => {
    const fields = ENV_INFO_FIELDS[DeviceType.GAS_BOILER]!;
    const selectFields = fields.filter(f => f.type === 'select');
    const numberFields = fields.filter(f => f.type === 'number');

    for (const sf of selectFields) {
      expect(sf.options).withContext(`select field "${sf.key}" should have options`).toBeDefined();
    }
    for (const nf of numberFields) {
      expect(nf.options).withContext(`number field "${nf.key}" should not have options`).toBeUndefined();
    }
  });
});
