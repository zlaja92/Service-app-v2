import { PhotoRequirement } from '../../../core/config/config.model';
import { applyPhotoUploadResult, resolvePhotoRequirement } from './photo.model';

describe('resolvePhotoRequirement()', () => {
  const base: PhotoRequirement = { requiredPhotos: 1, maxPhotos: 3, requireSparePartPhotos: false, description: '' };
  const config = (req: PhotoRequirement) => ({ 'gas-boiler': { commissioning: req } });

  it('returns null without a requirement for the device type and intervention', () => {
    expect(resolvePhotoRequirement(undefined, 'gas-boiler', 'commissioning', 'in-warranty')).toBeNull();
    expect(resolvePhotoRequirement(config(base), 'boiler', 'commissioning', 'in-warranty')).toBeNull();
    expect(resolvePhotoRequirement(config(base), 'gas-boiler', 'annual_service', 'in-warranty')).toBeNull();
  });

  it('defaults to in-warranty only when the warranty fields are missing (previous behaviour)', () => {
    expect(resolvePhotoRequirement(config(base), 'gas-boiler', 'commissioning', 'in-warranty')).toBe(base);
    expect(resolvePhotoRequirement(config(base), 'gas-boiler', 'commissioning', 'out-of-warranty')).toBeNull();
  });

  it('follows inWarranty / outOfWarranty', () => {
    const outOnly = { ...base, inWarranty: false, outOfWarranty: true };
    expect(resolvePhotoRequirement(config(outOnly), 'gas-boiler', 'commissioning', 'in-warranty')).toBeNull();
    expect(resolvePhotoRequirement(config(outOnly), 'gas-boiler', 'commissioning', 'out-of-warranty')).toBe(outOnly);

    const both = { ...base, inWarranty: true, outOfWarranty: true };
    expect(resolvePhotoRequirement(config(both), 'gas-boiler', 'commissioning', 'in-warranty')).toBe(both);
    expect(resolvePhotoRequirement(config(both), 'gas-boiler', 'commissioning', 'out-of-warranty')).toBe(both);

    const none = { ...base, inWarranty: false, outOfWarranty: false };
    expect(resolvePhotoRequirement(config(none), 'gas-boiler', 'commissioning', 'in-warranty')).toBeNull();
    expect(resolvePhotoRequirement(config(none), 'gas-boiler', 'commissioning', 'out-of-warranty')).toBeNull();
  });

  it('returns null while the warranty status is not chosen yet', () => {
    const both = { ...base, inWarranty: true, outOfWarranty: true };
    expect(resolvePhotoRequirement(config(both), 'gas-boiler', 'commissioning', '')).toBeNull();
  });
});

describe('applyPhotoUploadResult()', () => {
  it('writes the uploaded paths and no failure count when all uploads succeeded', () => {
    const data: Record<string, unknown> = { note: 'x' };

    applyPhotoUploadResult(data, { uploaded: ['a/1.jpg', 'a/2.jpg'], failed: 0 });

    expect(data['photoPaths']).toEqual(['a/1.jpg', 'a/2.jpg']);
    expect('photoUploadFailed' in data).toBeFalse();
  });

  it('writes both fields when some uploads failed', () => {
    const data: Record<string, unknown> = {};

    applyPhotoUploadResult(data, { uploaded: ['a/1.jpg'], failed: 2 });

    expect(data['photoPaths']).toEqual(['a/1.jpg']);
    expect(data['photoUploadFailed']).toBe(2);
  });

  it('writes only the failure count when every upload failed', () => {
    const data: Record<string, unknown> = {};

    applyPhotoUploadResult(data, { uploaded: [], failed: 3 });

    expect('photoPaths' in data).toBeFalse();
    expect(data['photoUploadFailed']).toBe(3);
  });

  it('leaves the data unchanged without photos', () => {
    const data: Record<string, unknown> = { note: 'x' };

    applyPhotoUploadResult(data, { uploaded: [], failed: 0 });

    expect(data).toEqual({ note: 'x' });
  });
});
