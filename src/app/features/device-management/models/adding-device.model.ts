export interface DeviceRegistration {
  sn: string;
  deviceCode: string;
  deviceName: string;
  registeredBy: string;
  registeredAt: string;
  [key: string]: unknown;
}
