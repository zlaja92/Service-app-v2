import { TestBed } from '@angular/core/testing';
import { ThemeService } from './theme.service';
import { ThemeConfig, getDefaultTheme } from '../config/config.model';
import { LoggerService } from '../logger/logger.service';
import { PreferencesService } from '../storage/preferences.service';

describe('ThemeService', () => {
  let service: ThemeService;
  let mockLogger: jasmine.SpyObj<LoggerService>;
  let mockPreferences: jasmine.SpyObj<PreferencesService>;

  const testTheme: ThemeConfig = {
    primaryColor: '#B71C1C',
    secondaryColor: '#1565C0',
    accentColor: '#FFC107',
    logoUrl: '',
    appTitle: 'Test App',
    menuHeaderBackground: '#B71C1C',
  };

  beforeEach(() => {
    mockLogger = jasmine.createSpyObj('LoggerService', ['debug', 'info', 'warn', 'error']);
    mockPreferences = jasmine.createSpyObj('PreferencesService', ['get', 'set', 'remove', 'clear']);

    mockPreferences.get.and.resolveTo(null);
    mockPreferences.set.and.resolveTo();

    TestBed.configureTestingModule({
      providers: [
        ThemeService,
        { provide: LoggerService, useValue: mockLogger },
        { provide: PreferencesService, useValue: mockPreferences },
      ],
    });

    service = TestBed.inject(ThemeService);

    const el = document.documentElement;
    el.classList.remove('ion-palette-dark');
    el.style.removeProperty('--ion-color-primary');
    el.style.removeProperty('--ion-color-secondary');
    el.style.removeProperty('--ion-color-tertiary');
    el.style.removeProperty('--app-menu-header-bg');
  });

  describe('applyTheme()', () => {
    it('should set CSS custom properties on document.documentElement', () => {
      service.applyTheme(testTheme);

      const el = document.documentElement;
      expect(el.style.getPropertyValue('--ion-color-primary')).toBe('#B71C1C');
      expect(el.style.getPropertyValue('--ion-color-secondary')).toBe('#1565C0');
      expect(el.style.getPropertyValue('--ion-color-tertiary')).toBe('#FFC107');
      expect(el.style.getPropertyValue('--app-menu-header-bg')).toBe('#B71C1C');
    });

    it('should set RGB variants for primary color', () => {
      service.applyTheme(testTheme);
      expect(document.documentElement.style.getPropertyValue('--ion-color-primary-rgb')).toBe('183, 28, 28');
    });

    it('should set contrast color (white for dark primary)', () => {
      service.applyTheme(testTheme);
      expect(document.documentElement.style.getPropertyValue('--ion-color-primary-contrast')).toBe('#ffffff');
    });

    it('should set shade and tint variants', () => {
      service.applyTheme(testTheme);

      const shade = document.documentElement.style.getPropertyValue('--ion-color-primary-shade');
      const tint = document.documentElement.style.getPropertyValue('--ion-color-primary-tint');

      expect(shade).toBeTruthy();
      expect(tint).toBeTruthy();
      expect(shade).not.toBe(testTheme.primaryColor);
      expect(tint).not.toBe(testTheme.primaryColor);
    });

    it('should log theme applied message', () => {
      service.applyTheme(testTheme);
      expect(mockLogger.info).toHaveBeenCalledWith('Theme applied', {
        primary: '#B71C1C',
        secondary: '#1565C0',
      });
    });
  });

  describe('initDarkMode()', () => {
    it('should apply dark mode when stored value is true', async () => {
      mockPreferences.get.and.resolveTo('true');

      await service.initDarkMode();

      expect(service.isDarkMode()).toBe(true);
      expect(document.documentElement.classList.contains('ion-palette-dark')).toBe(true);
    });

    it('should not apply dark mode when stored value is false', async () => {
      mockPreferences.get.and.resolveTo('false');

      await service.initDarkMode();

      expect(service.isDarkMode()).toBe(false);
      expect(document.documentElement.classList.contains('ion-palette-dark')).toBe(false);
    });

    it('should not apply dark mode when stored value is null', async () => {
      mockPreferences.get.and.resolveTo(null);

      await service.initDarkMode();

      expect(service.isDarkMode()).toBe(false);
    });

    it('should default to false when Preferences.get() throws', async () => {
      mockPreferences.get.and.rejectWith(new Error('Preferences unavailable'));

      await service.initDarkMode();

      expect(service.isDarkMode()).toBe(false);
      expect(document.documentElement.classList.contains('ion-palette-dark')).toBe(false);
    });
  });

  describe('setDarkMode()', () => {
    it('should add dark class and save to Preferences when true', async () => {
      await service.setDarkMode(true);

      expect(service.isDarkMode()).toBe(true);
      expect(document.documentElement.classList.contains('ion-palette-dark')).toBe(true);
      expect(mockPreferences.set).toHaveBeenCalledWith('dark_mode_preference', 'true');
    });

    it('should remove dark class and save to Preferences when false', async () => {
      await service.setDarkMode(true);
      await service.setDarkMode(false);

      expect(service.isDarkMode()).toBe(false);
      expect(document.documentElement.classList.contains('ion-palette-dark')).toBe(false);
      expect(mockPreferences.set).toHaveBeenCalledWith('dark_mode_preference', 'false');
    });

    it('should re-apply custom theme after toggling dark mode', async () => {
      const customTheme: ThemeConfig = { ...getDefaultTheme(), primaryColor: '#00FF00' };

      service.applyTheme(customTheme);
      await service.setDarkMode(true);

      expect(document.documentElement.style.getPropertyValue('--ion-color-primary')).toBe('#00FF00');
    });

    it('should NOT re-apply theme when no theme was set previously', async () => {
      await service.setDarkMode(true);

      expect(document.documentElement.style.getPropertyValue('--ion-color-primary')).toBe('');
    });
  });

  describe('color utility functions (tested indirectly via applyTheme)', () => {
    it('should produce correct RGB for white', () => {
      service.applyTheme({ ...getDefaultTheme(), primaryColor: '#FFFFFF' });
      expect(document.documentElement.style.getPropertyValue('--ion-color-primary-rgb')).toBe('255, 255, 255');
    });

    it('should return #000000 contrast for light colors', () => {
      service.applyTheme({ ...getDefaultTheme(), primaryColor: '#FFFFFF' });
      expect(document.documentElement.style.getPropertyValue('--ion-color-primary-contrast')).toBe('#000000');
    });

    it('should return #ffffff contrast for dark colors', () => {
      service.applyTheme({ ...getDefaultTheme(), primaryColor: '#000000' });
      expect(document.documentElement.style.getPropertyValue('--ion-color-primary-contrast')).toBe('#ffffff');
    });

    it('should produce darker shade than original', () => {
      service.applyTheme(testTheme);
      const shade = document.documentElement.style.getPropertyValue('--ion-color-primary-shade');
      const r = parseInt(shade.slice(1, 3), 16);
      expect(r).toBeLessThan(183);
    });

    it('should produce lighter tint than original', () => {
      service.applyTheme(testTheme);
      const tint = document.documentElement.style.getPropertyValue('--ion-color-primary-tint');
      const r = parseInt(tint.slice(1, 3), 16);
      expect(r).toBeGreaterThan(183);
    });

    it('should handle black color (#000000) for shade — stays #000000', () => {
      service.applyTheme({ ...getDefaultTheme(), primaryColor: '#000000' });
      const shade = document.documentElement.style.getPropertyValue('--ion-color-primary-shade');
      expect(shade).toBe('#000000');
    });
  });
});
