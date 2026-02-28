import { Directive, effect, inject, input, TemplateRef, ViewContainerRef } from '@angular/core';
import { FeatureFlags } from '../../core/config/config.model';
import { ConfigStore } from '../../core/config/config.store';

@Directive({
  selector: '[appFeatureFlag]',
  standalone: true,
})
export class FeatureFlagDirective {
  appFeatureFlag = input.required<keyof FeatureFlags>();

  private templateRef = inject(TemplateRef<unknown>);
  private viewContainer = inject(ViewContainerRef);
  private configStore = inject(ConfigStore);
  private isRendered = false;

  constructor() {
    effect(() => {
      const featureName = this.appFeatureFlag();
      const enabled = this.configStore.isFeatureEnabled(featureName);

      if (enabled && !this.isRendered) {
        this.viewContainer.createEmbeddedView(this.templateRef);
        this.isRendered = true;
      } else if (!enabled && this.isRendered) {
        this.viewContainer.clear();
        this.isRendered = false;
      }
    });
  }
}
