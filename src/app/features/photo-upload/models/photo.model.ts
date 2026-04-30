export interface CapturedPhoto {
  id: string;
  webPath: string;
  uri: string;
}

/** Maps InterventionType enum value to short folder/file name. */
export const INTERVENTION_TYPE_SHORT: Record<string, string> = {
  intervention_repair: 'repair',
  intervention_noise: 'noise',
  intervention_replace: 'replace',
  commissioning: 'comm',
  annual_service: 'annual',
};
