import { Timestamp } from '@capacitor-firebase/firestore';

export function toDate(value: Timestamp | null | undefined): Date | null {
  return value ? value.toDate() : null;
}
