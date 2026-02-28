import { Component, inject } from '@angular/core';
import { Router } from '@angular/router';
import {
  IonMenu, IonHeader, IonToolbar, IonTitle, IonContent,
  IonList, IonItem, IonIcon, IonLabel, IonMenuToggle, IonToggle,
  MenuController,
} from '@ionic/angular/standalone';
import { addIcons } from 'ionicons';
import { homeOutline, logOutOutline, bugOutline, timeOutline, moonOutline } from 'ionicons/icons';
import { FeatureFlagDirective } from '../../shared/directives/feature-flag.directive';
import { AuthService } from '../../core/auth/auth.service';
import { AuthStore } from '../../core/auth/auth.store';
import { TenantStore } from '../../core/tenant/tenant.store';
import { ConfigStore } from '../../core/config/config.store';
import { ThemeService } from '../../core/theme/theme.service';

@Component({
  selector: 'app-menu',
  templateUrl: './menu.component.html',
  styleUrls: ['./menu.component.scss'],
  imports: [
    IonMenu, IonHeader, IonToolbar, IonTitle, IonContent,
    IonList, IonItem, IonIcon, IonLabel, IonMenuToggle, IonToggle,
    FeatureFlagDirective,
  ],
})
export class MenuComponent {
  protected authStore = inject(AuthStore);
  protected tenantStore = inject(TenantStore);
  protected configStore = inject(ConfigStore);
  protected themeService = inject(ThemeService);
  private authService = inject(AuthService);
  private router = inject(Router);
  private menuCtrl = inject(MenuController);

  constructor() {
    addIcons({ homeOutline, logOutOutline, bugOutline, timeOutline, moonOutline });
  }

  navigateTo(path: string): void {
    this.router.navigate([path]);
  }

  onDarkModeToggle(event: CustomEvent): void {
    this.themeService.setDarkMode(event.detail.checked);
  }

  async logout(): Promise<void> {
    await this.menuCtrl.close();
    await this.authService.logout();
    this.authStore.clearUser();
    this.router.navigate(['/login']);
  }
}
