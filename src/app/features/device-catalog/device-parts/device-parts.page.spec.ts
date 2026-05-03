import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter, Router, ActivatedRoute } from '@angular/router';
import { TranslocoTestingModule } from '@jsverse/transloco';
import { DevicePartsPage } from './device-parts.page';
import { DevicePartsService, Part } from '../services/device-parts.service';
import { DeviceGroupsService } from '../services/device-groups.service';
import { ConfigStore } from '../../../core/config/config.store';
import { CartService } from '../../cart/cart.service';
import { ModalController } from '@ionic/angular/standalone';
import { PartDetailModalComponent } from '../components/part-detail-modal/part-detail-modal.component';
import { Group } from '../../../shared/models/group.model';

describe('DevicePartsPage', () => {
  let component: DevicePartsPage;
  let fixture: ComponentFixture<DevicePartsPage>;
  let mockPartsService: {
    parts: Part[];
    groupPhoto: string;
    isLoading: boolean;
    load: jasmine.Spy;
    reset: jasmine.Spy;
  };
  let mockGroupsService: {
    groups: Group[];
  };
  let mockConfigStore: {
    isFeatureEnabled: jasmine.Spy;
    business: jasmine.Spy;
  };
  let mockCartService: {
    addItem: jasmine.Spy;
    itemCount: jasmine.Spy;
  };
  let mockModalController: {
    create: jasmine.Spy;
  };
  let router: Router;

  const createPart = (id: string, code: string, name: string): Part => ({ id, code, name });

  beforeEach(async () => {
    mockPartsService = {
      parts: [],
      groupPhoto: '',
      isLoading: false,
      load: jasmine.createSpy('load').and.resolveTo(undefined),
      reset: jasmine.createSpy('reset'),
    };
    mockGroupsService = {
      groups: [
        { id: 'GRP-1', name: 'Group 1', groupPhoto: 'photo1.png' },
        { id: 'GRP-2', name: 'Group 2', groupPhoto: '' },
      ],
    };
    mockConfigStore = {
      isFeatureEnabled: jasmine.createSpy('isFeatureEnabled').and.returnValue(false),
      business: jasmine.createSpy('business').and.returnValue(null),
    };
    mockCartService = {
      addItem: jasmine.createSpy('addItem'),
      itemCount: jasmine.createSpy('itemCount').and.returnValue(0),
    };
    mockModalController = {
      create: jasmine.createSpy('create').and.resolveTo({
        present: jasmine.createSpy('present'),
        onDidDismiss: jasmine.createSpy('onDidDismiss').and.resolveTo({ data: undefined, role: 'backdrop' }),
      }),
    };

    await TestBed.configureTestingModule({
      imports: [
        DevicePartsPage,
        TranslocoTestingModule.forRoot({
          langs: {
            sr: {
              device_parts_title: 'Rezervni delovi',
              device_parts_empty: 'Nema pronađenih rezervnih delova za ovaj sklop.',
            },
          },
          translocoConfig: { availableLangs: ['sr'], defaultLang: 'sr' },
          preloadLangs: true,
        }),
      ],
      providers: [
        provideRouter([]),
        { provide: DevicePartsService, useValue: mockPartsService },
        { provide: DeviceGroupsService, useValue: mockGroupsService },
        { provide: ConfigStore, useValue: mockConfigStore },
        { provide: CartService, useValue: mockCartService },
        { provide: ModalController, useValue: mockModalController },
        {
          provide: ActivatedRoute,
          useValue: {
            snapshot: {
              paramMap: {
                get: (key: string) => {
                  if (key === 'code') return 'DEV-001';
                  if (key === 'groupId') return 'GRP-1';
                  return null;
                },
              },
            },
          },
        },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(DevicePartsPage);
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
    it('should load parts with route params', () => {
      component.ionViewWillEnter();
      expect(mockPartsService.load).toHaveBeenCalledWith('DEV-001', 'GRP-1', 'photo1.png');
    });

    it('should find group photo from groups service', () => {
      component.ionViewWillEnter();
      const callArgs = mockPartsService.load.calls.mostRecent().args;
      expect(callArgs[2]).toBe('photo1.png');
    });

    it('should use empty string when group not found', async () => {
      await TestBed.resetTestingModule().configureTestingModule({
        imports: [
          DevicePartsPage,
          TranslocoTestingModule.forRoot({
            langs: { sr: { device_parts_title: 'RD', device_parts_empty: 'Nema.' } },
            translocoConfig: { availableLangs: ['sr'], defaultLang: 'sr' },
            preloadLangs: true,
          }),
        ],
        providers: [
          provideRouter([]),
          { provide: DevicePartsService, useValue: mockPartsService },
          { provide: DeviceGroupsService, useValue: { groups: [] } },
          { provide: ConfigStore, useValue: mockConfigStore },
          { provide: CartService, useValue: mockCartService },
          { provide: ModalController, useValue: mockModalController },
          {
            provide: ActivatedRoute,
            useValue: {
              snapshot: {
                paramMap: {
                  get: (key: string) => {
                    if (key === 'code') return 'DEV-001';
                    if (key === 'groupId') return 'UNKNOWN';
                    return null;
                  },
                },
              },
            },
          },
        ],
      }).compileComponents();

      const f = TestBed.createComponent(DevicePartsPage);
      f.componentInstance.ionViewWillEnter();
      const callArgs = mockPartsService.load.calls.mostRecent().args;
      expect(callArgs[2]).toBe('');
    });

    it('should use group without photo gracefully', () => {
      // Reconfigure to use GRP-2 (no photo)
      (TestBed.inject(ActivatedRoute) as any).snapshot.paramMap.get = (key: string) => {
        if (key === 'code') return 'DEV-001';
        if (key === 'groupId') return 'GRP-2';
        return null;
      };
      component.ionViewWillEnter();
      const callArgs = mockPartsService.load.calls.mostRecent().args;
      expect(callArgs[2]).toBe('');
    });
  });

  // ── onPartClick ──
  describe('onPartClick()', () => {
    it('should create modal with PartDetailModalComponent class', async () => {
      await component.onPartClick(createPart('P1', 'C1', 'Part Name'));
      expect(mockModalController.create).toHaveBeenCalledWith(jasmine.objectContaining({
        component: PartDetailModalComponent,
      }));
    });

    it('should create modal with correct props and cssClass', async () => {
      await component.onPartClick(createPart('P1', 'C1', 'Part Name'));
      expect(mockModalController.create).toHaveBeenCalledWith(jasmine.objectContaining({
        componentProps: { partCode: 'C1', partName: 'Part Name' },
        cssClass: 'card-dialog',
      }));
    });

    it('should present the modal', async () => {
      await component.onPartClick(createPart('P1', 'C1', 'Part'));
      const createdModal = await mockModalController.create.calls.mostRecent().returnValue;
      expect(createdModal.present).toHaveBeenCalled();
    });

    it('should add to cart when dismissed with add-to-cart role', async () => {
      const mockDetail = { partCode: 'C1', name: 'Part', price: 100, currency: 'EUR' };
      mockModalController.create.and.resolveTo({
        present: jasmine.createSpy('present'),
        onDidDismiss: jasmine.createSpy('onDidDismiss').and.resolveTo({ data: mockDetail, role: 'add-to-cart' }),
      });
      await component.onPartClick(createPart('P1', 'C1', 'Part'));
      expect(mockCartService.addItem).toHaveBeenCalledWith('C1', 'Part', 100, 'EUR');
    });

    it('should not add to cart when dismissed with backdrop', async () => {
      mockModalController.create.and.resolveTo({
        present: jasmine.createSpy('present'),
        onDidDismiss: jasmine.createSpy('onDidDismiss').and.resolveTo({ data: undefined, role: 'backdrop' }),
      });
      await component.onPartClick(createPart('P1', 'C1', 'Part'));
      expect(mockCartService.addItem).not.toHaveBeenCalled();
    });

    it('should not add to cart when data is undefined', async () => {
      mockModalController.create.and.resolveTo({
        present: jasmine.createSpy('present'),
        onDidDismiss: jasmine.createSpy('onDidDismiss').and.resolveTo({ data: undefined, role: 'add-to-cart' }),
      });
      await component.onPartClick(createPart('P1', 'C1', 'Part'));
      expect(mockCartService.addItem).not.toHaveBeenCalled();
    });
  });

  // ── navigateTo ──
  describe('navigateTo()', () => {
    it('should navigate to given path', () => {
      const navigateSpy = spyOn(router, 'navigate');
      component.navigateTo('/cart');
      expect(navigateSpy).toHaveBeenCalledWith(['/cart']);
    });
  });

  // ── Header template ──
  describe('header template', () => {
    it('should display translated title', () => {
      const title = fixture.nativeElement.querySelector('ion-title');
      expect(title.textContent.trim()).toBe('Rezervni delovi');
    });

    it('should have back button', () => {
      const backButton = fixture.nativeElement.querySelector('ion-back-button');
      expect(backButton).toBeTruthy();
    });

    it('should have back button defaultHref to search page', () => {
      const backButton = fixture.nativeElement.querySelector('ion-back-button');
      expect(backButton.getAttribute('defaultHref') || backButton.defaultHref).toBe('/search-by-device');
    });

    it('should have primary color toolbar', () => {
      const toolbar = fixture.nativeElement.querySelector('ion-toolbar');
      expect(toolbar.getAttribute('color')).toBe('primary');
    });
  });

  // ── Header cart button (cart feature enabled) ──
  describe('header cart button (feature enabled)', () => {
    beforeEach(() => {
      mockConfigStore.isFeatureEnabled.and.callFake((f: string) => f === 'cart');
      fixture.detectChanges();
    });

    it('should show cart button', () => {
      const cartButton = fixture.nativeElement.querySelector('ion-buttons[slot="end"] ion-button');
      expect(cartButton).toBeTruthy();
    });

    it('should show cart icon', () => {
      const icon = fixture.nativeElement.querySelector('ion-buttons[slot="end"] ion-icon');
      expect(icon).toBeTruthy();
      expect(icon.name).toBe('cart-outline');
    });

    it('should not show menu button when cart is enabled', () => {
      const menuButton = fixture.nativeElement.querySelector('ion-menu-button');
      expect(menuButton).toBeNull();
    });

    it('should not show count when cart is empty', () => {
      mockCartService.itemCount.and.returnValue(0);
      fixture.detectChanges();
      const span = fixture.nativeElement.querySelector('ion-buttons[slot="end"] span');
      expect(span).toBeNull();
    });

    it('should show count when cart has items', () => {
      mockCartService.itemCount.and.returnValue(3);
      fixture.detectChanges();
      const span = fixture.nativeElement.querySelector('ion-buttons[slot="end"] span');
      expect(span).toBeTruthy();
      expect(span.textContent.trim()).toBe('3');
    });

    it('should navigate to cart on click', () => {
      const navigateSpy = spyOn(router, 'navigate');
      const cartButton = fixture.nativeElement.querySelector('ion-buttons[slot="end"] ion-button');
      cartButton.click();
      expect(navigateSpy).toHaveBeenCalledWith(['/cart']);
    });

    it('should update cart count when items change', () => {
      mockCartService.itemCount.and.returnValue(0);
      fixture.detectChanges();
      expect(fixture.nativeElement.querySelector('ion-buttons[slot="end"] span')).toBeNull();

      mockCartService.itemCount.and.returnValue(5);
      fixture.detectChanges();
      const span = fixture.nativeElement.querySelector('ion-buttons[slot="end"] span');
      expect(span).toBeTruthy();
      expect(span.textContent.trim()).toBe('5');
    });

    it('should hide count when cart goes back to 0', () => {
      mockCartService.itemCount.and.returnValue(3);
      fixture.detectChanges();
      expect(fixture.nativeElement.querySelector('ion-buttons[slot="end"] span')).toBeTruthy();

      mockCartService.itemCount.and.returnValue(0);
      fixture.detectChanges();
      expect(fixture.nativeElement.querySelector('ion-buttons[slot="end"] span')).toBeNull();
    });
  });

  // ── Header menu button (cart feature disabled) ──
  describe('header menu button (cart disabled)', () => {
    beforeEach(() => {
      mockConfigStore.isFeatureEnabled.and.returnValue(false);
      fixture.detectChanges();
    });

    it('should show menu button', () => {
      const menuButton = fixture.nativeElement.querySelector('ion-menu-button');
      expect(menuButton).toBeTruthy();
    });

    it('should not show cart button', () => {
      const icon = fixture.nativeElement.querySelector('ion-buttons[slot="end"] ion-icon');
      expect(icon).toBeNull();
    });
  });

  // ── Loading state ──
  describe('loading state', () => {
    beforeEach(() => {
      mockPartsService.isLoading = true;
      mockPartsService.parts = [];
      fixture.detectChanges();
    });

    it('should show skeleton list', () => {
      const skeletons = fixture.nativeElement.querySelectorAll('ion-skeleton-text');
      expect(skeletons.length).toBeGreaterThan(0);
    });

    it('should show group photo skeleton', () => {
      const photoSkeleton = fixture.nativeElement.querySelector('.group-photo-skeleton');
      expect(photoSkeleton).toBeTruthy();
    });

    it('should show 5 skeleton items in list', () => {
      const items = fixture.nativeElement.querySelectorAll('ion-list ion-item');
      expect(items.length).toBe(5);
    });

    it('should not show parts', () => {
      const buttons = fixture.nativeElement.querySelectorAll('ion-item[button]');
      expect(buttons.length).toBe(0);
    });

    it('should not show empty state', () => {
      const empty = fixture.nativeElement.querySelector('.empty-state');
      expect(empty).toBeNull();
    });

    it('should not show group photo', () => {
      const photo = fixture.nativeElement.querySelector('.group-photo');
      expect(photo).toBeNull();
    });
  });

  // ── Parts list ──
  describe('parts list', () => {
    beforeEach(() => {
      mockPartsService.parts = [
        createPart('P1', 'C1', 'Kompresor klip'),
        createPart('P2', 'C2', 'Filter ulja'),
        createPart('P3', 'C3', 'Ventil'),
      ];
      mockPartsService.isLoading = false;
      (component as any).isReady = true;
      fixture.detectChanges();
    });

    it('should show part items', () => {
      const items = fixture.nativeElement.querySelectorAll('ion-item[button]');
      expect(items.length).toBe(3);
    });

    it('should display part id and name', () => {
      const label = fixture.nativeElement.querySelector('ion-item[button] ion-label');
      expect(label.textContent).toContain('P1');
      expect(label.textContent).toContain('Kompresor klip');
    });

    it('should display id - name format', () => {
      const label = fixture.nativeElement.querySelector('ion-item[button] ion-label');
      expect(label.textContent.trim()).toContain('P1 - Kompresor klip');
    });

    it('should have full lines', () => {
      const item = fixture.nativeElement.querySelector('ion-item[button]');
      expect(item.lines || item.getAttribute('lines')).toBe('full');
    });

    it('should wrap text in labels', () => {
      const label = fixture.nativeElement.querySelector('ion-label.ion-text-wrap');
      expect(label).toBeTruthy();
    });

    it('should not show skeleton', () => {
      const skeletons = fixture.nativeElement.querySelectorAll('ion-skeleton-text');
      expect(skeletons.length).toBe(0);
    });

    it('should not show empty state', () => {
      const empty = fixture.nativeElement.querySelector('.empty-state');
      expect(empty).toBeNull();
    });
  });

  // ── Group photo ──
  describe('group photo', () => {
    it('should show group photo when available', () => {
      mockPartsService.isLoading = false;
      mockPartsService.groupPhoto = 'https://cdn.example.com/photo.png';
      fixture.detectChanges();
      const photo = fixture.nativeElement.querySelector('.group-photo img');
      expect(photo).toBeTruthy();
      expect(photo.src).toContain('photo.png');
    });

    it('should not show group photo when empty', () => {
      mockPartsService.isLoading = false;
      mockPartsService.groupPhoto = '';
      fixture.detectChanges();
      const photo = fixture.nativeElement.querySelector('.group-photo');
      expect(photo).toBeNull();
    });

    it('should have alt text on photo', () => {
      mockPartsService.isLoading = false;
      mockPartsService.groupPhoto = 'https://cdn.example.com/photo.png';
      fixture.detectChanges();
      const photo = fixture.nativeElement.querySelector('.group-photo img');
      expect(photo.alt).toBe('Group photo');
    });
  });

  // ── Empty state ──
  describe('empty state', () => {
    beforeEach(() => {
      mockPartsService.parts = [];
      mockPartsService.isLoading = false;
      (component as any).isReady = true;
      fixture.detectChanges();
    });

    it('should show empty state message', () => {
      const empty = fixture.nativeElement.querySelector('.empty-state');
      expect(empty).toBeTruthy();
    });

    it('should display translated empty message', () => {
      const msg = fixture.nativeElement.querySelector('.empty-state p');
      expect(msg.textContent.trim()).toBe('Nema pronađenih rezervnih delova za ovaj sklop.');
    });

    it('should not show parts list', () => {
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
    it('should transition from loading to parts', () => {
      (component as any).isReady = false;
      mockPartsService.isLoading = true;
      mockPartsService.parts = [];
      fixture.detectChanges();
      expect(fixture.nativeElement.querySelectorAll('ion-skeleton-text').length).toBeGreaterThan(0);

      (component as any).isReady = true;
      mockPartsService.isLoading = false;
      mockPartsService.parts = [createPart('P1', 'C1', 'Part')];
      fixture.detectChanges();
      expect(fixture.nativeElement.querySelectorAll('ion-item[button]').length).toBe(1);
    });

    it('should transition from loading to empty', () => {
      (component as any).isReady = false;
      mockPartsService.isLoading = true;
      fixture.detectChanges();

      (component as any).isReady = true;
      mockPartsService.isLoading = false;
      mockPartsService.parts = [];
      fixture.detectChanges();
      expect(fixture.nativeElement.querySelector('.empty-state')).toBeTruthy();
    });
  });

  // ── Mutual exclusivity ──
  describe('mutual exclusivity', () => {
    it('loading: no parts, no empty', () => {
      (component as any).isReady = false;
      mockPartsService.isLoading = true;
      mockPartsService.parts = [];
      fixture.detectChanges();
      expect(fixture.nativeElement.querySelectorAll('ion-skeleton-text').length).toBeGreaterThan(0);
      expect(fixture.nativeElement.querySelectorAll('ion-item[button]').length).toBe(0);
      expect(fixture.nativeElement.querySelector('.empty-state')).toBeNull();
    });

    it('parts: no loading, no empty', () => {
      (component as any).isReady = true;
      mockPartsService.isLoading = false;
      mockPartsService.parts = [createPart('P1', 'C1', 'P')];
      fixture.detectChanges();
      expect(fixture.nativeElement.querySelectorAll('ion-skeleton-text').length).toBe(0);
      expect(fixture.nativeElement.querySelectorAll('ion-item[button]').length).toBe(1);
      expect(fixture.nativeElement.querySelector('.empty-state')).toBeNull();
    });

    it('empty: no loading, no parts', () => {
      (component as any).isReady = true;
      mockPartsService.isLoading = false;
      mockPartsService.parts = [];
      fixture.detectChanges();
      expect(fixture.nativeElement.querySelectorAll('ion-skeleton-text').length).toBe(0);
      expect(fixture.nativeElement.querySelectorAll('ion-item[button]').length).toBe(0);
      expect(fixture.nativeElement.querySelector('.empty-state')).toBeTruthy();
    });
  });

  // ── Special content ──
  describe('special content', () => {
    it('should display part with unicode name', () => {
      mockPartsService.parts = [createPart('P1', 'C1', 'Клапна вентила')];
      mockPartsService.isLoading = false;
      (component as any).isReady = true;
      fixture.detectChanges();
      const label = fixture.nativeElement.querySelector('ion-item[button] ion-label');
      expect(label.textContent).toContain('Клапна вентила');
    });

    it('should display many parts', () => {
      mockPartsService.parts = Array.from({ length: 50 }, (_, i) => createPart(`P${i}`, `C${i}`, `Part ${i}`));
      mockPartsService.isLoading = false;
      (component as any).isReady = true;
      fixture.detectChanges();
      const items = fixture.nativeElement.querySelectorAll('ion-item[button]');
      expect(items.length).toBe(50);
    });

    it('should show group photo alongside parts', () => {
      mockPartsService.parts = [createPart('P1', 'C1', 'Part')];
      mockPartsService.groupPhoto = 'https://cdn.example.com/photo.png';
      mockPartsService.isLoading = false;
      (component as any).isReady = true;
      fixture.detectChanges();
      const photo = fixture.nativeElement.querySelector('.group-photo');
      const items = fixture.nativeElement.querySelectorAll('ion-item[button]');
      expect(photo).toBeTruthy();
      expect(items.length).toBe(1);
    });
  });
});
