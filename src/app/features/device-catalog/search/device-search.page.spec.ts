import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter, Router } from '@angular/router';
import { TranslocoTestingModule } from '@jsverse/transloco';
import { DeviceSearchPage } from './device-search.page';
import { DeviceSearchService } from '../services/device-search.service';
import { Device, DeviceType } from '../../../shared/models/device.model';

describe('DeviceSearchPage', () => {
  let component: DeviceSearchPage;
  let fixture: ComponentFixture<DeviceSearchPage>;
  let mockSearchService: {
    devices: Device[];
    isLoading: boolean;
    hasMore: boolean;
    keepState: boolean;
    search: jasmine.Spy;
    loadMore: jasmine.Spy;
    reset: jasmine.Spy;
  };
  let router: Router;

  const createDevice = (code: string, name: string): Device => ({
    code,
    name,
    type: DeviceType.HEAT_PUMP,
    subType: '',
    unitCount: 0,
    exists: true,
  });

  beforeEach(async () => {
    mockSearchService = {
      devices: [],
      isLoading: false,
      hasMore: false,
      keepState: false,
      search: jasmine.createSpy('search'),
      loadMore: jasmine.createSpy('loadMore'),
      reset: jasmine.createSpy('reset'),
    };

    await TestBed.configureTestingModule({
      imports: [
        DeviceSearchPage,
        TranslocoTestingModule.forRoot({
          langs: {
            sr: {
              device_search_title: 'Pretraži po uređaju',
              device_search_placeholder: 'Unesite naziv ili kod uređaja',
              device_search_load_more: 'Učitaj još',
            },
          },
          translocoConfig: { availableLangs: ['sr'], defaultLang: 'sr' },
          preloadLangs: true,
        }),
      ],
      providers: [
        provideRouter([]),
        { provide: DeviceSearchService, useValue: mockSearchService },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(DeviceSearchPage);
    component = fixture.componentInstance;
    router = TestBed.inject(Router);
    fixture.detectChanges();
  });

  // ── Creation ──
  describe('creation', () => {
    it('should create', () => {
      expect(component).toBeTruthy();
    });

    it('should inject search service', () => {
      expect((component as any).searchService).toBeDefined();
    });
  });

  // ── ionViewWillEnter ──
  describe('ionViewWillEnter', () => {
    it('should reset service when keepState is false', () => {
      mockSearchService.keepState = false;
      component.ionViewWillEnter();
      expect(mockSearchService.reset).toHaveBeenCalled();
    });

    it('should not reset when keepState is true', () => {
      mockSearchService.keepState = true;
      component.ionViewWillEnter();
      expect(mockSearchService.reset).not.toHaveBeenCalled();
    });

    it('should set keepState to false after checking', () => {
      mockSearchService.keepState = true;
      component.ionViewWillEnter();
      expect(mockSearchService.keepState).toBeFalse();
    });

    it('should not change keepState when it was already false', () => {
      mockSearchService.keepState = false;
      component.ionViewWillEnter();
      expect(mockSearchService.keepState).toBeFalse();
    });
  });

  // ── onSearchInput ──
  describe('onSearchInput()', () => {
    it('should call search with input value', () => {
      component.onSearchInput({ detail: { value: 'test device' } } as CustomEvent);
      expect(mockSearchService.search).toHaveBeenCalledWith('test device');
    });

    it('should reset when value is empty', () => {
      component.onSearchInput({ detail: { value: '' } } as CustomEvent);
      expect(mockSearchService.reset).toHaveBeenCalled();
      expect(mockSearchService.search).not.toHaveBeenCalled();
    });

    it('should reset when value is whitespace only', () => {
      component.onSearchInput({ detail: { value: '   ' } } as CustomEvent);
      expect(mockSearchService.reset).toHaveBeenCalled();
      expect(mockSearchService.search).not.toHaveBeenCalled();
    });

    it('should treat null value as empty', () => {
      component.onSearchInput({ detail: { value: null } } as any);
      expect(mockSearchService.reset).toHaveBeenCalled();
    });

    it('should treat undefined value as empty', () => {
      component.onSearchInput({ detail: {} } as any);
      expect(mockSearchService.reset).toHaveBeenCalled();
    });

    it('should pass unicode characters to search', () => {
      component.onSearchInput({ detail: { value: 'Šifra' } } as CustomEvent);
      expect(mockSearchService.search).toHaveBeenCalledWith('Šifra');
    });
  });

  // ── loadMore ──
  describe('loadMore()', () => {
    it('should call searchService.loadMore', () => {
      component.loadMore();
      expect(mockSearchService.loadMore).toHaveBeenCalled();
    });
  });

  // ── onDeviceClick ──
  describe('onDeviceClick()', () => {
    it('should set keepState to true', () => {
      spyOn(router, 'navigate');
      component.onDeviceClick('DEV1');
      expect(mockSearchService.keepState).toBeTrue();
    });

    it('should navigate to device groups page', () => {
      const navigateSpy = spyOn(router, 'navigate');
      component.onDeviceClick('DEV1');
      expect(navigateSpy).toHaveBeenCalledWith(['/device', 'DEV1', 'device-groups']);
    });

    it('should include device code in route', () => {
      const navigateSpy = spyOn(router, 'navigate');
      component.onDeviceClick('ABC-123');
      expect(navigateSpy).toHaveBeenCalledWith(['/device', 'ABC-123', 'device-groups']);
    });
  });

  // ── Header template ──
  describe('header template', () => {
    it('should display translated title', () => {
      const title = fixture.nativeElement.querySelector('ion-title');
      expect(title.textContent.trim()).toBe('Pretraži po uređaju');
    });

    it('should have back button', () => {
      const backButton = fixture.nativeElement.querySelector('ion-back-button');
      expect(backButton).toBeTruthy();
    });

    it('should have back button with defaultHref to /home', () => {
      const backButton = fixture.nativeElement.querySelector('ion-back-button');
      expect(backButton.getAttribute('defaultHref') || backButton.defaultHref).toBe('/home');
    });

    it('should have menu button', () => {
      const menuButton = fixture.nativeElement.querySelector('ion-menu-button');
      expect(menuButton).toBeTruthy();
    });

    it('should have toolbar with primary color', () => {
      const toolbar = fixture.nativeElement.querySelector('ion-toolbar');
      expect(toolbar.getAttribute('color')).toBe('primary');
    });
  });

  // ── Searchbar template ──
  describe('searchbar template', () => {
    it('should render searchbar', () => {
      const searchbar = fixture.nativeElement.querySelector('ion-searchbar');
      expect(searchbar).toBeTruthy();
    });

    it('should have translated placeholder', () => {
      const searchbar = fixture.nativeElement.querySelector('ion-searchbar');
      expect(searchbar.placeholder || searchbar.getAttribute('placeholder')).toContain('Unesite');
    });

    it('should have debounce of 300ms', () => {
      const searchbar = fixture.nativeElement.querySelector('ion-searchbar');
      const debounce = searchbar.debounce ?? searchbar.getAttribute('debounce');
      expect(String(debounce)).toBe('300');
    });
  });

  // ── Loading state (initial, no devices) ──
  describe('loading state (initial search)', () => {
    beforeEach(() => {
      mockSearchService.isLoading = true;
      mockSearchService.devices = [];
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

    it('should have animated skeleton text', () => {
      const skeleton = fixture.nativeElement.querySelector('ion-skeleton-text');
      expect(skeleton.animated).toBeTrue();
    });

    it('should not show load more button', () => {
      const button = fixture.nativeElement.querySelector('.load-more-button');
      expect(button).toBeNull();
    });

    it('should not show device items', () => {
      const buttons = fixture.nativeElement.querySelectorAll('ion-item[button]');
      expect(buttons.length).toBe(0);
    });
  });

  // ── Devices list ──
  describe('devices list', () => {
    beforeEach(() => {
      mockSearchService.devices = [
        createDevice('D1', 'Device One'),
        createDevice('D2', 'Device Two'),
        createDevice('D3', 'Device Three'),
      ];
      mockSearchService.isLoading = false;
      fixture.detectChanges();
    });

    it('should show device items', () => {
      const items = fixture.nativeElement.querySelectorAll('ion-item[button]');
      expect(items.length).toBe(3);
    });

    it('should display device name', () => {
      const labels = fixture.nativeElement.querySelectorAll('ion-label');
      expect(labels[0].textContent).toContain('Device One');
    });

    it('should display device code', () => {
      const codes = fixture.nativeElement.querySelectorAll('.device-code');
      expect(codes[0].textContent).toContain('D1');
    });

    it('should display "Code:" prefix', () => {
      const codes = fixture.nativeElement.querySelectorAll('.device-code');
      expect(codes[0].textContent).toContain('Code:');
    });

    it('should have detail arrow on items', () => {
      const item = fixture.nativeElement.querySelector('ion-item[button]');
      expect(item.detail).toBeTrue();
    });

    it('should have full lines', () => {
      const item = fixture.nativeElement.querySelector('ion-item[button]');
      expect(item.lines || item.getAttribute('lines')).toBe('full');
    });

    it('should not show skeleton loading', () => {
      const skeletons = fixture.nativeElement.querySelectorAll('ion-skeleton-text');
      expect(skeletons.length).toBe(0);
    });

    it('should navigate on device click', () => {
      const navigateSpy = spyOn(router, 'navigate');
      const item = fixture.nativeElement.querySelector('ion-item[button]');
      item.click();
      expect(navigateSpy).toHaveBeenCalledWith(['/device', 'D1', 'device-groups']);
    });

    it('should wrap text in labels', () => {
      const label = fixture.nativeElement.querySelector('ion-label.ion-text-wrap');
      expect(label).toBeTruthy();
    });
  });

  // ── Load more button ──
  describe('load more button', () => {
    it('should show when hasMore is true and not loading', () => {
      mockSearchService.devices = [createDevice('D1', 'Dev')];
      mockSearchService.hasMore = true;
      mockSearchService.isLoading = false;
      fixture.detectChanges();
      const button = fixture.nativeElement.querySelector('.load-more-button');
      expect(button).toBeTruthy();
    });

    it('should not show when hasMore is false', () => {
      mockSearchService.devices = [createDevice('D1', 'Dev')];
      mockSearchService.hasMore = false;
      mockSearchService.isLoading = false;
      fixture.detectChanges();
      const button = fixture.nativeElement.querySelector('.load-more-button');
      expect(button).toBeNull();
    });

    it('should not show when loading', () => {
      mockSearchService.devices = [createDevice('D1', 'Dev')];
      mockSearchService.hasMore = true;
      mockSearchService.isLoading = true;
      fixture.detectChanges();
      const button = fixture.nativeElement.querySelector('.load-more-button');
      expect(button).toBeNull();
    });

    it('should display translated text', () => {
      mockSearchService.devices = [createDevice('D1', 'Dev')];
      mockSearchService.hasMore = true;
      fixture.detectChanges();
      const button = fixture.nativeElement.querySelector('.load-more-button');
      expect(button.textContent.trim()).toBe('Učitaj još');
    });

    it('should call loadMore on click', () => {
      mockSearchService.devices = [createDevice('D1', 'Dev')];
      mockSearchService.hasMore = true;
      fixture.detectChanges();
      const button = fixture.nativeElement.querySelector('.load-more-button');
      button.click();
      expect(mockSearchService.loadMore).toHaveBeenCalled();
    });

    it('should have outline fill', () => {
      mockSearchService.devices = [createDevice('D1', 'Dev')];
      mockSearchService.hasMore = true;
      fixture.detectChanges();
      const button = fixture.nativeElement.querySelector('.load-more-button');
      expect(button.fill || button.getAttribute('fill')).toBe('outline');
    });
  });

  // ── Loading more (devices exist + isLoading) ──
  describe('loading more (pagination skeleton)', () => {
    beforeEach(() => {
      mockSearchService.devices = [createDevice('D1', 'Existing Device')];
      mockSearchService.isLoading = true;
      fixture.detectChanges();
    });

    it('should show existing devices', () => {
      const items = fixture.nativeElement.querySelectorAll('ion-item[button]');
      expect(items.length).toBe(1);
    });

    it('should show pagination skeletons', () => {
      const skeletons = fixture.nativeElement.querySelectorAll('ion-skeleton-text');
      expect(skeletons.length).toBeGreaterThan(0);
    });

    it('should show 3 pagination skeleton items', () => {
      // The second ion-list has 3 skeleton items
      const lists = fixture.nativeElement.querySelectorAll('ion-list');
      expect(lists.length).toBe(2); // devices list + skeleton list
      const skeletonItems = lists[1].querySelectorAll('ion-item');
      expect(skeletonItems.length).toBe(3);
    });

    it('should not show initial skeleton (5 items)', () => {
      // First list should have 1 device, second list should have 3 skeletons
      const lists = fixture.nativeElement.querySelectorAll('ion-list');
      const firstListItems = lists[0].querySelectorAll('ion-item');
      expect(firstListItems.length).toBe(1);
    });
  });

  // ── Empty state (no results, not loading) ──
  describe('empty state', () => {
    it('should not show any list when no devices and not loading', () => {
      mockSearchService.devices = [];
      mockSearchService.isLoading = false;
      fixture.detectChanges();
      const lists = fixture.nativeElement.querySelectorAll('ion-list');
      expect(lists.length).toBe(0);
    });

    it('should not show load more button when empty', () => {
      mockSearchService.devices = [];
      mockSearchService.isLoading = false;
      fixture.detectChanges();
      const button = fixture.nativeElement.querySelector('.load-more-button');
      expect(button).toBeNull();
    });
  });

  // ── State transitions ──
  describe('state transitions', () => {
    it('should transition from empty to loading', () => {
      mockSearchService.isLoading = false;
      mockSearchService.devices = [];
      fixture.detectChanges();
      let skeletons = fixture.nativeElement.querySelectorAll('ion-skeleton-text');
      expect(skeletons.length).toBe(0);

      mockSearchService.isLoading = true;
      fixture.detectChanges();
      skeletons = fixture.nativeElement.querySelectorAll('ion-skeleton-text');
      expect(skeletons.length).toBeGreaterThan(0);
    });

    it('should transition from loading to results', () => {
      mockSearchService.isLoading = true;
      mockSearchService.devices = [];
      fixture.detectChanges();

      mockSearchService.isLoading = false;
      mockSearchService.devices = [createDevice('D1', 'Dev')];
      fixture.detectChanges();
      const items = fixture.nativeElement.querySelectorAll('ion-item[button]');
      expect(items.length).toBe(1);
    });

    it('should transition from results to loading more', () => {
      mockSearchService.devices = [createDevice('D1', 'Dev')];
      mockSearchService.isLoading = false;
      fixture.detectChanges();

      mockSearchService.isLoading = true;
      fixture.detectChanges();
      const skeletons = fixture.nativeElement.querySelectorAll('ion-skeleton-text');
      expect(skeletons.length).toBeGreaterThan(0);
    });

    it('should show results and load more button together', () => {
      mockSearchService.devices = [createDevice('D1', 'Dev')];
      mockSearchService.hasMore = true;
      mockSearchService.isLoading = false;
      fixture.detectChanges();

      const items = fixture.nativeElement.querySelectorAll('ion-item[button]');
      const button = fixture.nativeElement.querySelector('.load-more-button');
      expect(items.length).toBe(1);
      expect(button).toBeTruthy();
    });
  });

  // ── Special content ──
  describe('special content', () => {
    it('should display device with long name', () => {
      mockSearchService.devices = [createDevice('D1', 'A'.repeat(200))];
      fixture.detectChanges();
      const label = fixture.nativeElement.querySelector('ion-label');
      expect(label.textContent).toContain('A'.repeat(200));
    });

    it('should display device with unicode name', () => {
      mockSearchService.devices = [createDevice('D1', 'Топлотна пумпа')];
      fixture.detectChanges();
      const label = fixture.nativeElement.querySelector('ion-label');
      expect(label.textContent).toContain('Топлотна пумпа');
    });

    it('should display device with special characters in code', () => {
      mockSearchService.devices = [createDevice('D-001/A', 'Dev')];
      fixture.detectChanges();
      const code = fixture.nativeElement.querySelector('.device-code');
      expect(code.textContent).toContain('D-001/A');
    });

    it('should handle many devices', () => {
      mockSearchService.devices = Array.from({ length: 50 }, (_, i) => createDevice(`D${i}`, `Device ${i}`));
      fixture.detectChanges();
      const items = fixture.nativeElement.querySelectorAll('ion-item[button]');
      expect(items.length).toBe(50);
    });
  });

  // ── ionInput from DOM element ──
  describe('ionInput from DOM', () => {
    it('should trigger search when ionInput fires on searchbar', () => {
      const searchbar = fixture.nativeElement.querySelector('ion-searchbar');
      const event = new CustomEvent('ionInput', { detail: { value: 'test' } });
      searchbar.dispatchEvent(event);
      expect(mockSearchService.search).toHaveBeenCalledWith('test');
    });

    it('should trigger reset when ionInput fires with empty value', () => {
      const searchbar = fixture.nativeElement.querySelector('ion-searchbar');
      const event = new CustomEvent('ionInput', { detail: { value: '' } });
      searchbar.dispatchEvent(event);
      expect(mockSearchService.reset).toHaveBeenCalled();
    });
  });

  // ── Multiple device clicks ──
  describe('multiple interactions', () => {
    it('should navigate to different devices on consecutive clicks', () => {
      const navigateSpy = spyOn(router, 'navigate');
      mockSearchService.devices = [createDevice('D1', 'First'), createDevice('D2', 'Second')];
      fixture.detectChanges();

      const items = fixture.nativeElement.querySelectorAll('ion-item[button]');
      items[0].click();
      expect(navigateSpy).toHaveBeenCalledWith(['/device', 'D1', 'device-groups']);

      items[1].click();
      expect(navigateSpy).toHaveBeenCalledWith(['/device', 'D2', 'device-groups']);
    });

    it('should set keepState for each click', () => {
      spyOn(router, 'navigate');
      mockSearchService.devices = [createDevice('D1', 'First')];
      fixture.detectChanges();

      mockSearchService.keepState = false;
      const item = fixture.nativeElement.querySelector('ion-item[button]');
      item.click();
      expect(mockSearchService.keepState).toBeTrue();
    });
  });
});
