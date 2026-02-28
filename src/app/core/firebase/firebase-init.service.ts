import { Injectable } from '@angular/core';
import { initializeApp, FirebaseApp, getApps } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { environment } from '../../../environments/environment';
import { LoggerService } from '../logger/logger.service';

@Injectable({ providedIn: 'root' })
export class FirebaseInitService {
  private app: FirebaseApp | null = null;

  constructor(private logger: LoggerService) {}

  initialize(): void {
    if (getApps().length > 0) {
      this.app = getApps()[0];
      this.logger.debug('Firebase already initialized');
      return;
    }

    this.app = initializeApp(environment.firebase);
    // Initialize Auth to ensure persistence is set up
    getAuth(this.app);
    this.logger.info('Firebase initialized', { projectId: environment.firebase.projectId });
  }

  getApp(): FirebaseApp {
    if (!this.app) {
      throw new Error('Firebase not initialized. Call initialize() first.');
    }
    return this.app;
  }
}
