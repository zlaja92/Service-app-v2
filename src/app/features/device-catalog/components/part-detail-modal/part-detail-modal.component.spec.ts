import { ComponentFixture, TestBed } from '@angular/core/testing';
import { TranslocoTestingModule } from '@jsverse/transloco';
import { PartDetailModalComponent } from './part-detail-modal.component';
import { PartDetailService, PartDetail } from '../../services/part-detail.service';
import { ConfigStore } from '../../../../core/config/config.store';
import { ModalController } from '@ionic/angular/standalone';

describe('PartDetailModalComponent', () => {
  let component: PartDetailModalComponent;
  let fixture: ComponentFixture<PartDetailModalComponent>;
  let mockPartDetailService: {
    loadPartDetail: jasmine.Spy;
  };
  let mockConfigStore: {
    isFeatureEnabled: jasmine.Spy;
    business: jasmine.Spy;
  };
  let mockModalController: {
    dismiss: jasmine.Spy;
  };

  const createDetail = (overrides: Partial<PartDetail> = {}): PartDetail => ({
    partCode: 'P1',
    name: 'Part Name',
    price: 100,
    currency: 'EUR',
    showPhoto: false,
    photoUrl: '',
    ...overrides,
  });

  beforeEach(async () => {
    mockPartDetailService = {
      loadPartDetail: jasmine.createSpy('loadPartDetail').and.resolveTo(createDetail()),
    };
    mockConfigStore = {
      isFeatureEnabled: jasmine.createSpy('isFeatureEnabled').and.returnValue(false),
      business: jasmine.createSpy('business').and.returnValue(null),
    };
    mockModalController = {
      dismiss: jasmine.createSpy('dismiss'),
    };

    await TestBed.configureTestingModule({
      imports: [
        PartDetailModalComponent,
        TranslocoTestingModule.forRoot({
          langs: {
            sr: {
              part_detail_code: 'Kod',
              part_detail_price: 'Cena',
              part_detail_price_unavailable: 'Cena nije dostupna',
              part_detail_add_to_cart: 'Dodaj u korpu',
              part_detail_close: 'Zatvori',
            },
          },
          translocoConfig: { availableLangs: ['sr'], defaultLang: 'sr' },
          preloadLangs: true,
        }),
      ],
      providers: [
        { provide: PartDetailService, useValue: mockPartDetailService },
        { provide: ConfigStore, useValue: mockConfigStore },
        { provide: ModalController, useValue: mockModalController },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(PartDetailModalComponent);
    component = fixture.componentInstance;
    component.partName = 'Test Part';
    component.partCode = 'TP-001';
  });

  // ── Creation ──
  describe('creation', () => {
    it('should create', () => {
      expect(component).toBeTruthy();
    });

    it('should accept partName input', () => {
      expect(component.partName).toBe('Test Part');
    });

    it('should accept partCode input', () => {
      expect(component.partCode).toBe('TP-001');
    });

    it('should start with isLoading true', () => {
      expect(component.isLoading).toBeTrue();
    });

    it('should start with detail null', () => {
      expect(component.detail).toBeNull();
    });
  });

  // ── ngOnInit ──
  describe('ngOnInit', () => {
    it('should call loadPartDetail with inputs', async () => {
      await component.ngOnInit();
      expect(mockPartDetailService.loadPartDetail).toHaveBeenCalledWith('TP-001', 'Test Part');
    });

    it('should set detail after loading', async () => {
      const detail = createDetail({ partCode: 'TP-001', name: 'Test Part' });
      mockPartDetailService.loadPartDetail.and.resolveTo(detail);
      await component.ngOnInit();
      expect(component.detail).toEqual(detail);
    });

    it('should set isLoading to false after loading', async () => {
      await component.ngOnInit();
      expect(component.isLoading).toBeFalse();
    });

    it('should handle null response from service', async () => {
      mockPartDetailService.loadPartDetail.and.resolveTo(null as any);
      await component.ngOnInit();
      expect(component.detail).toBeNull();
      expect(component.isLoading).toBeFalse();
    });
  });

  // ── addToCart ──
  describe('addToCart()', () => {
    it('should dismiss modal with detail and add-to-cart role', async () => {
      const detail = createDetail();
      mockPartDetailService.loadPartDetail.and.resolveTo(detail);
      await component.ngOnInit();
      component.addToCart();
      expect(mockModalController.dismiss).toHaveBeenCalledWith(detail, 'add-to-cart');
    });
  });

  // ── dismiss ──
  describe('dismiss()', () => {
    it('should dismiss modal without data', () => {
      component.dismiss();
      expect(mockModalController.dismiss).toHaveBeenCalledWith();
    });
  });

  // ── Template: Loading state ──
  describe('template: loading state', () => {
    beforeEach(() => {
      component.isLoading = true;
      component.detail = null;
      fixture.detectChanges();
    });

    it('should show header with part name', () => {
      const header = fixture.nativeElement.querySelector('.dialog-header h2');
      expect(header.textContent.trim()).toBe('Test Part');
    });

    it('should show skeleton texts', () => {
      const skeletons = fixture.nativeElement.querySelectorAll('ion-skeleton-text');
      expect(skeletons.length).toBe(2);
    });

    it('should show code label', () => {
      const labels = fixture.nativeElement.querySelectorAll('.label');
      expect(labels[0].textContent.trim()).toBe('Kod');
    });

    it('should show price label', () => {
      const labels = fixture.nativeElement.querySelectorAll('.label');
      expect(labels[1].textContent.trim()).toBe('Cena');
    });

    it('should show close button', () => {
      const buttons = fixture.nativeElement.querySelectorAll('ion-button');
      const closeBtn = Array.from(buttons).find((b: any) => b.textContent.includes('Zatvori'));
      expect(closeBtn).toBeTruthy();
    });

    it('should not show part code value', () => {
      const values = fixture.nativeElement.querySelectorAll('.value');
      expect(values.length).toBe(0);
    });
  });

  // ── Template: Detail loaded with price ──
  describe('template: detail with price', () => {
    beforeEach(async () => {
      mockPartDetailService.loadPartDetail.and.resolveTo(
        createDetail({ partCode: 'TP-001', price: 150, currency: 'RSD' }),
      );
      await component.ngOnInit();
      fixture.detectChanges();
    });

    it('should display part name in header', () => {
      const header = fixture.nativeElement.querySelector('.dialog-header h2');
      expect(header.textContent.trim()).toBe('Test Part');
    });

    it('should display part code', () => {
      const values = fixture.nativeElement.querySelectorAll('.value');
      expect(values[0].textContent.trim()).toBe('TP-001');
    });

    it('should display price with currency', () => {
      const values = fixture.nativeElement.querySelectorAll('.value');
      expect(values[1].textContent.trim()).toBe('150 RSD');
    });

    it('should not show skeleton texts', () => {
      const skeletons = fixture.nativeElement.querySelectorAll('ion-skeleton-text');
      expect(skeletons.length).toBe(0);
    });

    it('should show code label', () => {
      const labels = fixture.nativeElement.querySelectorAll('.label');
      expect(labels[0].textContent.trim()).toBe('Kod');
    });

    it('should show price label', () => {
      const labels = fixture.nativeElement.querySelectorAll('.label');
      expect(labels[1].textContent.trim()).toBe('Cena');
    });
  });

  // ── Template: Detail with null price ──
  describe('template: null price', () => {
    beforeEach(async () => {
      mockPartDetailService.loadPartDetail.and.resolveTo(
        createDetail({ price: null }),
      );
      await component.ngOnInit();
      fixture.detectChanges();
    });

    it('should show price unavailable message', () => {
      const muted = fixture.nativeElement.querySelector('.value.muted');
      expect(muted).toBeTruthy();
      expect(muted.textContent.trim()).toBe('Cena nije dostupna');
    });
  });

  // ── Template: Cart button (cart feature enabled) ──
  describe('template: cart button (enabled)', () => {
    beforeEach(async () => {
      mockConfigStore.isFeatureEnabled.and.callFake((f: string) => f === 'cart');
      mockPartDetailService.loadPartDetail.and.resolveTo(createDetail());
      await component.ngOnInit();
      fixture.detectChanges();
    });

    it('should show add to cart button', () => {
      const buttons = fixture.nativeElement.querySelectorAll('ion-button');
      const cartBtn = Array.from(buttons).find((b: any) => b.textContent.includes('Dodaj u korpu'));
      expect(cartBtn).toBeTruthy();
    });

    it('should show close button', () => {
      const buttons = fixture.nativeElement.querySelectorAll('ion-button');
      const closeBtn = Array.from(buttons).find((b: any) => b.textContent.includes('Zatvori'));
      expect(closeBtn).toBeTruthy();
    });

    it('should call addToCart on button click', async () => {
      spyOn(component, 'addToCart');
      const buttons = fixture.nativeElement.querySelectorAll('ion-button');
      const cartBtn: any = Array.from(buttons).find((b: any) => b.textContent.includes('Dodaj u korpu'));
      cartBtn.click();
      expect(component.addToCart).toHaveBeenCalled();
    });

    it('should call dismiss on close button click', () => {
      spyOn(component, 'dismiss');
      const buttons = fixture.nativeElement.querySelectorAll('ion-button');
      const closeBtn: any = Array.from(buttons).find((b: any) => b.textContent.includes('Zatvori'));
      closeBtn.click();
      expect(component.dismiss).toHaveBeenCalled();
    });
  });

  // ── Template: Cart button (cart feature disabled) ──
  describe('template: cart button (disabled)', () => {
    beforeEach(async () => {
      mockConfigStore.isFeatureEnabled.and.returnValue(false);
      mockPartDetailService.loadPartDetail.and.resolveTo(createDetail());
      await component.ngOnInit();
      fixture.detectChanges();
    });

    it('should not show add to cart button', () => {
      const buttons = fixture.nativeElement.querySelectorAll('ion-button');
      const cartBtn = Array.from(buttons).find((b: any) => b.textContent.includes('Dodaj u korpu'));
      expect(cartBtn).toBeFalsy();
    });

    it('should show close button only', () => {
      const buttons = fixture.nativeElement.querySelectorAll('ion-button');
      expect(buttons.length).toBe(1);
      expect(buttons[0].textContent).toContain('Zatvori');
    });
  });

  // ── Template: Part photo (partPhoto feature enabled) ──
  describe('template: part photo (enabled)', () => {
    beforeEach(async () => {
      mockConfigStore.isFeatureEnabled.and.callFake((f: string) => f === 'partPhoto' || f === 'cart');
      mockPartDetailService.loadPartDetail.and.resolveTo(
        createDetail({ showPhoto: true, photoUrl: 'https://cdn.example.com/part.jpg' }),
      );
      await component.ngOnInit();
      fixture.detectChanges();
    });

    it('should show part photo', () => {
      const photo = fixture.nativeElement.querySelector('.part-photo img');
      expect(photo).toBeTruthy();
    });

    it('should have correct src', () => {
      const photo = fixture.nativeElement.querySelector('.part-photo img');
      expect(photo.src).toContain('part.jpg');
    });

    it('should have alt text matching part name', () => {
      const photo = fixture.nativeElement.querySelector('.part-photo img');
      expect(photo.alt).toBe('Test Part');
    });
  });

  // ── Template: Part photo (feature disabled or no URL) ──
  describe('template: part photo (disabled/no URL)', () => {
    it('should not show photo when feature disabled', async () => {
      mockConfigStore.isFeatureEnabled.and.returnValue(false);
      mockPartDetailService.loadPartDetail.and.resolveTo(
        createDetail({ showPhoto: false, photoUrl: '' }),
      );
      await component.ngOnInit();
      fixture.detectChanges();
      const photo = fixture.nativeElement.querySelector('.part-photo');
      expect(photo).toBeNull();
    });

    it('should not show photo when photoUrl is empty', async () => {
      mockConfigStore.isFeatureEnabled.and.callFake((f: string) => f === 'partPhoto');
      mockPartDetailService.loadPartDetail.and.resolveTo(
        createDetail({ showPhoto: true, photoUrl: '' }),
      );
      await component.ngOnInit();
      fixture.detectChanges();
      const photo = fixture.nativeElement.querySelector('.part-photo');
      expect(photo).toBeNull();
    });
  });

  // ── Template: Part note ──
  describe('template: part note', () => {
    it('should show part note when business config has partNote', async () => {
      mockConfigStore.business.and.returnValue({ partNote: 'Cene su informativnog karaktera.' });
      mockPartDetailService.loadPartDetail.and.resolveTo(createDetail());
      await component.ngOnInit();
      fixture.detectChanges();
      const note = fixture.nativeElement.querySelector('.part-note');
      expect(note).toBeTruthy();
      expect(note.textContent.trim()).toBe('Cene su informativnog karaktera.');
    });

    it('should not show part note when partNote is empty', async () => {
      mockConfigStore.business.and.returnValue({ partNote: '' });
      mockPartDetailService.loadPartDetail.and.resolveTo(createDetail());
      await component.ngOnInit();
      fixture.detectChanges();
      const note = fixture.nativeElement.querySelector('.part-note');
      expect(note).toBeNull();
    });

    it('should not show part note when business is null', async () => {
      mockConfigStore.business.and.returnValue(null);
      mockPartDetailService.loadPartDetail.and.resolveTo(createDetail());
      await component.ngOnInit();
      fixture.detectChanges();
      const note = fixture.nativeElement.querySelector('.part-note');
      expect(note).toBeNull();
    });
  });

  // ── Template: Dialog structure ──
  describe('template: dialog structure', () => {
    beforeEach(async () => {
      mockPartDetailService.loadPartDetail.and.resolveTo(createDetail());
      await component.ngOnInit();
      fixture.detectChanges();
    });

    it('should have dialog container', () => {
      const dialog = fixture.nativeElement.querySelector('.dialog');
      expect(dialog).toBeTruthy();
    });

    it('should have dialog header', () => {
      const header = fixture.nativeElement.querySelector('.dialog-header');
      expect(header).toBeTruthy();
    });

    it('should have dialog body', () => {
      const body = fixture.nativeElement.querySelector('.dialog-body');
      expect(body).toBeTruthy();
    });

    it('should have dialog footer', () => {
      const footer = fixture.nativeElement.querySelector('.dialog-footer');
      expect(footer).toBeTruthy();
    });

    it('should have 2 detail rows', () => {
      const rows = fixture.nativeElement.querySelectorAll('.detail-row');
      expect(rows.length).toBe(2);
    });
  });

  // ── Special content ──
  describe('special content', () => {
    it('should display unicode part name', async () => {
      component.partName = 'Компресор';
      mockPartDetailService.loadPartDetail.and.resolveTo(createDetail());
      await component.ngOnInit();
      fixture.detectChanges();
      const header = fixture.nativeElement.querySelector('.dialog-header h2');
      expect(header.textContent.trim()).toBe('Компресор');
    });

    it('should display long part name', async () => {
      component.partName = 'A'.repeat(200);
      mockPartDetailService.loadPartDetail.and.resolveTo(createDetail());
      await component.ngOnInit();
      fixture.detectChanges();
      const header = fixture.nativeElement.querySelector('.dialog-header h2');
      expect(header.textContent.trim()).toBe('A'.repeat(200));
    });

    it('should display price of 0', async () => {
      mockPartDetailService.loadPartDetail.and.resolveTo(
        createDetail({ price: 0, currency: 'EUR' }),
      );
      await component.ngOnInit();
      fixture.detectChanges();
      const values = fixture.nativeElement.querySelectorAll('.value');
      expect(values[1].textContent.trim()).toBe('0 EUR');
    });

    it('should display decimal price', async () => {
      mockPartDetailService.loadPartDetail.and.resolveTo(
        createDetail({ price: 99.99, currency: 'RSD' }),
      );
      await component.ngOnInit();
      fixture.detectChanges();
      const values = fixture.nativeElement.querySelectorAll('.value');
      expect(values[1].textContent.trim()).toBe('99.99 RSD');
    });

    it('should display large price', async () => {
      mockPartDetailService.loadPartDetail.and.resolveTo(
        createDetail({ price: 999999, currency: 'EUR' }),
      );
      await component.ngOnInit();
      fixture.detectChanges();
      const values = fixture.nativeElement.querySelectorAll('.value');
      expect(values[1].textContent).toContain('999999');
    });
  });

  // ── State transitions ──
  describe('state transitions', () => {
    it('should transition from loading to loaded', async () => {
      fixture.detectChanges();
      expect(fixture.nativeElement.querySelectorAll('ion-skeleton-text').length).toBe(2);

      mockPartDetailService.loadPartDetail.and.resolveTo(createDetail());
      await component.ngOnInit();
      fixture.detectChanges();
      expect(fixture.nativeElement.querySelectorAll('ion-skeleton-text').length).toBe(0);
      expect(fixture.nativeElement.querySelectorAll('.value').length).toBe(2);
    });
  });
});
