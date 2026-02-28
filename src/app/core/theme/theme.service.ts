import { Injectable, inject, signal } from '@angular/core';
import { Preferences } from '@capacitor/preferences';
import { ThemeConfig } from '../config/config.model';
import { LoggerService } from '../logger/logger.service';

const DARK_MODE_KEY = 'dark_mode_preference';

@Injectable({ providedIn: 'root' })
export class ThemeService {
  private logger = inject(LoggerService);
  private currentTheme: ThemeConfig | null = null;

  readonly isDarkMode = signal(false);

  async initDarkMode(): Promise<void> {
    const isDark = await this.getStoredDarkMode();
    this.applyDarkClass(isDark);
  }

  async setDarkMode(isDark: boolean): Promise<void> {
    this.applyDarkClass(isDark);
    await Preferences.set({ key: DARK_MODE_KEY, value: isDark ? 'true' : 'false' });
    this.logger.info('Dark mode saved', { isDark });
  }

  applyTheme(theme: ThemeConfig): void {
    this.currentTheme = theme;
    this.setThemeProperties(theme);
  }

  private applyDarkClass(isDark: boolean): void {
    this.isDarkMode.set(isDark);
    // Class must be on <html> because dark.class.css uses .ion-palette-dark.md / .ion-palette-dark.ios
    // and Ionic puts .md/.ios on <html>
    document.documentElement.classList.toggle('ion-palette-dark', isDark);

    // Re-apply custom theme colors so they override the dark palette defaults
    if (this.currentTheme) {
      this.setThemeProperties(this.currentTheme);
    }
  }

  private setThemeProperties(theme: ThemeConfig): void {
    // Inline styles on <html> override .ion-palette-dark class styles on same element
    const el = document.documentElement;

    el.style.setProperty('--ion-color-primary', theme.primaryColor);
    el.style.setProperty('--ion-color-primary-rgb', this.hexToRgb(theme.primaryColor));
    el.style.setProperty('--ion-color-primary-contrast', this.getContrast(theme.primaryColor));
    el.style.setProperty('--ion-color-primary-shade', this.shade(theme.primaryColor, -15));
    el.style.setProperty('--ion-color-primary-tint', this.tint(theme.primaryColor, 15));

    el.style.setProperty('--ion-color-secondary', theme.secondaryColor);
    el.style.setProperty('--ion-color-secondary-rgb', this.hexToRgb(theme.secondaryColor));
    el.style.setProperty('--ion-color-secondary-contrast', this.getContrast(theme.secondaryColor));
    el.style.setProperty('--ion-color-secondary-shade', this.shade(theme.secondaryColor, -15));
    el.style.setProperty('--ion-color-secondary-tint', this.tint(theme.secondaryColor, 15));

    el.style.setProperty('--ion-color-tertiary', theme.accentColor);
    el.style.setProperty('--ion-color-tertiary-rgb', this.hexToRgb(theme.accentColor));
    el.style.setProperty('--ion-color-tertiary-contrast', this.getContrast(theme.accentColor));
    el.style.setProperty('--ion-color-tertiary-shade', this.shade(theme.accentColor, -15));
    el.style.setProperty('--ion-color-tertiary-tint', this.tint(theme.accentColor, 15));

    el.style.setProperty('--app-menu-header-bg', theme.menuHeaderBackground);

    this.logger.info('Theme applied', { primary: theme.primaryColor, secondary: theme.secondaryColor });
  }

  private async getStoredDarkMode(): Promise<boolean> {
    try {
      const { value } = await Preferences.get({ key: DARK_MODE_KEY });
      return value === 'true';
    } catch {
      return false;
    }
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
