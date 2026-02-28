export interface PartGroup {
  id?: string;
  name: string;
  deviceId: string;
}

export interface Part {
  id?: string;
  name: string;
  code: string;
  price: number;
  groupId: string;
  deviceId: string;
  inWarranty: boolean;
  imageUrls: string[];
}
