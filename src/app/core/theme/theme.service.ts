import { Injectable, inject } from '@angular/core';
import { ThemeConfig } from '../config/config.model';
import { LoggerService } from '../logger/logger.service';

@Injectable({ providedIn: 'root' })
export class ThemeService {
  private logger = inject(LoggerService);

  applyTheme(theme: ThemeConfig): void {
    const root = document.documentElement;

    root.style.setProperty('--ion-color-primary', theme.primaryColor);
    root.style.setProperty('--ion-color-primary-rgb', this.hexToRgb(theme.primaryColor));
    root.style.setProperty('--ion-color-primary-contrast', this.getContrast(theme.primaryColor));
    root.style.setProperty('--ion-color-primary-shade', this.shade(theme.primaryColor, -15));
    root.style.setProperty('--ion-color-primary-tint', this.tint(theme.primaryColor, 15));

    root.style.setProperty('--ion-color-secondary', theme.secondaryColor);
    root.style.setProperty('--ion-color-secondary-rgb', this.hexToRgb(theme.secondaryColor));
    root.style.setProperty('--ion-color-secondary-contrast', this.getContrast(theme.secondaryColor));
    root.style.setProperty('--ion-color-secondary-shade', this.shade(theme.secondaryColor, -15));
    root.style.setProperty('--ion-color-secondary-tint', this.tint(theme.secondaryColor, 15));

    root.style.setProperty('--ion-color-tertiary', theme.accentColor);
    root.style.setProperty('--ion-color-tertiary-rgb', this.hexToRgb(theme.accentColor));
    root.style.setProperty('--ion-color-tertiary-contrast', this.getContrast(theme.accentColor));
    root.style.setProperty('--ion-color-tertiary-shade', this.shade(theme.accentColor, -15));
    root.style.setProperty('--ion-color-tertiary-tint', this.tint(theme.accentColor, 15));

    root.style.setProperty('--app-menu-header-bg', theme.menuHeaderBackground);

    this.logger.info('Theme applied', { primary: theme.primaryColor, secondary: theme.secondaryColor });
  }

  private hexToRgb(hex: string): string {
    const r = parseInt(hex.slice(1, 3), 16);
    const g = parseInt(hex.slice(3, 5), 16);
    const b = parseInt(hex.slice(5, 7), 16);
    return `${r}, ${g}, ${b}`;
  }

  private getContrast(hex: string): string {
    const r = parseInt(hex.slice(1, 3), 16);
    const g = parseInt(hex.slice(3, 5), 16);
    const b = parseInt(hex.slice(5, 7), 16);
    const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
    return luminance > 0.5 ? '#000000' : '#ffffff';
  }

  private shade(hex: string, percent: number): string {
    return this.adjustColor(hex, percent);
  }

  private tint(hex: string, percent: number): string {
    return this.adjustColor(hex, percent);
  }

  private adjustColor(hex: string, percent: number): string {
    let r = parseInt(hex.slice(1, 3), 16);
    let g = parseInt(hex.slice(3, 5), 16);
    let b = parseInt(hex.slice(5, 7), 16);

    if (percent < 0) {
      r = Math.max(0, Math.round(r * (1 + percent / 100)));
      g = Math.max(0, Math.round(g * (1 + percent / 100)));
      b = Math.max(0, Math.round(b * (1 + percent / 100)));
    } else {
      r = Math.min(255, Math.round(r + (255 - r) * (percent / 100)));
      g = Math.min(255, Math.round(g + (255 - g) * (percent / 100)));
      b = Math.min(255, Math.round(b + (255 - b) * (percent / 100)));
    }

    return `#${r.toString(16).padStart(2, '0')}${g.toString(16).padStart(2, '0')}${b.toString(16).padStart(2, '0')}`;
  }
}
