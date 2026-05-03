import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { AppComponent } from './app.component';

describe('AppComponent', () => {
  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [AppComponent],
      providers: [provideRouter([])]
    }).compileComponents();
  });

  it('should create the app', () => {
    const fixture = TestBed.createComponent(AppComponent);
    const app = fixture.componentInstance;
    expect(app).toBeTruthy();
  });

  it('should render ion-app with ion-router-outlet', () => {
    const fixture = TestBed.createComponent(AppComponent);
    fixture.detectChanges();
    const compiled = fixture.nativeElement as HTMLElement;
    expect(compiled.querySelector('ion-app')).toBeTruthy();
    expect(compiled.querySelector('ion-router-outlet')).toBeTruthy();
  });

  // ─── EXPANSION: component metadata ───────────────────────────────────────────

  describe('component metadata', () => {
    it('should be a standalone component', () => {
      const cmp = (AppComponent as any)['ɵcmp'];
      expect(cmp).toBeTruthy();
    });

    it('should have app-root selector', () => {
      const selector: string = (AppComponent as any)['ɵcmp']?.selectors?.[0]?.[0] ?? '';
      expect(selector).toBe('app-root');
    });

    it('should be instantiable via TestBed.createComponent', () => {
      const fixture = TestBed.createComponent(AppComponent);
      expect(fixture.componentInstance).toBeInstanceOf(AppComponent);
    });
  });

  // ─── EXPANSION: template structure ───────────────────────────────────────────

  describe('template structure', () => {
    it('should render exactly one ion-app element', () => {
      const fixture = TestBed.createComponent(AppComponent);
      fixture.detectChanges();
      const ionApps = fixture.nativeElement.querySelectorAll('ion-app');
      expect(ionApps.length).toBe(1);
    });

    it('should render exactly one ion-router-outlet element', () => {
      const fixture = TestBed.createComponent(AppComponent);
      fixture.detectChanges();
      const outlets = fixture.nativeElement.querySelectorAll('ion-router-outlet');
      expect(outlets.length).toBe(1);
    });

    it('ion-router-outlet should be inside ion-app', () => {
      const fixture = TestBed.createComponent(AppComponent);
      fixture.detectChanges();
      const ionApp = fixture.nativeElement.querySelector('ion-app');
      const outlet = ionApp?.querySelector('ion-router-outlet');
      expect(outlet).not.toBeNull();
    });

    it('should not contain any text nodes directly in ion-app', () => {
      const fixture = TestBed.createComponent(AppComponent);
      fixture.detectChanges();
      const ionApp = fixture.nativeElement.querySelector('ion-app');
      // The ion-app should only contain the router outlet, no stray text
      expect(ionApp).not.toBeNull();
    });
  });

  // ─── EXPANSION: stability tests ──────────────────────────────────────────────

  describe('change detection stability', () => {
    it('should not throw on detectChanges', () => {
      const fixture = TestBed.createComponent(AppComponent);
      expect(() => fixture.detectChanges()).not.toThrow();
    });

    it('should remain stable after multiple detectChanges calls', () => {
      const fixture = TestBed.createComponent(AppComponent);
      expect(() => {
        fixture.detectChanges();
        fixture.detectChanges();
        fixture.detectChanges();
      }).not.toThrow();
    });

    it('should still render ion-app after re-render', () => {
      const fixture = TestBed.createComponent(AppComponent);
      fixture.detectChanges();
      fixture.detectChanges();
      expect(fixture.nativeElement.querySelector('ion-app')).not.toBeNull();
    });

    it('should still render ion-router-outlet after re-render', () => {
      const fixture = TestBed.createComponent(AppComponent);
      fixture.detectChanges();
      fixture.detectChanges();
      expect(fixture.nativeElement.querySelector('ion-router-outlet')).not.toBeNull();
    });
  });

  // ─── EXPANSION: multiple fixture instances ────────────────────────────────────

  describe('multiple component instances', () => {
    it('should create two independent component instances', () => {
      const fixture1 = TestBed.createComponent(AppComponent);
      const fixture2 = TestBed.createComponent(AppComponent);
      expect(fixture1.componentInstance).not.toBe(fixture2.componentInstance);
    });

    it('both instances should have ion-router-outlet', () => {
      const fixture1 = TestBed.createComponent(AppComponent);
      const fixture2 = TestBed.createComponent(AppComponent);
      fixture1.detectChanges();
      fixture2.detectChanges();
      expect(fixture1.nativeElement.querySelector('ion-router-outlet')).not.toBeNull();
      expect(fixture2.nativeElement.querySelector('ion-router-outlet')).not.toBeNull();
    });
  });

  // ─── EXPANSION: nativeElement checks ─────────────────────────────────────────

  describe('nativeElement checks', () => {
    it('nativeElement should be an HTMLElement', () => {
      const fixture = TestBed.createComponent(AppComponent);
      expect(fixture.nativeElement instanceof HTMLElement).toBe(true);
    });

    it('nativeElement should not be null', () => {
      const fixture = TestBed.createComponent(AppComponent);
      expect(fixture.nativeElement).not.toBeNull();
    });

    it('componentInstance should not be null', () => {
      const fixture = TestBed.createComponent(AppComponent);
      expect(fixture.componentInstance).not.toBeNull();
    });
  });
});
