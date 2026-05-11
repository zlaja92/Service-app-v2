export interface CapturedPhoto {
  id: string;
  webPath: string;
  uri: string;
}

/** Maps InterventionType enum value to short folder/file name. */
export const INTERVENTION_TYPE_SHORT: Record<string, string> = {
  interventionRepair: 'repair',
  intervention_noise: 'noise',
  intervention_replace: 'replace',
  commissioning: 'comm',
  annual_service: 'annual',
};
