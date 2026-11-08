// PRIVREMENO (samo za snimke ekrana uputstva) — povezuje app sa lokalnim Firebase emulatorom.
// Aktivno samo kad environment ima useEmulators: true. Briše se posle snimanja (repo.sh restore).
import { Capacitor } from '@capacitor/core';
import { getApps, initializeApp } from 'firebase/app';
import { FirebaseAuthentication } from '@capacitor-firebase/authentication';
import { FirebaseFirestore } from '@capacitor-firebase/firestore';
import { FirebaseStorage } from '@capacitor-firebase/storage';

export async function connectDemoEmulators(): Promise<void> {
  if (!Capacitor.isNativePlatform() && getApps().length === 0) {
    initializeApp({
      apiKey: 'demo-api-key',
      authDomain: '__PROJECT__.firebaseapp.com',
      projectId: '__PROJECT__',
      storageBucket: '__PROJECT__', // MORA biti isto kao projectId (rules-unit-testing puni gs://<projectId>)
      appId: '1:000000000000:web:demo',
    });
  }
  await FirebaseAuthentication.useEmulator({ host: '127.0.0.1', port: 9099 });
  await FirebaseFirestore.useEmulator({ host: '127.0.0.1', port: 8085 });
  await FirebaseStorage.useEmulator({ host: '127.0.0.1', port: 9199 });
}
