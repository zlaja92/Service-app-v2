import { AfterViewInit, Component, inject } from '@angular/core';
import { IonRouterOutlet } from '@ionic/angular/standalone';
import { MenuComponent } from '../menu/menu.component';
import { ConfigStore } from '../../core/config/config.store';
import { AppNoticeService } from '../../core/app-notice/app-notice.service';

@Component({
  selector: 'app-shell',
  template: `
    <app-menu />
    <ion-router-outlet id="main-content" />
  `,
  imports: [IonRouterOutlet, MenuComponent],
})
export class ShellComponent implements AfterViewInit {
  private configStore = inject(ConfigStore);
  private appNotice = inject(AppNoticeService);

  /**
   * Runs the app-entry notices once the authenticated UI is rendered (config is
   * already loaded by the session bootstrap). Doing this here — not in the
   * session bootstrap — ensures the overlay host exists so alerts actually show,
   * including on a restored session at startup.
   */
  async ngAfterViewInit(): Promise<void> {
    const business = this.configStore.business();
    const blocked = await this.appNotice.enforceMinVersion(business?.minAppVersion);
    if (blocked) return;
    await this.appNotice.showStartInfo(business?.startInfo);
  }
}
