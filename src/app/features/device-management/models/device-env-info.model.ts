import { DeviceType } from '../../../shared/models/device.model';

export interface EnvInfoFieldConfig {
  key: string;
  label: string;
  type: 'select' | 'number';
  unit?: string;
  /** For select fields: array of i18n keys. Stored value = i18n key, display = translated. */
  options?: string[];
  section: string;
}

export interface EnvInfoSectionConfig {
  key: string;
  label: string;
}

// ─── Select Options (i18n keys - stored as value, translated for display) ─────

export const OUTDOOR_FUSE_OPTIONS = [
  'env_info_opt_c10a',
  'env_info_opt_c13a',
  'env_info_opt_c16a',
  'env_info_opt_c20a',
  'env_info_opt_c25a',
  'env_info_opt_c32a',
  'env_info_opt_no_fuse',
];

export const INDOOR_FUSE_OPTIONS = [
  'env_info_opt_c2_4a',
  'env_info_opt_c10a',
  'env_info_opt_c13a',
  'env_info_opt_c16a',
  'env_info_opt_c20a',
  'env_info_opt_c25a',
  'env_info_opt_c32a',
  'env_info_opt_no_fuse',
];

export const OUTDOOR_WIRE_OPTIONS = [
  'env_info_opt_3x2_5',
  'env_info_opt_3x4',
  'env_info_opt_3x6',
  'env_info_opt_5x2_5',
  'env_info_opt_5x4',
  'env_info_opt_5x6',
  'env_info_opt_none_listed',
];

export const INDOOR_WIRE_OPTIONS = [
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

export const MODBUS_CABLE_OPTIONS = [
  'env_info_opt_shielded_2x075',
  'env_info_opt_shielded_2x15',
  'env_info_opt_shielded_3x075',
  'env_info_opt_shielded_3x15',
  'env_info_opt_unshielded_2x075',
  'env_info_opt_unshielded_2x15',
  'env_info_opt_unshielded_3x075',
  'env_info_opt_unshielded_3x15',
];

export const FID_OPTIONS = [
  'env_info_opt_a30',
  'env_info_opt_b30',
  'env_info_opt_f30',
  'env_info_opt_no_fid',
];

export const YES_NO_OPTIONS = [
  'env_info_opt_yes',
  'env_info_opt_no',
];

export const ZONE_OPTIONS = [
  'env_info_opt_zone_1',
  'env_info_opt_zone_2',
  'env_info_opt_zone_3',
  'env_info_opt_zone_4',
  'env_info_opt_zone_5',
  'env_info_opt_zone_6',
];

export const GAS_TYPE_OPTIONS = [
  'env_info_opt_gas_natural',
  'env_info_opt_gas_lpg',
];

// ─── Sections ─────────────────────────────────────────────────────

const HP_SECTIONS: EnvInfoSectionConfig[] = [
  { key: 'electrical', label: 'env_info_section_electrical' },
  { key: 'hydraulic', label: 'env_info_section_hydraulic' },
  { key: 'freon', label: 'env_info_section_freon' },
  { key: 'systemOp', label: 'env_info_section_system_operation' },
];

const MONOBLOCK_SECTIONS: EnvInfoSectionConfig[] = [
  { key: 'electrical', label: 'env_info_section_electrical' },
  { key: 'hydraulic', label: 'env_info_section_hydraulic' },
  { key: 'systemOp', label: 'env_info_section_system_operation' },
];

const GAS_BOILER_SECTIONS: EnvInfoSectionConfig[] = [
  { key: 'gasBoiler', label: 'env_info_section_gas_boiler' },
];

// ─── Field Configurations ─────────────────────────────────────────

const HP_FIELDS: EnvInfoFieldConfig[] = [
  // Electrical
  { key: 'outdoorFuse', label: 'env_info_outdoor_fuse', type: 'select', section: 'electrical', options: OUTDOOR_FUSE_OPTIONS },
  { key: 'indoorFuse', label: 'env_info_indoor_fuse', type: 'select', section: 'electrical', options: INDOOR_FUSE_OPTIONS },
  { key: 'outdoorWire', label: 'env_info_outdoor_wire', type: 'select', section: 'electrical', options: OUTDOOR_WIRE_OPTIONS },
  { key: 'indoorWire', label: 'env_info_indoor_wire', type: 'select', section: 'electrical', options: INDOOR_WIRE_OPTIONS },
  { key: 'modbusCable', label: 'env_info_modbus_cable', type: 'select', section: 'electrical', options: MODBUS_CABLE_OPTIONS },
  { key: 'modbusSeparated', label: 'env_info_modbus_separated', type: 'select', section: 'electrical', options: YES_NO_OPTIONS },
  { key: 'outdoorFID', label: 'env_info_outdoor_fid', type: 'select', section: 'electrical', options: FID_OPTIONS },
  { key: 'indoorFID', label: 'env_info_indoor_fid', type: 'select', section: 'electrical', options: FID_OPTIONS },

  // Hydraulic
  { key: 'cooling', label: 'env_info_cooling', type: 'select', section: 'hydraulic', options: YES_NO_OPTIONS },
  { key: 'sanitaryBoiler', label: 'env_info_sanitary_boiler', type: 'select', section: 'hydraulic', options: YES_NO_OPTIONS },
  { key: 'buffer', label: 'env_info_buffer', type: 'select', section: 'hydraulic', options: YES_NO_OPTIONS },
  { key: 'zoneNumber', label: 'env_info_zone_number', type: 'select', section: 'hydraulic', options: ZONE_OPTIONS },
  { key: 'hydraulicSwitch', label: 'env_info_hydraulic_switch', type: 'select', section: 'hydraulic', options: YES_NO_OPTIONS },
  { key: 'magneticFilter', label: 'env_info_magnetic_filter', type: 'select', section: 'hydraulic', options: YES_NO_OPTIONS },
  { key: 'additionalExpansionTank', label: 'env_info_additional_expansion_tank', type: 'select', section: 'hydraulic', options: YES_NO_OPTIONS },
  { key: 'additionalExpansionTankPTV', label: 'env_info_additional_expansion_tank_ptv', type: 'select', section: 'hydraulic', options: YES_NO_OPTIONS },

  // Freon
  { key: 'freonSysTested', label: 'env_info_freon_sys_tested', type: 'select', section: 'freon', options: YES_NO_OPTIONS },
  { key: 'sysVacuumed', label: 'env_info_sys_vacuumed', type: 'select', section: 'freon', options: YES_NO_OPTIONS },
  { key: 'pipeLength', label: 'env_info_pipe_length', type: 'number', section: 'freon', unit: 'm' },
  { key: 'additionalFreon', label: 'env_info_additional_freon', type: 'number', section: 'freon', unit: 'Kg' },

  // System Operation
  { key: 'sysWaterPressure', label: 'env_info_sys_water_pressure', type: 'number', section: 'systemOp', unit: 'bar' },
  { key: 'outdoorTemp', label: 'env_info_outdoor_temp', type: 'number', section: 'systemOp', unit: '°C' },
  { key: 'waterTempOnStart', label: 'env_info_water_temp_on_start', type: 'number', section: 'systemOp', unit: '°C' },
  { key: 'returnWaterTemp', label: 'env_info_return_water_temp', type: 'number', section: 'systemOp', unit: '°C' },
  { key: 'evaporatorTemp', label: 'env_info_evaporator_temp', type: 'number', section: 'systemOp', unit: '°C' },
  { key: 'compressorTemp', label: 'env_info_compressor_temp', type: 'number', section: 'systemOp', unit: '°C' },
  { key: 'evaporatorPressure', label: 'env_info_evaporator_pressure', type: 'number', section: 'systemOp', unit: 'bar' },
  { key: 'condensationPressure', label: 'env_info_condensation_pressure', type: 'number', section: 'systemOp', unit: 'bar' },
  { key: 'waterFlow', label: 'env_info_water_flow', type: 'number', section: 'systemOp', unit: 'l/min' },
];

const GAS_BOILER_FIELDS: EnvInfoFieldConfig[] = [
  { key: 'gasType', label: 'env_info_gas_type', type: 'select', section: 'gasBoiler', options: GAS_TYPE_OPTIONS },
  { key: 'voltage', label: 'env_info_voltage', type: 'number', section: 'gasBoiler', unit: 'V' },
  { key: 'inputGasPressure', label: 'env_info_input_gas_pressure', type: 'number', section: 'gasBoiler', unit: 'mbar' },
  { key: 'minGasPressure', label: 'env_info_min_gas_pressure', type: 'number', section: 'gasBoiler', unit: 'mbar' },
  { key: 'maxGasPressure', label: 'env_info_max_gas_pressure', type: 'number', section: 'gasBoiler', unit: 'mbar' },
  { key: 'minGasBoilerPower', label: 'env_info_min_gas_boiler_power', type: 'number', section: 'gasBoiler', unit: '% CO2' },
  { key: 'maxGasBoilerPower', label: 'env_info_max_gas_boiler_power', type: 'number', section: 'gasBoiler', unit: '% CO2' },
  { key: 'expansionPressure', label: 'env_info_expansion_pressure', type: 'number', section: 'gasBoiler', unit: 'bar' },
  { key: 'sysPressure', label: 'env_info_sys_pressure', type: 'number', section: 'gasBoiler', unit: 'bar' },
  { key: 'testedOnGasLeakage', label: 'env_info_tested_on_gas_leakage', type: 'select', section: 'gasBoiler', options: YES_NO_OPTIONS },
  { key: 'gasHoseReplaced', label: 'env_info_gas_hose_replaced', type: 'select', section: 'gasBoiler', options: YES_NO_OPTIONS },
  { key: 'accordingManufacturerInstalled', label: 'env_info_according_manufacturer', type: 'select', section: 'gasBoiler', options: YES_NO_OPTIONS },
  { key: 'readyForUse', label: 'env_info_ready_for_use', type: 'select', section: 'gasBoiler', options: YES_NO_OPTIONS },
];

const MONOBLOCK_FIELDS: EnvInfoFieldConfig[] = HP_FIELDS.filter(f => f.section !== 'freon');

// ─── Lookup Maps ──────────────────────────────────────────────────

export const ENV_INFO_FIELDS: Partial<Record<DeviceType, EnvInfoFieldConfig[]>> = {
  [DeviceType.HEAT_PUMP]: HP_FIELDS,
  [DeviceType.MONOBLOCK]: MONOBLOCK_FIELDS,
  [DeviceType.GAS_BOILER]: GAS_BOILER_FIELDS,
};

export const ENV_INFO_SECTIONS: Partial<Record<DeviceType, EnvInfoSectionConfig[]>> = {
  [DeviceType.HEAT_PUMP]: HP_SECTIONS,
  [DeviceType.MONOBLOCK]: MONOBLOCK_SECTIONS,
  [DeviceType.GAS_BOILER]: GAS_BOILER_SECTIONS,
};

// ─── Helpers ──────────────────────────────────────────────────────

export function requiresEnvInfo(deviceType: DeviceType): boolean {
  return deviceType === DeviceType.HEAT_PUMP
    || deviceType === DeviceType.GAS_BOILER
    || deviceType === DeviceType.MONOBLOCK;
}
