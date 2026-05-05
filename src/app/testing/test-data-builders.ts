import { Timestamp } from '@capacitor-firebase/firestore';
import { Device, DeviceType } from '../shared/models/device.model';
import { AppConfig, getDefaultConfig } from '../core/config/config.model';
import { AuthUser } from '../core/auth/auth.model';
import { CartItem } from '../features/cart/cart.service';

// ─── Device ───────────────────────────────────────────────────────────────────

/**
 * Builds a valid Device object with realistic default values.
 * All required fields are populated so the object passes schema validation.
 *
 * Usage:
 *   buildDevice()                          // fully-populated defaults
 *   buildDevice({ type: DeviceType.BOILER }) // override specific fields
 */
export function buildDevice(overrides: Partial<Device> = {}): Device {
  return {
    code: 'GENUS-ONE-24',
    name: 'Genus One 24 kW',
    type: DeviceType.GAS_BOILER,
    subType: 'wall-hung',
    unitCount: 1,
    exists: true,
    commissioning: false,
    annualService: true,
    connectedDevice: false,
    firstServiceYear: 2023,
    serviceWindowStart: 1,
    serviceWindowEnd: 12,
    warrantyMonths: 24,
    ...overrides,
  };
}

// ─── AppConfig ────────────────────────────────────────────────────────────────

/**
 * Builds a valid AppConfig object.
 * Delegates to getDefaultConfig() for base values so any changes to the
 * default shape are automatically reflected here.
 *
 * Usage:
 *   buildAppConfig()
 *   buildAppConfig({ version: 42 })
 *   buildAppConfig({ features: { ...getDefaultFeatures(), cart: true } })
 */
export function buildAppConfig(overrides: Partial<AppConfig> = {}): AppConfig {
  return {
    ...getDefaultConfig(),
    ...overrides,
  };
}

// ─── AuthUser ─────────────────────────────────────────────────────────────────

/**
 * Builds a valid AuthUser object.
 * Represents a typical authenticated servicer account.
 *
 * Usage:
 *   buildAuthUser()
 *   buildAuthUser({ uid: 'custom-uid', email: 'other@example.com' })
 */
export function buildAuthUser(overrides: Partial<AuthUser> = {}): AuthUser {
  return {
    uid: 'user-test-uid-001',
    email: 'servicer@example.com',
    displayName: 'Test Servicer',
    ...overrides,
  };
}

// ─── CartItem ─────────────────────────────────────────────────────────────────

/**
 * Builds a valid CartItem object.
 * Represents a single spare part in the shopping cart.
 *
 * Usage:
 *   buildCartItem()
 *   buildCartItem({ partCode: 'PART-999', quantity: 3 })
 *   buildCartItem({ price: null })  // part without known price
 */
export function buildCartItem(overrides: Partial<CartItem> = {}): CartItem {
  return {
    partCode: 'PART-001-TEST',
    name: 'Test Spare Part',
    price: 49.99,
    currency: 'EUR',
    quantity: 1,
    ...overrides,
  };
}

// ─── Firestore Timestamp ──────────────────────────────────────────────────────

export function buildFirestoreTimestamp(date: Date): Timestamp {
  return Timestamp.fromDate(date);
}

// ─── Registration Data ────────────────────────────────────────────────────────

/**
 * Builds a valid device registration data payload as stored in Firestore.
 * Represents the raw Record written by the registration feature.
 *
 * Usage:
 *   buildRegistrationData()
 *   buildRegistrationData({ voidWarranty: true })
 *   buildRegistrationData({ sn: 'SN12345678901234567890' })
 */
export function buildRegistrationData(
  overrides: Record<string, unknown> = {},
): Record<string, unknown> {
  return {
    sn: 'SN1234567890123456789',
    deviceCode: 'GENUS-ONE-24',
    deviceType: DeviceType.GAS_BOILER,
    firstName: 'Marko',
    lastName: 'Markovic',
    street: 'Bulevar Kralja Aleksandra',
    homeNumber: '73',
    city: 'Beograd',
    postalCode: '11000',
    phone: '+381601234567',
    connectedDeviceSN: '',
    installerName: 'Nikola Nikolic',
    installerPhoneNumber: '+381691234567',
    dateOfPurchase: buildFirestoreTimestamp(new Date('2023-06-15')),
    lastWarrantyExtension: null,
    voidWarranty: false,
    callAccepted: true,
    addedBy: 'user-test-uid-001',
    additionType: 'NO_COMMIS',
    createdAt: buildFirestoreTimestamp(new Date('2023-06-20')),
    ...overrides,
  };
}

// ─── Intervention Data ────────────────────────────────────────────────────────

/**
 * Builds a valid intervention data payload as stored in Firestore.
 * Represents the raw Record written by the intervention feature.
 *
 * Usage:
 *   buildInterventionData()
 *   buildInterventionData({ fault: 'E05', resolved: true })
 *   buildInterventionData({ deviceType: 'heat-pump' })
 */
export function buildInterventionData(
  overrides: Record<string, unknown> = {},
): Record<string, unknown> {
  return {
    sn: 'SN1234567890123456789',
    deviceCode: 'GENUS-ONE-24',
    deviceType: DeviceType.GAS_BOILER,
    deviceName: 'Genus One 24 kW',
    servicerId: 'servicer-id-001',
    tenantId: 'mock-tenant',
    fault: 'E01',
    error: '',
    description: 'Redovni servis',
    resolved: true,
    partsUsed: [],
    photos: [],
    createdAt: buildFirestoreTimestamp(new Date('2024-03-10')),
    updatedAt: buildFirestoreTimestamp(new Date('2024-03-10')),
    ...overrides,
  };
}
