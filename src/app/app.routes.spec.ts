import { TestBed } from '@angular/core/testing';
import { Router, Route, UrlTree } from '@angular/router';
import { Routes } from '@angular/router';
import { routes } from './app.routes';
import { authGuard } from './core/auth/auth.guard';
import { featureGuard } from './core/config/feature.guard';
import { ConfigStore } from './core/config/config.store';
import { FeatureFlags, getDefaultConfig } from './core/config/config.model';

// Helper: rekurzivno trazi rutu po path-u
function findRoute(path: string, routeList: Routes = routes): Route | undefined {
  for (const route of routeList) {
    if (route.path === path) {
      return route;
    }
    if (route.children) {
      const found = findRoute(path, route.children);
      if (found) return found;
    }
  }
  return undefined;
}

// Helper: pronaci shell rutu (path: '', canActivate: [authGuard])
function getShellRoute(): Route | undefined {
  return routes.find(r => r.path === '' && r.canActivate !== undefined);
}

// Helper: pronaci redirect rutu unutar children-a
function getDefaultRedirect(): Route | undefined {
  const shell = getShellRoute();
  if (!shell?.children) return undefined;
  return shell.children.find(r => r.path === '' && r.redirectTo !== undefined);
}

describe('app.routes configuration', () => {
  // ──────────────────────────────────────────────────────────────────────────
  // TC-AR01: Broj top-level ruta
  // ──────────────────────────────────────────────────────────────────────────
  it('TC-AR01: routes array should have exactly 2 top-level routes', () => {
    expect(routes.length).toBe(2);
  });

  // ──────────────────────────────────────────────────────────────────────────
  // TC-AR02: /login ruta postoji i koristi loadComponent (lazy)
  // ──────────────────────────────────────────────────────────────────────────
  it('TC-AR02: should have /login route configured with lazy loadComponent', () => {
    const loginRoute = routes.find(r => r.path === 'login');
    expect(loginRoute).toBeDefined();
    expect(loginRoute!.loadComponent).toBeDefined();
    expect(loginRoute!.component).toBeUndefined();
  });

  it('TC-AR02b: /login loadComponent should resolve to LoginPage', async () => {
    const loginRoute = routes.find(r => r.path === 'login');
    const component = await loginRoute!.loadComponent!();
    expect((component as any).name).toBe('LoginPage');
  });

  // ──────────────────────────────────────────────────────────────────────────
  // TC-AR03: Shell ruta postoji sa authGuard u canActivate
  // ──────────────────────────────────────────────────────────────────────────
  it('TC-AR03: should have shell route (path: "") with authGuard in canActivate', () => {
    const shellRoute = getShellRoute();
    expect(shellRoute).toBeDefined();
    expect(shellRoute!.canActivate).toBeDefined();
    expect(shellRoute!.canActivate).toContain(authGuard);
  });

  it('TC-AR03b: shell route should use lazy loadComponent for ShellComponent', () => {
    const shellRoute = getShellRoute();
    expect(shellRoute!.loadComponent).toBeDefined();
    expect(shellRoute!.component).toBeUndefined();
  });

  // ──────────────────────────────────────────────────────────────────────────
  // TC-AR04: Default redirect '' -> 'home' unutar shell children
  // ──────────────────────────────────────────────────────────────────────────
  it('TC-AR04: should have default redirect from "" to "home" with pathMatch "full" inside shell children', () => {
    const redirect = getDefaultRedirect();
    expect(redirect).toBeDefined();
    expect(redirect!.redirectTo).toBe('home');
    expect(redirect!.pathMatch).toBe('full');
  });

  // ──────────────────────────────────────────────────────────────────────────
  // TC-AR05: Home ruta — bez featureGuard
  // ──────────────────────────────────────────────────────────────────────────
  it('TC-AR05: home route should exist without featureGuard (canMatch should be undefined)', () => {
    const homeRoute = findRoute('home');
    expect(homeRoute).toBeDefined();
    expect(homeRoute!.canMatch).toBeUndefined();
    expect(homeRoute!.loadComponent).toBeDefined();
  });

  // ──────────────────────────────────────────────────────────────────────────
  // TC-AR06: Cart ruta — featureGuard('cart') u canMatch
  // ──────────────────────────────────────────────────────────────────────────
  it('TC-AR06: cart route should exist with canMatch defined', () => {
    const cartRoute = findRoute('cart');
    expect(cartRoute).toBeDefined();
    expect(cartRoute!.canMatch).toBeDefined();
    expect(cartRoute!.canMatch!.length).toBe(1);
  });

  it('TC-AR06b: cart canMatch guard should redirect to /home when cart feature is disabled', () => {
    TestBed.configureTestingModule({ providers: [ConfigStore] });

    const cartRoute = findRoute('cart');
    const guardFn = cartRoute!.canMatch![0] as Function;

    const result = TestBed.runInInjectionContext(() =>
      guardFn({} as any, [] as any)
    ) as boolean | UrlTree;

    // cart is disabled by default (getDefaultFeatures: cart: false)
    expect(result).toBeInstanceOf(UrlTree);
    const router = TestBed.inject(Router);
    expect(router.serializeUrl(result as UrlTree)).toBe('/home');
  });

  it('TC-AR06c: cart canMatch guard should return true when cart feature is enabled', () => {
    TestBed.configureTestingModule({ providers: [ConfigStore] });

    const store = TestBed.inject(ConfigStore);
    store.setConfig({
      ...(store.config() as any) ?? {},
      features: { cart: true, documentation: true, deviceCatalog: true, bugReport: true, pdfReports: false, emailOrders: false, partPhoto: false, cartNote: false, deviceManagement: true, interventionPhotos: false },
      version: 0,
      theme: { primaryColor: '', secondaryColor: '', accentColor: '', logoUrl: '', appTitle: '', menuHeaderBackground: '' },
      localization: { defaultLanguage: 'sr', supportedLanguages: ['sr'] },
      business: { maxPartsPerIntervention: 4, currency: 'EUR', partNote: '', partPhotoFolder: '', snModelStart: 0, snModelLength: 7, snMfgDateStart: 9, snMfgDateLength: 5, snMinLength: 21, snMaxLength: 21, interventionCollections: {}, photoQuality: 70, photoMaxWidth: 1280, orderEmailRecipients: {}, exchangeRate: 1, signature: { commissioning: false, annualService: false, intervention: false } },
      interventionFaultOptions: {},
      interventionErrorOptions: {},
      interventionPhotoConfig: {},
    });

    const cartRoute = findRoute('cart');
    const guardFn = cartRoute!.canMatch![0] as Function;

    const result = TestBed.runInInjectionContext(() =>
      guardFn({} as any, [] as any)
    );

    expect(result).toBe(true);
  });

  // ──────────────────────────────────────────────────────────────────────────
  // TC-AR07: Documentation ruta — featureGuard('documentation')
  // ──────────────────────────────────────────────────────────────────────────
  it('TC-AR07: docs route should exist with canMatch defined', () => {
    const docsRoute = findRoute('docs');
    expect(docsRoute).toBeDefined();
    expect(docsRoute!.canMatch).toBeDefined();
    expect(docsRoute!.canMatch!.length).toBe(1);
  });

  it('TC-AR07b: docs canMatch guard should check documentation feature', () => {
    TestBed.configureTestingModule({ providers: [ConfigStore] });

    const docsRoute = findRoute('docs');
    const guardFn = docsRoute!.canMatch![0] as Function;

    // documentation is false by default
    const result = TestBed.runInInjectionContext(() =>
      guardFn({} as any, [] as any)
    ) as boolean | UrlTree;

    expect(result).toBeInstanceOf(UrlTree);
    const router = TestBed.inject(Router);
    expect(router.serializeUrl(result as UrlTree)).toBe('/home');
  });

  // ──────────────────────────────────────────────────────────────────────────
  // TC-AR08: Device catalog rute — featureGuard('deviceCatalog')
  // ──────────────────────────────────────────────────────────────────────────
  it('TC-AR08: search-by-device route should have canMatch with deviceCatalog guard', () => {
    const route = findRoute('search-by-device');
    expect(route).toBeDefined();
    expect(route!.canMatch).toBeDefined();
    expect(route!.canMatch!.length).toBe(1);
  });

  it('TC-AR08b: device-groups route should have canMatch with deviceCatalog guard', () => {
    const route = findRoute('device/:code/device-groups');
    expect(route).toBeDefined();
    expect(route!.canMatch).toBeDefined();
    expect(route!.canMatch!.length).toBe(1);
  });

  it('TC-AR08c: device-parts route should have canMatch with deviceCatalog guard', () => {
    const route = findRoute('device/:code/device-groups/:groupId/device-parts');
    expect(route).toBeDefined();
    expect(route!.canMatch).toBeDefined();
    expect(route!.canMatch!.length).toBe(1);
  });

  it('TC-AR08d: deviceCatalog canMatch guard should return true when deviceCatalog is enabled (default)', () => {
    TestBed.configureTestingModule({ providers: [ConfigStore] });

    const route = findRoute('search-by-device');
    const guardFn = route!.canMatch![0] as Function;

    // deviceCatalog is true by default
    const result = TestBed.runInInjectionContext(() =>
      guardFn({} as any, [] as any)
    );

    expect(result).toBe(true);
  });

  // ──────────────────────────────────────────────────────────────────────────
  // TC-AR09: Device management rute — featureGuard('deviceManagement')
  // ──────────────────────────────────────────────────────────────────────────
  it('TC-AR09: search-by-user route should have canMatch with deviceManagement guard', () => {
    const route = findRoute('search-by-user');
    expect(route).toBeDefined();
    expect(route!.canMatch).toBeDefined();
    expect(route!.canMatch!.length).toBe(1);
  });

  it('TC-AR09b: device-management/:sn route should have canMatch with deviceManagement guard', () => {
    const route = findRoute('device-management/:sn');
    expect(route).toBeDefined();
    expect(route!.canMatch).toBeDefined();
    expect(route!.canMatch!.length).toBe(1);
  });

  it('TC-AR09c: device-management/:sn/add-user route should have canMatch', () => {
    const route = findRoute('device-management/:sn/add-user');
    expect(route).toBeDefined();
    expect(route!.canMatch).toBeDefined();
  });

  it('TC-AR09d: device-management/:sn/intervention route should have canMatch', () => {
    const route = findRoute('device-management/:sn/intervention');
    expect(route).toBeDefined();
    expect(route!.canMatch).toBeDefined();
  });

  it('TC-AR09e: deviceManagement canMatch guard should return true when deviceManagement is enabled (default)', () => {
    TestBed.configureTestingModule({ providers: [ConfigStore] });

    const route = findRoute('search-by-user');
    const guardFn = route!.canMatch![0] as Function;

    // deviceManagement is true by default
    const result = TestBed.runInInjectionContext(() =>
      guardFn({} as any, [] as any)
    );

    expect(result).toBe(true);
  });

  // ──────────────────────────────────────────────────────────────────────────
  // TC-AR10: Lazy load — sve rute koriste loadComponent (ne component)
  // ──────────────────────────────────────────────────────────────────────────
  it('TC-AR10: all non-redirect routes should use loadComponent (lazy load) not component', () => {
    function checkLazy(routeList: Routes): void {
      for (const route of routeList) {
        if (route.redirectTo !== undefined) continue;
        expect(route.loadComponent).toBeDefined(`Route "${route.path}" should use loadComponent`);
        expect(route.component).toBeUndefined(`Route "${route.path}" should not use static component`);
        if (route.children) {
          checkLazy(route.children);
        }
      }
    }
    checkLazy(routes);
  });

  // ──────────────────────────────────────────────────────────────────────────
  // TC-AR11: Wildcard — NEMA ** rute (nema 404 redirect)
  // ──────────────────────────────────────────────────────────────────────────
  it('TC-AR11: should NOT have a wildcard (**) route at top level', () => {
    const wildcardRoute = routes.find(r => r.path === '**');
    expect(wildcardRoute).toBeUndefined();
  });

  // ──────────────────────────────────────────────────────────────────────────
  // TC-AR12: Shell children sadrze ocekivani broj ruta
  // ──────────────────────────────────────────────────────────────────────────
  it('TC-AR12: shell route children should have exactly 16 child routes', () => {
    const shellRoute = getShellRoute();
    expect(shellRoute).toBeDefined();
    expect(shellRoute!.children).toBeDefined();
    expect(shellRoute!.children!.length).toBe(16);
  });

  // ──────────────────────────────────────────────────────────────────────────
  // TC-AR13: bugReport — NEMA rute za bugReport feature u app.routes.ts
  // ──────────────────────────────────────────────────────────────────────────
  it('TC-AR13: there is no top-level bug-report route defined in app.routes.ts', () => {
    const bugReportRoute = findRoute('bug-report');
    expect(bugReportRoute).toBeUndefined();
  });

  // ──────────────────────────────────────────────────────────────────────────
  // TC-AR14: Children routes nasledjuju authGuard od parent shell rute
  // ──────────────────────────────────────────────────────────────────────────
  it('TC-AR14: shell children should NOT individually repeat authGuard (they inherit from shell canActivate)', () => {
    const shellRoute = getShellRoute();
    expect(shellRoute!.children).toBeDefined();
    for (const child of shellRoute!.children!) {
      if (child.canActivate) {
        // If a child has canActivate, it should not be duplicating authGuard from parent
        expect(child.canActivate).not.toContain(authGuard,
          `Child route "${child.path}" should not repeat authGuard — it is inherited from shell`
        );
      }
    }
  });

  // ──────────────────────────────────────────────────────────────────────────
  // TC-AR15: device-management subrute — 7 ruta ukupno
  // ──────────────────────────────────────────────────────────────────────────
  it('TC-AR15: should have 8 device-management child routes (search-by-user + 7 device-management/:sn* variants)', () => {
    const shellRoute = getShellRoute();
    const dmRoutes = shellRoute!.children!.filter(r =>
      r.path !== undefined && (r.path.startsWith('device-management') || r.path === 'search-by-user')
    );
    expect(dmRoutes.length).toBe(8);
  });

  // ──────────────────────────────────────────────────────────────────────────
  // TC-AR16: device catalog subrute — 3 rute sa deviceCatalog guard
  // ──────────────────────────────────────────────────────────────────────────
  it('TC-AR16: should have 3 device catalog routes gated by deviceCatalog feature', () => {
    const shellRoute = getShellRoute();
    const catalogRoutes = shellRoute!.children!.filter(r =>
      r.path !== undefined &&
      (r.path === 'search-by-device' ||
        r.path.startsWith('device/:code'))
    );
    expect(catalogRoutes.length).toBe(3);
    for (const route of catalogRoutes) {
      expect(route.canMatch).toBeDefined(`Route "${route.path}" should have canMatch`);
    }
  });

  // ──────────────────────────────────────────────────────────────────────────
  // TC-AR17: featureGuard disabled — sve deviceManagement rute blokirane
  // ──────────────────────────────────────────────────────────────────────────
  it('TC-AR17: all deviceManagement routes should redirect to /home when deviceManagement is disabled', () => {
    TestBed.configureTestingModule({ providers: [ConfigStore] });
    const store = TestBed.inject(ConfigStore);
    const router = TestBed.inject(Router);

    store.setConfig({
      version: 0,
      features: { cart: false, documentation: false, deviceCatalog: true, bugReport: false, pdfReports: false, emailOrders: false, partPhoto: false, cartNote: false, deviceManagement: false, interventionPhotos: false, signatureCapture: false, servicerReport: false },
      theme: { primaryColor: '', secondaryColor: '', accentColor: '', logoUrl: '', appTitle: '', menuHeaderBackground: '' },
      localization: { defaultLanguage: 'sr', supportedLanguages: ['sr'] },
      business: { maxPartsPerIntervention: 4, currency: 'EUR', partNote: '', partPhotoFolder: '', snModelStart: 0, snModelLength: 7, snMfgDateStart: 9, snMfgDateLength: 5, snMinLength: 21, snMaxLength: 21, interventionCollections: {}, photoQuality: 70, photoMaxWidth: 1280, orderEmailRecipients: {}, exchangeRate: 1, signature: { commissioning: false, annualService: false, intervention: false } },
      interventionFaultOptions: {},
      interventionErrorOptions: {},
      interventionPhotoConfig: {},
    });

    const shellRoute = getShellRoute();
    const dmRoutes = shellRoute!.children!.filter(r =>
      r.path !== undefined && (r.path.startsWith('device-management') || r.path === 'search-by-user')
    );

    for (const route of dmRoutes) {
      const guardFn = route.canMatch![0] as Function;
      const result = TestBed.runInInjectionContext(() =>
        guardFn({} as any, [] as any)
      ) as boolean | UrlTree;

      expect(result instanceof UrlTree).toBe(true, `Route "${route.path}" should return UrlTree when deviceManagement is disabled`);
      expect(router.serializeUrl(result as UrlTree)).toBe('/home');
    }
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // EXPANSION: all guarded routes with feature disabled → UrlTree /home
  // ═══════════════════════════════════════════════════════════════════════════

  describe('featureGuard — all guarded routes with their feature disabled redirect to /home', () => {
    interface GuardedRouteCase {
      path: string;
      feature: keyof FeatureFlags;
    }

    const guardedRoutes: GuardedRouteCase[] = [
      { path: 'cart', feature: 'cart' },
      { path: 'docs', feature: 'documentation' },
      { path: 'search-by-device', feature: 'deviceCatalog' },
      { path: 'device/:code/device-groups', feature: 'deviceCatalog' },
      { path: 'device/:code/device-groups/:groupId/device-parts', feature: 'deviceCatalog' },
      { path: 'search-by-user', feature: 'deviceManagement' },
      { path: 'device-management/:sn', feature: 'deviceManagement' },
      { path: 'device-management/:sn/add-user', feature: 'deviceManagement' },
      { path: 'device-management/:sn/add-device', feature: 'deviceManagement' },
      { path: 'device-management/:sn/annual-service', feature: 'deviceManagement' },
      { path: 'device-management/:sn/intervention', feature: 'deviceManagement' },
      { path: 'device-management/:sn/history', feature: 'deviceManagement' },
      { path: 'device-management/:sn/history/:id', feature: 'deviceManagement' },
    ];

    guardedRoutes.forEach(({ path, feature }) => {
      it(`route "${path}" with "${feature}" disabled → guard returns UrlTree /home`, () => {
        TestBed.configureTestingModule({ providers: [ConfigStore] });
        const store = TestBed.inject(ConfigStore);
        const router = TestBed.inject(Router);

        const cfg = getDefaultConfig();
        cfg.features[feature] = false;
        store.setConfig(cfg);

        const route = findRoute(path);
        expect(route).withContext(`Route "${path}" should exist`).toBeDefined();
        expect(route!.canMatch).withContext(`Route "${path}" should have canMatch`).toBeDefined();

        const guardFn = route!.canMatch![0] as Function;
        const result = TestBed.runInInjectionContext(() =>
          guardFn({} as any, [] as any)
        ) as boolean | UrlTree;

        expect(result).toBeInstanceOf(UrlTree);
        expect(router.serializeUrl(result as UrlTree)).toBe('/home');
      });
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // EXPANSION: all guarded routes with their feature enabled → true
  // ═══════════════════════════════════════════════════════════════════════════

  describe('featureGuard — all guarded routes with their feature enabled return true', () => {
    interface GuardedRouteCase {
      path: string;
      feature: keyof FeatureFlags;
    }

    const guardedRoutes: GuardedRouteCase[] = [
      { path: 'cart', feature: 'cart' },
      { path: 'docs', feature: 'documentation' },
      { path: 'search-by-device', feature: 'deviceCatalog' },
      { path: 'device/:code/device-groups', feature: 'deviceCatalog' },
      { path: 'device/:code/device-groups/:groupId/device-parts', feature: 'deviceCatalog' },
      { path: 'search-by-user', feature: 'deviceManagement' },
      { path: 'device-management/:sn', feature: 'deviceManagement' },
      { path: 'device-management/:sn/add-user', feature: 'deviceManagement' },
      { path: 'device-management/:sn/add-device', feature: 'deviceManagement' },
      { path: 'device-management/:sn/annual-service', feature: 'deviceManagement' },
      { path: 'device-management/:sn/intervention', feature: 'deviceManagement' },
      { path: 'device-management/:sn/history', feature: 'deviceManagement' },
      { path: 'device-management/:sn/history/:id', feature: 'deviceManagement' },
    ];

    guardedRoutes.forEach(({ path, feature }) => {
      it(`route "${path}" with "${feature}" enabled → guard returns true`, () => {
        TestBed.configureTestingModule({ providers: [ConfigStore] });
        const store = TestBed.inject(ConfigStore);

        const cfg = getDefaultConfig();
        cfg.features[feature] = true;
        store.setConfig(cfg);

        const route = findRoute(path);
        expect(route).withContext(`Route "${path}" should exist`).toBeDefined();

        const guardFn = route!.canMatch![0] as Function;
        const result = TestBed.runInInjectionContext(() =>
          guardFn({} as any, [] as any)
        );

        expect(result).toBe(true);
      });
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // EXPANSION: all shell children have loadComponent (not component)
  // ═══════════════════════════════════════════════════════════════════════════

  describe('route structure — all shell children have loadComponent', () => {
    it('every shell child with a path (not redirect) has loadComponent defined', () => {
      const shellRoute = getShellRoute();
      const children = shellRoute!.children!.filter(r => r.redirectTo === undefined);

      children.forEach(child => {
        expect(child.loadComponent).withContext(`Route "${child.path}" should have loadComponent`).toBeDefined();
        expect(child.component).withContext(`Route "${child.path}" should not have static component`).toBeUndefined();
      });
    });

    it('shell route itself has loadComponent for ShellComponent', async () => {
      const shellRoute = getShellRoute();
      expect(shellRoute!.loadComponent).toBeDefined();
      const component = await shellRoute!.loadComponent!();
      expect((component as any).name).toBe('ShellComponent');
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // EXPANSION: deviceCatalog routes all blocked when deviceCatalog disabled
  // ═══════════════════════════════════════════════════════════════════════════

  describe('deviceCatalog feature — all 3 routes blocked when disabled', () => {
    const catalogPaths = [
      'search-by-device',
      'device/:code/device-groups',
      'device/:code/device-groups/:groupId/device-parts',
    ];

    it('all 3 deviceCatalog routes return UrlTree when deviceCatalog is disabled', () => {
      TestBed.configureTestingModule({ providers: [ConfigStore] });
      const store = TestBed.inject(ConfigStore);
      const router = TestBed.inject(Router);

      const cfg = getDefaultConfig();
      cfg.features.deviceCatalog = false;
      store.setConfig(cfg);

      for (const path of catalogPaths) {
        const route = findRoute(path)!;
        const guardFn = route.canMatch![0] as Function;
        const result = TestBed.runInInjectionContext(() =>
          guardFn({} as any, [] as any)
        ) as boolean | UrlTree;

        expect(result instanceof UrlTree).toBe(true, `${path} should return UrlTree`);
        expect(router.serializeUrl(result as UrlTree)).toBe('/home');
      }
    });

    it('all 3 deviceCatalog routes return true when deviceCatalog is enabled', () => {
      TestBed.configureTestingModule({ providers: [ConfigStore] });
      const store = TestBed.inject(ConfigStore);

      const cfg = getDefaultConfig();
      cfg.features.deviceCatalog = true;
      store.setConfig(cfg);

      for (const path of catalogPaths) {
        const route = findRoute(path)!;
        const guardFn = route.canMatch![0] as Function;
        const result = TestBed.runInInjectionContext(() =>
          guardFn({} as any, [] as any)
        );

        expect(result).toBe(true);
      }
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // EXPANSION: route path existence verification
  // ═══════════════════════════════════════════════════════════════════════════

  describe('route existence — all expected paths are defined', () => {
    const expectedPaths = [
      'home',
      'search-by-device',
      'device/:code/device-groups',
      'device/:code/device-groups/:groupId/device-parts',
      'docs',
      'cart',
      'search-by-user',
      'device-management/:sn/add-user',
      'device-management/:sn/add-device',
      'device-management/:sn/annual-service',
      'device-management/:sn/intervention',
      'device-management/:sn/history/:id',
      'device-management/:sn/history',
      'device-management/:sn',
    ];

    expectedPaths.forEach(path => {
      it(`route with path "${path}" should exist in routes configuration`, () => {
        const route = findRoute(path);
        expect(route).withContext(`Route "${path}" should be defined`).toBeDefined();
      });
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // EXPANSION: all device-management routes have exactly 1 canMatch guard
  // ═══════════════════════════════════════════════════════════════════════════

  describe('device-management routes — all have exactly 1 canMatch guard', () => {
    const dmPaths = [
      'device-management/:sn',
      'device-management/:sn/add-user',
      'device-management/:sn/add-device',
      'device-management/:sn/annual-service',
      'device-management/:sn/intervention',
      'device-management/:sn/history',
      'device-management/:sn/history/:id',
    ];

    dmPaths.forEach(path => {
      it(`route "${path}" has exactly 1 canMatch guard`, () => {
        const route = findRoute(path);
        expect(route).toBeDefined();
        expect(route!.canMatch).toBeDefined();
        expect(route!.canMatch!.length).toBe(1);
      });
    });
  });
});
