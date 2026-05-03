import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter, Router, ActivatedRoute } from '@angular/router';
import { TranslocoTestingModule } from '@jsverse/transloco';
import { DeviceGroupsPage } from './device-groups.page';
import { DeviceGroupsService } from '../services/device-groups.service';
import { CartService } from '../../cart/cart.service';
import { Group } from '../../../shared/models/group.model';

describe('DeviceGroupsPage', () => {
  let component: DeviceGroupsPage;
  let fixture: ComponentFixture<DeviceGroupsPage>;
  let mockGroupsService: {
    groups: Group[];
    isLoading: boolean;
    load: jasmine.Spy;
    reset: jasmine.Spy;
  };
  let mockCartService: {
    clearItems: jasmine.Spy;
  };
  let router: Router;

  const createGroup = (id: string, name: string, photo = ''): Group => ({
    id,
    name,
    groupPhoto: photo,
  });

  beforeEach(async () => {
    mockGroupsService = {
      groups: [],
      isLoading: false,
      load: jasmine.createSpy('load').and.resolveTo(undefined),
      reset: jasmine.createSpy('reset'),
    };
    mockCartService = {
      clearItems: jasmine.createSpy('clearItems'),
    };

    await TestBed.configureTestingModule({
      imports: [
        DeviceGroupsPage,
        TranslocoTestingModule.forRoot({
          langs: {
            sr: {
              device_groups_title: 'Sklopovi',
              device_groups_empty: 'Nema pronađenih sklopova za ovaj uređaj.',
            },
          },
          translocoConfig: { availableLangs: ['sr'], defaultLang: 'sr' },
          preloadLangs: true,
        }),
      ],
      providers: [
        provideRouter([]),
        { provide: DeviceGroupsService, useValue: mockGroupsService },
        { provide: CartService, useValue: mockCartService },
        {
          provide: ActivatedRoute,
          useValue: {
            snapshot: {
              paramMap: {
                get: (key: string) => (key === 'code' ? 'DEV-001' : null),
              },
            },
          },
        },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(DeviceGroupsPage);
    component = fixture.componentInstance;
    router = TestBed.inject(Router);
    fixture.detectChanges();
  });

  // ── Creation ──
  describe('creation', () => {
    it('should create', () => {
      expect(component).toBeTruthy();
    });
  });

  // ── ionViewWillEnter ──
  describe('ionViewWillEnter', () => {
    it('should read device code from route params', () => {
      component.ionViewWillEnter();
      expect(mockGroupsService.load).toHaveBeenCalledWith('DEV-001');
    });

    it('should load groups for the device', () => {
      component.ionViewWillEnter();
      expect(mockGroupsService.load).toHaveBeenCalled();
    });

    it('should clear cart on first entry', () => {
      component.ionViewWillEnter();
      expect(mockCartService.clearItems).toHaveBeenCalled();
    });

    it('should not clear cart when returning from parts page', () => {
      // Simulate navigating to parts
      spyOn(router, 'navigate');
      component.onGroupClick(createGroup('G1', 'Group'));

      // Now simulate returning
      mockCartService.clearItems.calls.reset();
      component.ionViewWillEnter();
      expect(mockCartService.clearItems).not.toHaveBeenCalled();
    });

    it('should clear cart again on subsequent fresh entries', () => {
      // First: navigate to parts
      spyOn(router, 'navigate');
      component.onGroupClick(createGroup('G1', 'Group'));

      // Return from parts
      mockCartService.clearItems.calls.reset();
      component.ionViewWillEnter();
      expect(mockCartService.clearItems).not.toHaveBeenCalled();

      // Second fresh entry
      component.ionViewWillEnter();
      expect(mockCartService.clearItems).toHaveBeenCalled();
    });

    it('should use empty string when code param is missing', async () => {
      await TestBed.resetTestingModule().configureTestingModule({
        imports: [
          DeviceGroupsPage,
          TranslocoTestingModule.forRoot({
            langs: { sr: { device_groups_title: 'Sklopovi', device_groups_empty: 'Nema.' } },
            translocoConfig: { availableLangs: ['sr'], defaultLang: 'sr' },
            preloadLangs: true,
          }),
        ],
        providers: [
          provideRouter([]),
          { provide: DeviceGroupsService, useValue: mockGroupsService },
          { provide: CartService, useValue: mockCartService },
          {
            provide: ActivatedRoute,
            useValue: { snapshot: { paramMap: { get: () => null } } },
          },
        ],
      }).compileComponents();

      const f = TestBed.createComponent(DeviceGroupsPage);
      f.componentInstance.ionViewWillEnter();
      expect(mockGroupsService.load).toHaveBeenCalledWith('');
    });
  });

  // ── onGroupClick ──
  describe('onGroupClick()', () => {
    it('should navigate to device parts page', () => {
      const navigateSpy = spyOn(router, 'navigate');
      component.ionViewWillEnter(); // sets deviceCode
      component.onGroupClick(createGroup('G1', 'Group'));
      expect(navigateSpy).toHaveBeenCalledWith(['/device', 'DEV-001', 'device-groups', 'G1', 'device-parts']);
    });

    it('should set hasNavigatedToParts flag', () => {
      spyOn(router, 'navigate');
      component.ionViewWillEnter();
      component.onGroupClick(createGroup('G1', 'Group'));
      expect((component as any).hasNavigatedToParts).toBeTrue();
    });

    it('should use correct group id in navigation', () => {
      const navigateSpy = spyOn(router, 'navigate');
      component.ionViewWillEnter();
      component.onGroupClick(createGroup('SKL-002', 'Kompresor'));
      expect(navigateSpy).toHaveBeenCalledWith(['/device', 'DEV-001', 'device-groups', 'SKL-002', 'device-parts']);
    });
  });

  // ── Header template ──
  describe('header template', () => {
    it('should display translated title', () => {
      const title = fixture.nativeElement.querySelector('ion-title');
      expect(title.textContent.trim()).toBe('Sklopovi');
    });

    it('should have back button', () => {
      const backButton = fixture.nativeElement.querySelector('ion-back-button');
      expect(backButton).toBeTruthy();
    });

    it('should have back button defaultHref to search page', () => {
      const backButton = fixture.nativeElement.querySelector('ion-back-button');
      expect(backButton.getAttribute('defaultHref') || backButton.defaultHref).toBe('/search-by-device');
    });

    it('should have menu button', () => {
      const menuButton = fixture.nativeElement.querySelector('ion-menu-button');
      expect(menuButton).toBeTruthy();
    });

    it('should have primary color toolbar', () => {
      const toolbar = fixture.nativeElement.querySelector('ion-toolbar');
      expect(toolbar.getAttribute('color')).toBe('primary');
    });
  });

  // ── Loading state ──
  describe('loading state', () => {
    beforeEach(() => {
      mockGroupsService.isLoading = true;
      mockGroupsService.groups = [];
      fixture.detectChanges();
    });

    it('should show skeleton list', () => {
      const skeletons = fixture.nativeElement.querySelectorAll('ion-skeleton-text');
      expect(skeletons.length).toBeGreaterThan(0);
    });

    it('should show 5 skeleton items', () => {
      const items = fixture.nativeElement.querySelectorAll('ion-list ion-item');
      expect(items.length).toBe(5);
    });

    it('should have animated skeletons', () => {
      const skeleton = fixture.nativeElement.querySelector('ion-skeleton-text');
      expect(skeleton.animated).toBeTrue();
    });

    it('should not show group items', () => {
      const buttons = fixture.nativeElement.querySelectorAll('ion-item[button]');
      expect(buttons.length).toBe(0);
    });

    it('should not show empty state', () => {
      const empty = fixture.nativeElement.querySelector('.empty-state');
      expect(empty).toBeNull();
    });
  });

  // ── Groups list ──
  describe('groups list', () => {
    beforeEach(() => {
      mockGroupsService.groups = [
        createGroup('G1', 'Kompresor'),
        createGroup('G2', 'Ventilator'),
        createGroup('G3', 'Elektronika'),
      ];
      mockGroupsService.isLoading = false;
      fixture.detectChanges();
    });

    it('should show group items', () => {
      const items = fixture.nativeElement.querySelectorAll('ion-item[button]');
      expect(items.length).toBe(3);
    });

    it('should display group id in bold', () => {
      const strongs = fixture.nativeElement.querySelectorAll('strong');
      expect(strongs[0].textContent.trim()).toBe('G1');
    });

    it('should display group name', () => {
      const names = fixture.nativeElement.querySelectorAll('.group-name');
      expect(names[0].textContent.trim()).toBe('Kompresor');
    });

    it('should have detail arrow', () => {
      const item = fixture.nativeElement.querySelector('ion-item[button]');
      expect(item.detail).toBeTrue();
    });

    it('should have full lines', () => {
      const item = fixture.nativeElement.querySelector('ion-item[button]');
      expect(item.lines || item.getAttribute('lines')).toBe('full');
    });

    it('should not show skeleton', () => {
      const skeletons = fixture.nativeElement.querySelectorAll('ion-skeleton-text');
      expect(skeletons.length).toBe(0);
    });

    it('should not show empty state', () => {
      const empty = fixture.nativeElement.querySelector('.empty-state');
      expect(empty).toBeNull();
    });

    it('should wrap text in labels', () => {
      const label = fixture.nativeElement.querySelector('ion-label.ion-text-wrap');
      expect(label).toBeTruthy();
    });

    it('should navigate on click', () => {
      const navigateSpy = spyOn(router, 'navigate');
      component.ionViewWillEnter();
      const item = fixture.nativeElement.querySelector('ion-item[button]');
      item.click();
      expect(navigateSpy).toHaveBeenCalledWith(['/device', 'DEV-001', 'device-groups', 'G1', 'device-parts']);
    });
  });

  // ── Empty state ──
  describe('empty state', () => {
    beforeEach(() => {
      mockGroupsService.groups = [];
      mockGroupsService.isLoading = false;
      fixture.detectChanges();
    });

    it('should show empty state message', () => {
      const empty = fixture.nativeElement.querySelector('.empty-state');
      expect(empty).toBeTruthy();
    });

    it('should display translated empty message', () => {
      const empty = fixture.nativeElement.querySelector('.empty-state p');
      expect(empty.textContent.trim()).toBe('Nema pronađenih sklopova za ovaj uređaj.');
    });

    it('should not show group list', () => {
      const items = fixture.nativeElement.querySelectorAll('ion-item[button]');
      expect(items.length).toBe(0);
    });

    it('should not show skeleton', () => {
      const skeletons = fixture.nativeElement.querySelectorAll('ion-skeleton-text');
      expect(skeletons.length).toBe(0);
    });
  });

  // ── State transitions ──
  describe('state transitions', () => {
    it('should transition from loading to groups', () => {
      mockGroupsService.isLoading = true;
      mockGroupsService.groups = [];
      fixture.detectChanges();
      expect(fixture.nativeElement.querySelectorAll('ion-skeleton-text').length).toBeGreaterThan(0);

      mockGroupsService.isLoading = false;
      mockGroupsService.groups = [createGroup('G1', 'Group')];
      fixture.detectChanges();
      const items = fixture.nativeElement.querySelectorAll('ion-item[button]');
      expect(items.length).toBe(1);
    });

    it('should transition from loading to empty', () => {
      mockGroupsService.isLoading = true;
      fixture.detectChanges();

      mockGroupsService.isLoading = false;
      mockGroupsService.groups = [];
      fixture.detectChanges();
      const empty = fixture.nativeElement.querySelector('.empty-state');
      expect(empty).toBeTruthy();
    });
  });

  // ── Mutual exclusivity ──
  describe('mutual exclusivity of states', () => {
    it('loading: no groups, no empty', () => {
      mockGroupsService.isLoading = true;
      mockGroupsService.groups = [];
      fixture.detectChanges();
      expect(fixture.nativeElement.querySelectorAll('ion-skeleton-text').length).toBeGreaterThan(0);
      expect(fixture.nativeElement.querySelectorAll('ion-item[button]').length).toBe(0);
      expect(fixture.nativeElement.querySelector('.empty-state')).toBeNull();
    });

    it('groups: no loading, no empty', () => {
      mockGroupsService.isLoading = false;
      mockGroupsService.groups = [createGroup('G1', 'G')];
      fixture.detectChanges();
      expect(fixture.nativeElement.querySelectorAll('ion-skeleton-text').length).toBe(0);
      expect(fixture.nativeElement.querySelectorAll('ion-item[button]').length).toBe(1);
      expect(fixture.nativeElement.querySelector('.empty-state')).toBeNull();
    });

    it('empty: no loading, no groups', () => {
      mockGroupsService.isLoading = false;
      mockGroupsService.groups = [];
      fixture.detectChanges();
      expect(fixture.nativeElement.querySelectorAll('ion-skeleton-text').length).toBe(0);
      expect(fixture.nativeElement.querySelectorAll('ion-item[button]').length).toBe(0);
      expect(fixture.nativeElement.querySelector('.empty-state')).toBeTruthy();
    });
  });

  // ── Special content ──
  describe('special content', () => {
    it('should display group with long name', () => {
      mockGroupsService.groups = [createGroup('G1', 'A'.repeat(200))];
      fixture.detectChanges();
      const name = fixture.nativeElement.querySelector('.group-name');
      expect(name.textContent).toContain('A'.repeat(200));
    });

    it('should display group with unicode name', () => {
      mockGroupsService.groups = [createGroup('G1', 'Компресор')];
      fixture.detectChanges();
      const name = fixture.nativeElement.querySelector('.group-name');
      expect(name.textContent).toContain('Компресор');
    });

    it('should handle many groups', () => {
      mockGroupsService.groups = Array.from({ length: 30 }, (_, i) => createGroup(`G${i}`, `Group ${i}`));
      fixture.detectChanges();
      const items = fixture.nativeElement.querySelectorAll('ion-item[button]');
      expect(items.length).toBe(30);
    });
  });
});
