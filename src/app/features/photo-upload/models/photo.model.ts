import { PhotoRequirement } from '../../../core/config/config.model';

export interface CapturedPhoto {
  id: string;
  webPath: string;
  uri: string;
}

/**
 * The photo requirement of an intervention, or null when no photos are asked for:
 * interventionPhotoConfig[deviceType][interventionType], filtered by the warranty
 * status. Without the inWarranty/outOfWarranty fields a requirement applies to
 * in-warranty interventions only (the behaviour before the fields existed).
 * The interventionPhotos feature flag is checked by the caller.
 */
export function resolvePhotoRequirement(
  photoConfig: Record<string, Record<string, PhotoRequirement>> | undefined,
  deviceType: string,
  interventionType: string,
  warrantyStatus: string,
): PhotoRequirement | null {
  const requirement = photoConfig?.[deviceType]?.[interventionType];
  if (!requirement) return null;

  const applies = warrantyStatus === 'out-of-warranty'
    ? requirement.outOfWarranty ?? false
    : warrantyStatus === 'in-warranty'
      ? requirement.inWarranty ?? true
      : false;
  return applies ? requirement : null;
}

/** Outcome of PhotoService.uploadPhotos(). */
export interface PhotoUploadResult {
  /** Relative storage paths (without the tenant) of the uploaded photos, in capture order. */
  uploaded: string[];
  /** Number of photos whose upload failed. */
  failed: number;
}

/**
 * Records an upload outcome in the intervention data: `photoPaths` when at least
 * one photo was uploaded, `photoUploadFailed` when any upload failed. Neither
 * field is written without photos, so such documents stay unchanged.
 */
export function applyPhotoUploadResult(data: Record<string, unknown>, result: PhotoUploadResult): void {
  if (result.uploaded.length > 0) data['photoPaths'] = result.uploaded;
  if (result.failed > 0) data['photoUploadFailed'] = result.failed;
}

/** Maps InterventionType enum value to short folder/file name. */
export const INTERVENTION_TYPE_SHORT: Record<string, string> = {
  interventionRepair: 'repair',
  intervention_noise: 'noise',
  intervention_replace: 'replace',
  commissioning: 'comm',
  annual_service: 'annual',
};
