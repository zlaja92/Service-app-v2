import { DeviceType } from '../../../shared/models/device.model';

export interface DeviceRegistration {
  sn: string;
  deviceCode: string;
  deviceName: string;
  registeredBy: string;
  registeredAt: string;
  [key: string]: unknown;
}

export type WarrantyStatus = 'in_warranty' | 'out_of_warranty';

export interface FieldGroupConfig {
  key: string;
  label: string;
}

export interface FieldConfig {
  key: string;
  label: string;
  type: 'text' | 'number' | 'date' | 'select' | 'textarea';
  required: boolean;
  group: string;
  options?: { value: string; label: string }[];
  showWhen?: (formValue: Record<string, unknown>) => boolean;
}

export const FIELD_GROUPS: FieldGroupConfig[] = [
  { key: 'basic', label: 'add_device_group_basic' },
  { key: 'extra', label: 'add_device_group_extra' },
];

const BASE_FIELDS: FieldConfig[] = [
  {
    key: 'warrantyStatus',
    label: 'add_device_warranty',
    type: 'select',
    required: true,
    group: 'basic',
    options: [
      { value: 'in_warranty', label: 'add_device_in_warranty' },
      { value: 'out_of_warranty', label: 'add_device_out_of_warranty' },
    ],
  },
  {
    key: 'comment',
    label: 'add_device_comment',
    type: 'textarea',
    required: false,
    group: 'basic',
  },
];

const CONNECTED_DEVICE_FIELD: FieldConfig = {
  key: 'connectedDevice',
  label: 'add_device_connected_device',
  type: 'text',
  required: false,
  group: 'extra',
};

function makeExtraFields(prefix: string, count: number): FieldConfig[] {
  return Array.from({ length: count }, (_, i) => ({
    key: `${prefix}${i + 1}`,
    label: `add_device_${prefix}${i + 1}`,
    type: 'text' as const,
    required: false,
    group: 'extra',
  }));
}

const HEAT_PUMP_FIELDS: FieldConfig[] = [
  ...BASE_FIELDS,
  CONNECTED_DEVICE_FIELD,
  ...makeExtraFields('tp_field_', 5),
];

const GAS_BOILER_FIELDS: FieldConfig[] = [
  ...BASE_FIELDS,
  ...makeExtraFields('gk_field_', 5),
];

const MONOBLOCK_FIELDS: FieldConfig[] = [
  ...BASE_FIELDS,
  CONNECTED_DEVICE_FIELD,
  ...makeExtraFields('mb_field_', 5),
];

export const DEVICE_FORM_CONFIG: Record<DeviceType, FieldConfig[]> = {
  [DeviceType.BOILER]: BASE_FIELDS,
  [DeviceType.AIR_CONDITION]: BASE_FIELDS,
  [DeviceType.HEAT_PUMP]: HEAT_PUMP_FIELDS,
  [DeviceType.GAS_BOILER]: GAS_BOILER_FIELDS,
  [DeviceType.MONOBLOCK]: MONOBLOCK_FIELDS,
};
