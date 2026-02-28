import { Component, inject } from '@angular/core';
import { Router } from '@angular/router';
import {
  IonMenu, IonHeader, IonToolbar, IonTitle, IonContent,
  IonList, IonItem, IonIcon, IonLabel, IonMenuToggle,
  MenuController,
} from '@ionic/angular/standalone';
import { addIcons } from 'ionicons';
import { homeOutline, logOutOutline, bugOutline, timeOutline } from 'ionicons/icons';
import { FeatureFlagDirective } from '../../shared/directives/feature-flag.directive';
import { AuthService } from '../../core/auth/auth.service';
import { AuthStore } from '../../core/auth/auth.store';
import { TenantStore } from '../../core/tenant/tenant.store';
import { ConfigStore } from '../../core/config/config.store';

@Component({
  selector: 'app-menu',
  template: `
    <ion-menu contentId="main-content" type="overlay">
      <ion-header>
        <ion-toolbar [style.--background]="configStore.theme().menuHeaderBackground" color="primary">
          <ion-title>{{ configStore.appTitle() }}</ion-title>
        </ion-toolbar>
      </ion-header>
      <ion-content>
        <ion-list>
          <ion-menu-toggle auto-hide="false">
            <ion-item button (click)="navigateTo('/home')">
              <ion-icon name="home-outline" slot="start" />
              <ion-label>Početna</ion-label>
            </ion-item>
          </ion-menu-toggle>

          <ion-menu-toggle auto-hide="false" *appFeatureFlag="'servicerHistory'">
            <ion-item button (click)="navigateTo('/servicer-history')">
              <ion-icon name="time-outline" slot="start" />
              <ion-label>Moje intervencije</ion-label>
            </ion-item>
          </ion-menu-toggle>

          <ion-menu-toggle auto-hide="false" *appFeatureFlag="'bugReport'">
            <ion-item button (click)="navigateTo('/bugs')">
              <ion-icon name="bug-outline" slot="start" />
              <ion-label>Prijavi grešku</ion-label>
            </ion-item>
          </ion-menu-toggle>

          <ion-menu-toggle auto-hide="false">
            <ion-item button (click)="logout()" lines="none">
              <ion-icon name="log-out-outline" slot="start" />
              <ion-label>Odjavi se</ion-label>
            </ion-item>
          </ion-menu-toggle>
        </ion-list>

        <div class="menu-footer">
          @if (tenantStore.tenantId(); as tid) {
            <p>Tenant: {{ tid }}</p>
          }
          <p>{{ authStore.userEmail() }}</p>
        </div>
      </ion-content>
    </ion-menu>
  `,
  styles: [`
    .menu-footer {
      position: absolute;
      bottom: 16px;
      left: 16px;
      right: 16px;
      font-size: 0.75rem;
      color: var(--ion-color-medium);
    }
    .menu-footer p {
      margin: 2px 0;
    }
  `],
  imports: [
    IonMenu, IonHeader, IonToolbar, IonTitle, IonContent,
    IonList, IonItem, IonIcon, IonLabel, IonMenuToggle,
    FeatureFlagDirective,
  ],
})
export class MenuComponent {
  protected authStore = inject(AuthStore);
  protected tenantStore = inject(TenantStore);
  protected configStore = inject(ConfigStore);
  private authService = inject(AuthService);
  private router = inject(Router);
  private menuCtrl = inject(MenuController);

  constructor() {
    addIcons({ homeOutline, logOutOutline, bugOutline, timeOutline });
  }

  navigateTo(path: string): void {
    this.router.navigate([path]);
  }

  async logout(): Promise<void> {
    await this.menuCtrl.close();
    await this.authService.logout();
    this.authStore.clearUser();
    this.router.navigate(['/login']);
  }
}
