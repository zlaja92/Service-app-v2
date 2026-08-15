import { Injectable } from '@angular/core';
import { Capacitor } from '@capacitor/core';
import { LoggerService } from '../logger/logger.service';

/**
 * Firebase se u ovoj aplikaciji koristi ISKLJUČIVO kroz native plugine
 * (@capacitor-firebase/authentication, /firestore, /functions, /storage), koji
 * čitaju google-services.json / GoogleService-Info.plist iz native projekta.
 *
 * Web JS SDK (firebase/app, firebase/auth, ...) se NE inicijalizuje — nema web
 * Firebase konfiguracije ni u dev ni u prod environmentu. Ova klasa je zadržana
 * kao tačka poziva u app initializer-u i za eventualni budući web put.
 */
@Injectable({ providedIn: 'root' })
export class FirebaseInitService {
  constructor(private logger: LoggerService) {}

  initialize(): void {
    if (Capacitor.isNativePlatform()) {
      this.logger.debug('Native platform — Firebase runs through native plugins');
    } else {
      this.logger.debug('Web platform — web Firebase JS SDK is not used (native-only app)');
    }
  }
}
