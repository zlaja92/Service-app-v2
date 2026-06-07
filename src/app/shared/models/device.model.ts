export enum DeviceType {
  HEAT_PUMP = 'heat-pump',
  GAS_BOILER = 'gas-boiler',
  BOILER = 'boiler',
  AIR_CONDITION = 'air-condition',
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
  connectedDevice?: boolean;
  /** When true, the "Extended warranty" action is available for this device. */
  canExtendWarranty?: boolean;
  firstServiceYear?: number;
  serviceWindowStart?: number;
  serviceWindowEnd?: number;
  warrantyMonths?: number;
}
