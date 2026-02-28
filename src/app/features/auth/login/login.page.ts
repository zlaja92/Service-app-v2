import { Component, inject } from '@angular/core';
import { FormBuilder, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router } from '@angular/router';
import {
  IonContent, IonItem, IonInput, IonButton, IonSpinner, IonIcon,
} from '@ionic/angular/standalone';
import { addIcons } from 'ionicons';
import { alertCircleOutline } from 'ionicons/icons';
import { AuthService } from '../../../core/auth/auth.service';
import { AuthStore } from '../../../core/auth/auth.store';
import { TenantService } from '../../../core/tenant/tenant.service';
import { ConfigStore } from '../../../core/config/config.store';
import { ThemeService } from '../../../core/theme/theme.service';
import { LoggerService } from '../../../core/logger/logger.service';

@Component({
  selector: 'app-login',
  templateUrl: './login.page.html',
  styleUrls: ['./login.page.scss'],
  imports: [
    ReactiveFormsModule,
    IonContent, IonItem, IonInput, IonButton, IonSpinner, IonIcon,
  ],
})
export class LoginPage {
  protected authStore = inject(AuthStore);
  protected configStore = inject(ConfigStore);
  private authService = inject(AuthService);
  private tenantService = inject(TenantService);
  private themeService = inject(ThemeService);
  private logger = inject(LoggerService);
  private router = inject(Router);
  private fb = inject(FormBuilder);

  loginForm: FormGroup = this.fb.group({
    email: ['', [Validators.required, Validators.email]],
    password: ['', [Validators.required]],
  });

  constructor() {
    addIcons({ alertCircleOutline });
  }

  async onLogin(): Promise<void> {
    if (this.loginForm.invalid) return;

    const { email, password } = this.loginForm.value;
    this.authStore.setLoading(true);

    try {
      const user = await this.authService.login(email, password);
      this.authStore.setUser(user);

      // Resolve tenant from custom claims
      await this.tenantService.resolveFromAuthToken();

      // Apply theme from config
      this.themeService.applyTheme(this.configStore.theme());

      this.logger.info('Login flow completed, navigating to home');
      this.authStore.setLoading(false);
      this.router.navigate(['/home'], { replaceUrl: true });
    } catch (error: unknown) {
      const message = this.getErrorMessage(error);
      this.logger.error('Login failed', { error: message });
      this.authStore.setError(message);
    }
  }

  private getErrorMessage(error: unknown): string {
    const errorStr = String(error);
    if (errorStr.includes('auth/user-not-found') || errorStr.includes('auth/wrong-password')) {
      return 'Pogrešan email ili lozinka';
    }
    if (errorStr.includes('auth/invalid-credential')) {
      return 'Pogrešan email ili lozinka';
    }
    if (errorStr.includes('auth/too-many-requests')) {
      return 'Previše pokušaja. Pokušajte ponovo kasnije.';
    }
    if (errorStr.includes('auth/network-request-failed')) {
      return 'Nema internet konekcije';
    }
    return 'Greška prilikom prijave. Pokušajte ponovo.';
  }
}
