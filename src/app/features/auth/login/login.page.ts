import { Component, inject, OnInit, OnDestroy } from '@angular/core';
import { FormBuilder, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router } from '@angular/router';
import {
  IonContent, IonItem, IonInput, IonButton, IonSpinner, IonIcon,
  MenuController,
} from '@ionic/angular/standalone';
import { addIcons } from 'ionicons';
import { alertCircleOutline } from 'ionicons/icons';
import { TranslocoModule, TranslocoService } from '@jsverse/transloco';
import { SplashScreen } from '@capacitor/splash-screen';
import { AuthService } from '../../../core/auth/auth.service';
import { AuthStore } from '../../../core/auth/auth.store';
import { ConfigStore } from '../../../core/config/config.store';
import { SessionService } from '../../../core/session/session.service';
import { LoggerService } from '../../../core/logger/logger.service';

@Component({
  selector: 'app-login',
  templateUrl: './login.page.html',
  styleUrls: ['./login.page.scss'],
  imports: [
    ReactiveFormsModule,
    TranslocoModule,
    IonContent, IonItem, IonInput, IonButton, IonSpinner, IonIcon,
  ],
})
export class LoginPage implements OnInit, OnDestroy {
  protected authStore = inject(AuthStore);
  protected configStore = inject(ConfigStore);
  private translocoService = inject(TranslocoService);
  private authService = inject(AuthService);
  private sessionService = inject(SessionService);
  private logger = inject(LoggerService);
  private router = inject(Router);
  private fb = inject(FormBuilder);
  private menuCtrl = inject(MenuController);

  private static readonly EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

  loginForm: FormGroup = this.fb.group({
    email: ['', [Validators.required, Validators.pattern(LoginPage.EMAIL_PATTERN)]],
    password: ['', [Validators.required]],
  });

  constructor() {
    addIcons({ alertCircleOutline });
  }

  ngOnInit(): void {
    this.menuCtrl.enable(false);
    void SplashScreen.hide();
  }

  ngOnDestroy(): void {
    this.menuCtrl.enable(true);
  }

  async onLogin(): Promise<void> {
    if (this.loginForm.invalid) return;

    const { email, password } = this.loginForm.value;
    // Normalize the email to match how Firebase Auth stores it (lowercase) and
    // to drop accidental whitespace. The password is sent verbatim — it may
    // legitimately contain spaces or mixed case.
    const normalizedEmail = (email as string).trim().toLowerCase();
    this.authStore.setLoading(true);

    try {
      const user = await this.authService.login(normalizedEmail, password);
      this.authStore.setUser(user);

      await this.sessionService.bootstrap();

      this.logger.info('Login flow completed, navigating to home');
      this.router.navigate(['/home'], { replaceUrl: true });
    } catch (error: unknown) {
      const message = this.getErrorMessage(error);
      this.logger.error('Login failed', { error: message });
      this.authStore.setError(message);
    } finally {
      this.authStore.setLoading(false);
    }
  }

  private getErrorMessage(error: unknown): string {
    const errorStr = String(error);
    if (errorStr.includes('auth/user-not-found') || errorStr.includes('auth/wrong-password')) {
      return this.translocoService.translate('login_error_wrong_credentials');
    }
    if (errorStr.includes('auth/invalid-credential')) {
      return this.translocoService.translate('login_error_wrong_credentials');
    }
    if (errorStr.includes('auth/too-many-requests')) {
      return this.translocoService.translate('login_error_too_many_attempts');
    }
    if (errorStr.includes('auth/network-request-failed')) {
      return this.translocoService.translate('login_error_no_internet');
    }
    return this.translocoService.translate('login_error_generic');
  }
}
