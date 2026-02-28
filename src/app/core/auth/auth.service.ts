import { Injectable } from '@angular/core';
import { FirebaseAuthentication } from '@capacitor-firebase/authentication';
import { AuthUser } from './auth.model';
import { LoggerService } from '../logger/logger.service';

@Injectable({ providedIn: 'root' })
export class AuthService {
  constructor(private logger: LoggerService) {}

  async login(email: string, password: string): Promise<AuthUser> {
    this.logger.info('Attempting login', { email });
    const result = await FirebaseAuthentication.signInWithEmailAndPassword({ email, password });

    if (!result.user) {
      throw new Error('Login failed: no user returned');
    }

    const user: AuthUser = {
      uid: result.user.uid,
      email: result.user.email ?? null,
      displayName: result.user.displayName ?? null,
    };

    this.logger.info('Login successful', { uid: user.uid, email: user.email });
    return user;
  }

  async logout(): Promise<void> {
    this.logger.info('Logging out');
    await FirebaseAuthentication.signOut();
    this.logger.info('Logout successful');
  }

  private static readonly AUTH_READY_TIMEOUT_MS = 5000;

  /**
   * Waits for Firebase to finish restoring the auth session from persistence
   * (IndexedDB on web, Keychain on iOS, encrypted prefs on Android).
   *
   * On web, `getCurrentUser()` returns null immediately because the JS SDK
   * hasn't loaded the token from IndexedDB yet. This method listens for the
   * first `authStateChange` event, which fires only after persistence is resolved.
   *
   * Has a timeout safety net - if Firebase doesn't respond within the limit,
   * resolves with null (user treated as not authenticated, shown login page).
   */
  waitForAuthReady(): Promise<AuthUser | null> {
    return new Promise((resolve) => {
      let settled = false;

      const timeout = setTimeout(() => {
        if (!settled) {
          settled = true;
          this.logger.warn('Auth ready timeout - treating as not authenticated', {
            timeoutMs: AuthService.AUTH_READY_TIMEOUT_MS,
          });
          resolve(null);
        }
      }, AuthService.AUTH_READY_TIMEOUT_MS);

      const listenerHandle = FirebaseAuthentication.addListener('authStateChange', (change) => {
        if (settled) return;
        settled = true;
        clearTimeout(timeout);
        listenerHandle.then(handle => handle.remove());

        if (change.user) {
          resolve({
            uid: change.user.uid,
            email: change.user.email ?? null,
            displayName: change.user.displayName ?? null,
          });
        } else {
          resolve(null);
        }
      });
    });
  }

  onAuthStateChange(callback: (user: AuthUser | null) => void): void {
    FirebaseAuthentication.addListener('authStateChange', (change) => {
      if (change.user) {
        callback({
          uid: change.user.uid,
          email: change.user.email ?? null,
          displayName: change.user.displayName ?? null,
        });
      } else {
        callback(null);
      }
    });
  }
}
