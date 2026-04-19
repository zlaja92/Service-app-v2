export enum DeviceType {
  HEAT_PUMP = 'heat_pump',
  GAS_BOILER = 'Gas_boiler',
  BOILER = 'Boiler',
  AIR_CONDITION = 'air_condition',
  MONOBLOCK = 'monoblock',
}

export interface Device {
  code: string;
  name: string;
  type: DeviceType;
  subType: string;
  unitCount: number;
  exists: boolean;
  commissioning?: boolean;
  annualService?: boolean;
  firstServiceYear?: number;
  serviceWindowStart?: number;
  serviceWindowEnd?: number;
  maxWarrantyMonths?: number;
}
