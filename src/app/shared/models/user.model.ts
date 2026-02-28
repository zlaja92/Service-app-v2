export enum UserAddType {
  COMMIS = 'COMMIS',
  NO_COMMIS = 'NO_COMMIS',
}

export interface DeviceUser {
  firstName: string;
  lastName: string;
  street: string;
  homeNumber: string;
  city: string;
  postalCode: string;
  phone: string;
  connectedDeviceSN: string;
  installerName: string;
  installerPhoneNumber: string;
  dateOfPurchase: Date | null;
  lastWarrantyExtension: Date | null;
  voidWarranty: boolean;
  callAccepted: boolean;
  addedBy: string;
  additionType: UserAddType;
}
