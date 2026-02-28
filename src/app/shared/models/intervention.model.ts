export interface InterventionType {
  name: string;
  code: string;
}

export interface InterventionPart {
  name: string;
  code: string;
  quantity: number;
}

export interface Intervention {
  id?: string;
  barcode: string;
  date: Date;
  type: InterventionType;
  servicer: string;
  description: string;
  notes: string;
  errorCode: string;
  distance: number;
  parts: InterventionPart[];
  setup?: Record<string, unknown>;
}
