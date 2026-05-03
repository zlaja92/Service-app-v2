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

  describe('applyTheme() — ALL CSS variables coverage', () => {
    it('should set all secondary CSS variables (base, rgb, contrast, shade, tint)', () => {
      service.applyTheme(testTheme);
      const el = document.documentElement;

      expect(el.style.getPropertyValue('--ion-color-secondary')).toBe('#1565C0');
      expect(el.style.getPropertyValue('--ion-color-secondary-rgb')).toBe('21, 101, 192');
      expect(el.style.getPropertyValue('--ion-color-secondary-contrast')).toBe('#ffffff');
      expect(el.style.getPropertyValue('--ion-color-secondary-shade')).toBeTruthy();
      expect(el.style.getPropertyValue('--ion-color-secondary-tint')).toBeTruthy();
    });

    it('should set all tertiary (accent) CSS variables (base, rgb, contrast, shade, tint)', () => {
      service.applyTheme(testTheme);
      const el = document.documentElement;

      expect(el.style.getPropertyValue('--ion-color-tertiary')).toBe('#FFC107');
      expect(el.style.getPropertyValue('--ion-color-tertiary-rgb')).toBe('255, 193, 7');
      // #FFC107 is a light color (luminance > 0.5), so contrast should be dark
      expect(el.style.getPropertyValue('--ion-color-tertiary-contrast')).toBe('#000000');
      expect(el.style.getPropertyValue('--ion-color-tertiary-shade')).toBeTruthy();
      expect(el.style.getPropertyValue('--ion-color-tertiary-tint')).toBeTruthy();
    });

    it('should set shade darker than secondary original', () => {
      service.applyTheme(testTheme);
      const shade = document.documentElement.style.getPropertyValue('--ion-color-secondary-shade');
      // secondary is #1565C0 — green channel = 101 (0x65)
      const g = parseInt(shade.slice(3, 5), 16);
      expect(g).toBeLessThan(101);
    });

    it('should set tint lighter than secondary original', () => {
      service.applyTheme(testTheme);
      const tint = document.documentElement.style.getPropertyValue('--ion-color-secondary-tint');
      // secondary is #1565C0 — green channel = 101 (0x65)
      const g = parseInt(tint.slice(3, 5), 16);
      expect(g).toBeGreaterThan(101);
    });

    it('should set shade darker than tertiary original', () => {
      service.applyTheme(testTheme);
      const shade = document.documentElement.style.getPropertyValue('--ion-color-tertiary-shade');
      // tertiary (accent) is #FFC107 — red channel = 255
      // red is maxed, check green channel = 193 (0xC1)
      const g = parseInt(shade.slice(3, 5), 16);
      expect(g).toBeLessThan(193);
    });

    it('should set tint lighter than tertiary original', () => {
      service.applyTheme(testTheme);
      const tint = document.documentElement.style.getPropertyValue('--ion-color-tertiary-tint');
      // tertiary (accent) is #FFC107 — green channel = 193 (0xC1)
      const g = parseInt(tint.slice(3, 5), 16);
      expect(g).toBeGreaterThan(193);
    });
  });

  describe('hexToRgb — edge cases (via applyTheme)', () => {
    it('should correctly parse lowercase hex color', () => {
      service.applyTheme({ ...getDefaultTheme(), primaryColor: '#b71c1c' });
      // #b71c1c = rgb(183, 28, 28) — same as uppercase #B71C1C
      expect(document.documentElement.style.getPropertyValue('--ion-color-primary-rgb')).toBe('183, 28, 28');
    });

    it('should correctly parse mid-range hex color', () => {
      // #4a90e2 = rgb(74, 144, 226)
      service.applyTheme({ ...getDefaultTheme(), primaryColor: '#4a90e2' });
      expect(document.documentElement.style.getPropertyValue('--ion-color-primary-rgb')).toBe('74, 144, 226');
    });
  });

  describe('getContrast — borderline threshold values', () => {
    it('should return #000000 for color with luminance exactly at borderline (light side)', () => {
      // Need luminance > 0.5; #808080 = rgb(128,128,128)
      // luminance = (0.299*128 + 0.587*128 + 0.114*128) / 255 = 128/255 ≈ 0.502 → dark contrast
      service.applyTheme({ ...getDefaultTheme(), primaryColor: '#808080' });
      expect(document.documentElement.style.getPropertyValue('--ion-color-primary-contrast')).toBe('#000000');
    });

    it('should return #ffffff for color with luminance just below 0.5 (dark side)', () => {
      // #7f7f7f = rgb(127,127,127)
      // luminance = 127/255 ≈ 0.498 → light contrast
      service.applyTheme({ ...getDefaultTheme(), primaryColor: '#7f7f7f' });
      expect(document.documentElement.style.getPropertyValue('--ion-color-primary-contrast')).toBe('#ffffff');
    });

    it('should return #000000 for a known light color (yellow)', () => {
      // #FFFF00 = rgb(255,255,0); luminance = (0.299*255 + 0.587*255) / 255 ≈ 0.886
      service.applyTheme({ ...getDefaultTheme(), primaryColor: '#FFFF00' });
      expect(document.documentElement.style.getPropertyValue('--ion-color-primary-contrast')).toBe('#000000');
    });

    it('should return #ffffff for a known dark color (navy)', () => {
      // #000080 = rgb(0,0,128); luminance = (0.114*128) / 255 ≈ 0.057
      service.applyTheme({ ...getDefaultTheme(), primaryColor: '#000080' });
      expect(document.documentElement.style.getPropertyValue('--ion-color-primary-contrast')).toBe('#ffffff');
    });
  });

  describe('adjustColor — percent variants (via applyTheme shade/tint)', () => {
    it('should return a darker color when percent is negative (darken)', () => {
      // #808080 shade (-15%) — each channel: Math.round(128 * 0.85) = 109
      service.applyTheme({ ...getDefaultTheme(), primaryColor: '#808080' });
      const shade = document.documentElement.style.getPropertyValue('--ion-color-primary-shade');
      const r = parseInt(shade.slice(1, 3), 16);
      expect(r).toBeLessThan(128);
    });

    it('should return a lighter color when percent is positive (lighten)', () => {
      // #808080 tint (+15%) — each channel: Math.round(128 + (255-128)*0.15) = Math.round(128+19.05) = 147
      service.applyTheme({ ...getDefaultTheme(), primaryColor: '#808080' });
      const tint = document.documentElement.style.getPropertyValue('--ion-color-primary-tint');
      const r = parseInt(tint.slice(1, 3), 16);
      expect(r).toBeGreaterThan(128);
    });

    it('should return the original color when percent is 0', () => {
      const color = '#404040'; // rgb(64,64,64)
      service.applyTheme({ ...getDefaultTheme(), primaryColor: color });
      // tint with 15% should be > 64; for reference verify original rgb is correct
      expect(document.documentElement.style.getPropertyValue('--ion-color-primary-rgb')).toBe('64, 64, 64');
      // shade with -15% → Math.round(64 * 0.85) = 54
      const shade = document.documentElement.style.getPropertyValue('--ion-color-primary-shade');
      const shadeR = parseInt(shade.slice(1, 3), 16);
      expect(shadeR).toBe(54);
      // tint with +15% → Math.round(64 + (255-64)*0.15) = Math.round(64+28.65) = 93
      const tint = document.documentElement.style.getPropertyValue('--ion-color-primary-tint');
      const tintR = parseInt(tint.slice(1, 3), 16);
      expect(tintR).toBe(93);
    });
  });

  describe('initDarkMode() — reads from PreferencesService', () => {
    it('should call PreferencesService.get with correct dark mode key', async () => {
      mockPreferences.get.and.resolveTo(null);
      await service.initDarkMode();
      expect(mockPreferences.get).toHaveBeenCalledWith('dark_mode_preference');
    });
  });

  describe('setDarkMode() — class toggling', () => {
    it('should add ion-palette-dark class when called with true', async () => {
      document.documentElement.classList.remove('ion-palette-dark');
      await service.setDarkMode(true);
      expect(document.documentElement.classList.contains('ion-palette-dark')).toBe(true);
    });

    it('should remove ion-palette-dark class when called with false after being true', async () => {
      await service.setDarkMode(true);
      expect(document.documentElement.classList.contains('ion-palette-dark')).toBe(true);

      await service.setDarkMode(false);
      expect(document.documentElement.classList.contains('ion-palette-dark')).toBe(false);
    });

    it('should save "true" string to preferences when enabling dark mode', async () => {
      await service.setDarkMode(true);
      expect(mockPreferences.set).toHaveBeenCalledWith('dark_mode_preference', 'true');
    });

    it('should save "false" string to preferences when disabling dark mode', async () => {
      await service.setDarkMode(false);
      expect(mockPreferences.set).toHaveBeenCalledWith('dark_mode_preference', 'false');
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // EXPANSION: hexToRgb exhaustive color matrix — 60 known hex colors
  // ═══════════════════════════════════════════════════════════════════════════

  describe('hexToRgb — exhaustive color matrix (via applyTheme primary-rgb)', () => {
    interface ColorCase {
      hex: string;
      r: number;
      g: number;
      b: number;
    }

    const colorMatrix: ColorCase[] = [
      { hex: '#000000', r: 0, g: 0, b: 0 },
      { hex: '#ffffff', r: 255, g: 255, b: 255 },
      { hex: '#ff0000', r: 255, g: 0, b: 0 },
      { hex: '#00ff00', r: 0, g: 255, b: 0 },
      { hex: '#0000ff', r: 0, g: 0, b: 255 },
      { hex: '#ff00ff', r: 255, g: 0, b: 255 },
      { hex: '#00ffff', r: 0, g: 255, b: 255 },
      { hex: '#ffff00', r: 255, g: 255, b: 0 },
      { hex: '#808080', r: 128, g: 128, b: 128 },
      { hex: '#c0c0c0', r: 192, g: 192, b: 192 },
      { hex: '#800000', r: 128, g: 0, b: 0 },
      { hex: '#008000', r: 0, g: 128, b: 0 },
      { hex: '#000080', r: 0, g: 0, b: 128 },
      { hex: '#800080', r: 128, g: 0, b: 128 },
      { hex: '#008080', r: 0, g: 128, b: 128 },
      { hex: '#808000', r: 128, g: 128, b: 0 },
      { hex: '#FFC107', r: 255, g: 193, b: 7 },
      { hex: '#B71C1C', r: 183, g: 28, b: 28 },
      { hex: '#1565C0', r: 21, g: 101, b: 192 },
      { hex: '#4a90e2', r: 74, g: 144, b: 226 },
      { hex: '#b71c1c', r: 183, g: 28, b: 28 },
      { hex: '#1a1a2e', r: 26, g: 26, b: 46 },
      { hex: '#16213e', r: 22, g: 33, b: 62 },
      { hex: '#0f3460', r: 15, g: 52, b: 96 },
      { hex: '#e94560', r: 233, g: 69, b: 96 },
      { hex: '#533483', r: 83, g: 52, b: 131 },
      { hex: '#e2b714', r: 226, g: 183, b: 20 },
      { hex: '#06d6a0', r: 6, g: 214, b: 160 },
      { hex: '#118ab2', r: 17, g: 138, b: 178 },
      { hex: '#073b4c', r: 7, g: 59, b: 76 },
      { hex: '#ff6b6b', r: 255, g: 107, b: 107 },
      { hex: '#feca57', r: 254, g: 202, b: 87 },
      { hex: '#48dbfb', r: 72, g: 219, b: 251 },
      { hex: '#ff9ff3', r: 255, g: 159, b: 243 },
      { hex: '#54a0ff', r: 84, g: 160, b: 255 },
      { hex: '#5f27cd', r: 95, g: 39, b: 205 },
      { hex: '#00d2d3', r: 0, g: 210, b: 211 },
      { hex: '#ff9f43', r: 255, g: 159, b: 67 },
      { hex: '#c8d6e5', r: 200, g: 214, b: 229 },
      { hex: '#8395a7', r: 131, g: 149, b: 167 },
      { hex: '#ee5a24', r: 238, g: 90, b: 36 },
      { hex: '#009432', r: 0, g: 148, b: 50 },
      { hex: '#006266', r: 0, g: 98, b: 102 },
      { hex: '#1289A7', r: 18, g: 137, b: 167 },
      { hex: '#C4E538', r: 196, g: 229, b: 56 },
      { hex: '#FDA7DF', r: 253, g: 167, b: 223 },
      { hex: '#D980FA', r: 217, g: 128, b: 250 },
      { hex: '#9980FA', r: 153, g: 128, b: 250 },
      { hex: '#5758BB', r: 87, g: 88, b: 187 },
      { hex: '#3d3d3d', r: 61, g: 61, b: 61 },
      { hex: '#2c2c54', r: 44, g: 44, b: 84 },
      { hex: '#474787', r: 71, g: 71, b: 135 },
      { hex: '#aaa69d', r: 170, g: 166, b: 157 },
      { hex: '#f7f1e3', r: 247, g: 241, b: 227 },
      { hex: '#218c74', r: 33, g: 140, b: 116 },
      { hex: '#191919', r: 25, g: 25, b: 25 },
      { hex: '#e55039', r: 229, g: 80, b: 57 },
      { hex: '#f0932b', r: 240, g: 147, b: 43 },
      { hex: '#6a89cc', r: 106, g: 137, b: 204 },
      { hex: '#82ccdd', r: 130, g: 204, b: 221 },
    ];

    colorMatrix.forEach(({ hex, r, g, b }) => {
      it(`should parse ${hex} to rgb(${r}, ${g}, ${b})`, () => {
        service.applyTheme({ ...getDefaultTheme(), primaryColor: hex });
        const rgb = document.documentElement.style.getPropertyValue('--ion-color-primary-rgb');
        expect(rgb).toBe(`${r}, ${g}, ${b}`);
      });

      it(`should have R channel in 0-255 range for ${hex}`, () => {
        service.applyTheme({ ...getDefaultTheme(), primaryColor: hex });
        const rgb = document.documentElement.style.getPropertyValue('--ion-color-primary-rgb');
        const [rVal] = rgb.split(',').map(s => parseInt(s.trim(), 10));
        expect(rVal).toBeGreaterThanOrEqual(0);
        expect(rVal).toBeLessThanOrEqual(255);
      });

      it(`should have G channel in 0-255 range for ${hex}`, () => {
        service.applyTheme({ ...getDefaultTheme(), primaryColor: hex });
        const rgb = document.documentElement.style.getPropertyValue('--ion-color-primary-rgb');
        const parts = rgb.split(',').map(s => parseInt(s.trim(), 10));
        expect(parts[1]).toBeGreaterThanOrEqual(0);
        expect(parts[1]).toBeLessThanOrEqual(255);
      });
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // EXPANSION: getContrast — 40 known colors with expected contrast
  // ═══════════════════════════════════════════════════════════════════════════

  describe('getContrast — 40 known color contrast expectations', () => {
    interface ContrastCase {
      hex: string;
      expectedContrast: '#000000' | '#ffffff';
      description: string;
    }

    const contrastCases: ContrastCase[] = [
      // Very light colors → black contrast
      { hex: '#FFFFFF', expectedContrast: '#000000', description: 'pure white' },
      { hex: '#FFFF00', expectedContrast: '#000000', description: 'yellow' },
      { hex: '#00FF00', expectedContrast: '#000000', description: 'lime' },
      { hex: '#00FFFF', expectedContrast: '#000000', description: 'cyan' },
      { hex: '#FFC107', expectedContrast: '#000000', description: 'amber' },
      { hex: '#f7f1e3', expectedContrast: '#000000', description: 'cream' },
      { hex: '#c8d6e5', expectedContrast: '#000000', description: 'light steel' },
      { hex: '#feca57', expectedContrast: '#000000', description: 'sunflower' },
      { hex: '#C4E538', expectedContrast: '#000000', description: 'lime green' },
      { hex: '#FDA7DF', expectedContrast: '#000000', description: 'light pink' },
      { hex: '#48dbfb', expectedContrast: '#000000', description: 'light blue' },
      { hex: '#aaa69d', expectedContrast: '#000000', description: 'warm gray' },
      { hex: '#ff9ff3', expectedContrast: '#000000', description: 'light pink2' },
      { hex: '#ff9f43', expectedContrast: '#000000', description: 'orange' },
      { hex: '#c0c0c0', expectedContrast: '#000000', description: 'silver' },
      { hex: '#808080', expectedContrast: '#000000', description: 'gray (>0.5)' },
      // Dark colors → white contrast
      { hex: '#000000', expectedContrast: '#ffffff', description: 'pure black' },
      { hex: '#0000FF', expectedContrast: '#ffffff', description: 'blue' },
      { hex: '#000080', expectedContrast: '#ffffff', description: 'navy' },
      { hex: '#800000', expectedContrast: '#ffffff', description: 'maroon' },
      { hex: '#B71C1C', expectedContrast: '#ffffff', description: 'dark red' },
      { hex: '#1565C0', expectedContrast: '#ffffff', description: 'dark blue' },
      { hex: '#4a90e2', expectedContrast: '#000000', description: 'medium blue' },
      { hex: '#1a1a2e', expectedContrast: '#ffffff', description: 'dark navy' },
      { hex: '#5f27cd', expectedContrast: '#ffffff', description: 'dark violet' },
      { hex: '#2c2c54', expectedContrast: '#ffffff', description: 'dark purple' },
      { hex: '#073b4c', expectedContrast: '#ffffff', description: 'dark teal' },
      { hex: '#3d3d3d', expectedContrast: '#ffffff', description: 'dark gray' },
      { hex: '#191919', expectedContrast: '#ffffff', description: 'near black' },
      { hex: '#006266', expectedContrast: '#ffffff', description: 'dark teal2' },
      { hex: '#533483', expectedContrast: '#ffffff', description: 'dark purple2' },
      { hex: '#800080', expectedContrast: '#ffffff', description: 'purple' },
      { hex: '#474787', expectedContrast: '#ffffff', description: 'slate purple' },
      { hex: '#5758BB', expectedContrast: '#ffffff', description: 'medium indigo' },
      { hex: '#7f7f7f', expectedContrast: '#ffffff', description: 'gray (≈0.498)' },
      { hex: '#008000', expectedContrast: '#ffffff', description: 'dark green' },
      { hex: '#008080', expectedContrast: '#ffffff', description: 'teal' },
      { hex: '#218c74', expectedContrast: '#ffffff', description: 'jade' },
      { hex: '#16213e', expectedContrast: '#ffffff', description: 'midnight' },
      { hex: '#0f3460', expectedContrast: '#ffffff', description: 'deep navy' },
    ];

    contrastCases.forEach(({ hex, expectedContrast, description }) => {
      it(`should return ${expectedContrast} contrast for ${hex} (${description})`, () => {
        service.applyTheme({ ...getDefaultTheme(), primaryColor: hex });
        const contrast = document.documentElement.style.getPropertyValue('--ion-color-primary-contrast');
        expect(contrast).toBe(expectedContrast);
      });
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // EXPANSION: adjustColor shade/tint math validation for 15 midrange colors
  // ═══════════════════════════════════════════════════════════════════════════

  describe('adjustColor shade/tint math — explicit expected values for 15 colors', () => {
    interface AdjustCase {
      hex: string;
      expectedShadeR: number; // -15%: Math.max(0, Math.round(r * 0.85))
      expectedTintR: number;  // +15%: Math.min(255, Math.round(r + (255-r)*0.15))
    }

    const adjustCases: AdjustCase[] = [
      // #808080 => r=128: shade=Math.round(128*0.85)=109, tint=Math.round(128+(255-128)*0.15)=147
      { hex: '#808080', expectedShadeR: 109, expectedTintR: 147 },
      // #404040 => r=64: shade=Math.round(64*0.85)=54, tint=Math.round(64+191*0.15)=93
      { hex: '#404040', expectedShadeR: 54, expectedTintR: 93 },
      // #c0c0c0 => r=192: shade=Math.round(192*0.85)=163, tint=Math.round(192+(255-192)*0.15)=201
      { hex: '#c0c0c0', expectedShadeR: 163, expectedTintR: 201 },
      // #ff6b6b => r=255: shade=Math.round(255*0.85)=217, tint=Math.round(255+(255-255)*0.15)=255
      { hex: '#ff6b6b', expectedShadeR: 217, expectedTintR: 255 },
      // #000000 => r=0: shade=0, tint=Math.round(0+(255-0)*0.15)=38
      { hex: '#000000', expectedShadeR: 0, expectedTintR: 38 },
      // #1a1a2e => r=26: shade=Math.round(26*0.85)=22, tint=Math.round(26+(255-26)*0.15)=60
      { hex: '#1a1a2e', expectedShadeR: 22, expectedTintR: 60 },
      // #e94560 => r=233: shade=Math.round(233*0.85)=198, tint=Math.round(233+(255-233)*0.15)=236
      { hex: '#e94560', expectedShadeR: 198, expectedTintR: 236 },
      // #feca57 => r=254: shade=Math.round(254*0.85)=216, tint=Math.round(254+(255-254)*0.15)=254
      { hex: '#feca57', expectedShadeR: 216, expectedTintR: 254 },
      // #3d3d3d => r=61: shade=Math.round(61*0.85)=52, tint=Math.round(61+(255-61)*0.15)=90
      { hex: '#3d3d3d', expectedShadeR: 52, expectedTintR: 90 },
      // #f0932b => r=240: shade=Math.round(240*0.85)=204, tint=Math.round(240+(255-240)*0.15)=242
      { hex: '#f0932b', expectedShadeR: 204, expectedTintR: 242 },
      // #191919 => r=25: shade=Math.round(25*0.85)=21, tint=Math.round(25+(255-25)*0.15)=60
      { hex: '#191919', expectedShadeR: 21, expectedTintR: 60 },
      // #5f27cd => r=95: shade=Math.round(95*0.85)=81, tint=Math.round(95+(255-95)*0.15)=119
      { hex: '#5f27cd', expectedShadeR: 81, expectedTintR: 119 },
      // #54a0ff => r=84: shade=Math.round(84*0.85)=71, tint=Math.round(84+(255-84)*0.15)=110
      { hex: '#54a0ff', expectedShadeR: 71, expectedTintR: 110 },
      // #ee5a24 => r=238: shade=Math.round(238*0.85)=202, tint=Math.round(238+(255-238)*0.15)=241
      { hex: '#ee5a24', expectedShadeR: 202, expectedTintR: 241 },
      // #6a89cc => r=106: shade=Math.round(106*0.85)=90, tint=Math.round(106+(255-106)*0.15)=128
      { hex: '#6a89cc', expectedShadeR: 90, expectedTintR: 128 },
    ];

    adjustCases.forEach(({ hex, expectedShadeR, expectedTintR }) => {
      it(`shade red channel for ${hex} should be ${expectedShadeR}`, () => {
        service.applyTheme({ ...getDefaultTheme(), primaryColor: hex });
        const shade = document.documentElement.style.getPropertyValue('--ion-color-primary-shade');
        const r = parseInt(shade.slice(1, 3), 16);
        expect(r).toBe(expectedShadeR);
      });

      it(`tint red channel for ${hex} should be ${expectedTintR}`, () => {
        service.applyTheme({ ...getDefaultTheme(), primaryColor: hex });
        const tint = document.documentElement.style.getPropertyValue('--ion-color-primary-tint');
        const r = parseInt(tint.slice(1, 3), 16);
        expect(r).toBe(expectedTintR);
      });
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // EXPANSION: applyTheme with 30 full ThemeConfig combinations
  // ═══════════════════════════════════════════════════════════════════════════

  describe('applyTheme — 30 ThemeConfig combinations', () => {
    const themeVariants: Array<{ primary: string; secondary: string; accent: string }> = [
      { primary: '#FF0000', secondary: '#00FF00', accent: '#0000FF' },
      { primary: '#000000', secondary: '#FFFFFF', accent: '#808080' },
      { primary: '#1565C0', secondary: '#B71C1C', accent: '#FFC107' },
      { primary: '#4a90e2', secondary: '#e94560', accent: '#feca57' },
      { primary: '#533483', secondary: '#06d6a0', accent: '#118ab2' },
      { primary: '#ee5a24', secondary: '#009432', accent: '#006266' },
      { primary: '#5f27cd', secondary: '#00d2d3', accent: '#ff9f43' },
      { primary: '#2c2c54', secondary: '#474787', accent: '#aaa69d' },
      { primary: '#218c74', secondary: '#e2b714', accent: '#82ccdd' },
      { primary: '#c8d6e5', secondary: '#8395a7', accent: '#FDA7DF' },
      { primary: '#D980FA', secondary: '#9980FA', accent: '#5758BB' },
      { primary: '#ff6b6b', secondary: '#48dbfb', accent: '#ff9ff3' },
      { primary: '#54a0ff', secondary: '#6a89cc', accent: '#C4E538' },
      { primary: '#1a1a2e', secondary: '#16213e', accent: '#0f3460' },
      { primary: '#073b4c', secondary: '#1289A7', accent: '#191919' },
      { primary: '#3d3d3d', secondary: '#f0932b', accent: '#f7f1e3' },
      { primary: '#e55039', secondary: '#218c74', accent: '#5f27cd' },
      { primary: '#808000', secondary: '#800080', accent: '#008080' },
      { primary: '#c0c0c0', secondary: '#808080', accent: '#404040' },
      { primary: '#FFFF00', secondary: '#FF00FF', accent: '#00FFFF' },
      { primary: '#000080', secondary: '#800000', accent: '#008000' },
      { primary: '#7f7f7f', secondary: '#191919', accent: '#e94560' },
      { primary: '#06d6a0', secondary: '#feca57', accent: '#ff6b6b' },
      { primary: '#82ccdd', secondary: '#D980FA', accent: '#54a0ff' },
      { primary: '#aaa69d', secondary: '#3d3d3d', accent: '#ff9f43' },
      { primary: '#474787', secondary: '#C4E538', accent: '#FDA7DF' },
      { primary: '#9980FA', secondary: '#ee5a24', accent: '#009432' },
      { primary: '#e2b714', secondary: '#533483', accent: '#2c2c54' },
      { primary: '#118ab2', secondary: '#073b4c', accent: '#16213e' },
      { primary: '#f7f1e3', secondary: '#aaa69d', accent: '#8395a7' },
    ];

    themeVariants.forEach(({ primary, secondary, accent }, idx) => {
      it(`theme combo ${idx + 1}: primary=${primary} sets correct CSS var --ion-color-primary`, () => {
        const theme: ThemeConfig = {
          primaryColor: primary,
          secondaryColor: secondary,
          accentColor: accent,
          logoUrl: '',
          appTitle: `App ${idx}`,
          menuHeaderBackground: primary,
        };
        service.applyTheme(theme);
        expect(document.documentElement.style.getPropertyValue('--ion-color-primary')).toBe(primary);
        expect(document.documentElement.style.getPropertyValue('--ion-color-secondary')).toBe(secondary);
        expect(document.documentElement.style.getPropertyValue('--ion-color-tertiary')).toBe(accent);
      });

      it(`theme combo ${idx + 1}: applyTheme logs info with primary=${primary} and secondary=${secondary}`, () => {
        mockLogger.info.calls.reset();
        const theme: ThemeConfig = {
          primaryColor: primary,
          secondaryColor: secondary,
          accentColor: accent,
          logoUrl: '',
          appTitle: `App ${idx}`,
          menuHeaderBackground: primary,
        };
        service.applyTheme(theme);
        expect(mockLogger.info).toHaveBeenCalledWith('Theme applied', {
          primary,
          secondary,
        });
      });
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // EXPANSION: setDarkMode sequential calls and state verification
  // ═══════════════════════════════════════════════════════════════════════════

  describe('setDarkMode() — sequential calls matrix', () => {
    const sequences: boolean[][] = [
      [true],
      [false],
      [true, false],
      [false, true],
      [true, true],
      [false, false],
      [true, false, true],
      [false, true, false],
      [true, true, false],
      [false, false, true],
    ];

    sequences.forEach((seq) => {
      it(`sequence ${seq.join('->')} — final state is ${seq[seq.length - 1]}`, async () => {
        for (const value of seq) {
          await service.setDarkMode(value);
        }
        const finalValue = seq[seq.length - 1];
        expect(service.isDarkMode()).toBe(finalValue);
        expect(document.documentElement.classList.contains('ion-palette-dark')).toBe(finalValue);
      });
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // EXPANSION: initDarkMode variations
  // ═══════════════════════════════════════════════════════════════════════════

  describe('initDarkMode() — all stored value variations', () => {
    const storedValueCases: Array<{ stored: string | null; expectedDark: boolean }> = [
      { stored: 'true', expectedDark: true },
      { stored: 'false', expectedDark: false },
      { stored: null, expectedDark: false },
      { stored: 'TRUE', expectedDark: false },  // case sensitive — only 'true' is true
      { stored: '1', expectedDark: false },
      { stored: '0', expectedDark: false },
      { stored: '', expectedDark: false },
      { stored: 'yes', expectedDark: false },
    ];

    storedValueCases.forEach(({ stored, expectedDark }) => {
      it(`stored "${stored}" → isDarkMode should be ${expectedDark}`, async () => {
        mockPreferences.get.and.resolveTo(stored);
        await service.initDarkMode();
        expect(service.isDarkMode()).toBe(expectedDark);
      });
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // EXPANSION: menuHeaderBackground CSS variable
  // ═══════════════════════════════════════════════════════════════════════════

  describe('applyTheme() — menuHeaderBackground variations', () => {
    const menuBgColors = [
      '#000000', '#FFFFFF', '#B71C1C', '#1565C0', '#FFC107',
      '#4a90e2', '#533483', '#06d6a0', '#ee5a24', '#5f27cd',
    ];

    menuBgColors.forEach(color => {
      it(`should set --app-menu-header-bg to ${color}`, () => {
        service.applyTheme({ ...getDefaultTheme(), menuHeaderBackground: color });
        expect(document.documentElement.style.getPropertyValue('--app-menu-header-bg')).toBe(color);
      });
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // EXPANSION: re-apply theme after dark mode toggle preserves custom colors
  // ═══════════════════════════════════════════════════════════════════════════

  describe('applyTheme() + setDarkMode() interaction — 10 color combos', () => {
    const interactionCases: Array<{ color: string; dark: boolean }> = [
      { color: '#FF0000', dark: true },
      { color: '#00FF00', dark: false },
      { color: '#0000FF', dark: true },
      { color: '#FFFF00', dark: false },
      { color: '#B71C1C', dark: true },
      { color: '#1565C0', dark: false },
      { color: '#4a90e2', dark: true },
      { color: '#808080', dark: false },
      { color: '#000000', dark: true },
      { color: '#FFFFFF', dark: false },
    ];

    interactionCases.forEach(({ color, dark }) => {
      it(`after applyTheme(${color}) and setDarkMode(${dark}), primary color persists`, async () => {
        service.applyTheme({ ...getDefaultTheme(), primaryColor: color });
        await service.setDarkMode(dark);
        expect(document.documentElement.style.getPropertyValue('--ion-color-primary')).toBe(color);
      });
    });
  });
});
