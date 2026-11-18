import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ModalController } from '@ionic/angular/standalone';
import { TranslocoTestingModule } from '@jsverse/transloco';
import { PhotoViewerComponent } from './photo-viewer.component';

describe('PhotoViewerComponent', () => {
  let fixture: ComponentFixture<PhotoViewerComponent>;
  let component: PhotoViewerComponent;
  let mockModalCtrl: jasmine.SpyObj<ModalController>;

  type ViewerState = { current: number; onSlideChange(event: Event): void; close(): void };
  const view = () => component as unknown as ViewerState;

  beforeEach(() => {
    mockModalCtrl = jasmine.createSpyObj<ModalController>('ModalController', ['dismiss']);
    mockModalCtrl.dismiss.and.resolveTo(true);

    TestBed.configureTestingModule({
      imports: [
        PhotoViewerComponent,
        TranslocoTestingModule.forRoot({ langs: { en: {} }, translocoConfig: { availableLangs: ['en'], defaultLang: 'en' } }),
      ],
      providers: [{ provide: ModalController, useValue: mockModalCtrl }],
    });
    fixture = TestBed.createComponent(PhotoViewerComponent);
    component = fixture.componentInstance;
  });

  it('starts at startIndex and shows the position in the title', () => {
    fixture.componentRef.setInput('urls', ['a', 'b', 'c']);
    fixture.componentRef.setInput('startIndex', 1);
    fixture.detectChanges();

    expect(view().current).toBe(1);
    expect((fixture.nativeElement as HTMLElement).querySelector('ion-title')?.textContent?.trim()).toBe('2 / 3');
  });

  it('initializes the swiper at the tapped photo (after setting initialSlide)', () => {
    // swiper-container is not registered in unit tests; stub its initialize() on the prototype.
    const proto = HTMLElement.prototype as unknown as { initialize?: () => void };
    let slideAtInit: unknown;
    proto.initialize = jasmine.createSpy('initialize').and.callFake(function (this: { initialSlide?: number }) {
      slideAtInit = this.initialSlide;
    });

    try {
      fixture.componentRef.setInput('urls', ['a', 'b', 'c']);
      fixture.componentRef.setInput('startIndex', 2);
      fixture.detectChanges();

      const swiper = (fixture.nativeElement as HTMLElement).querySelector('swiper-container') as unknown as {
        initialSlide?: number;
        getAttribute(name: string): string | null;
      };
      expect(swiper.getAttribute('init')).toBe('false');
      expect(proto.initialize).toHaveBeenCalledTimes(1);
      expect(slideAtInit).toBe(2);
    } finally {
      delete proto.initialize;
    }
  });

  it('renders one slide per URL', () => {
    fixture.componentRef.setInput('urls', ['a', 'b']);
    fixture.detectChanges();

    expect((fixture.nativeElement as HTMLElement).querySelectorAll('swiper-slide img').length).toBe(2);
  });

  it('follows the active slide', () => {
    fixture.componentRef.setInput('urls', ['a', 'b', 'c']);
    fixture.detectChanges();

    view().onSlideChange(new CustomEvent('swiperslidechange', { detail: [{ activeIndex: 2 }] }));

    expect(view().current).toBe(2);
  });

  it('closes the modal', () => {
    fixture.detectChanges();

    view().close();

    expect(mockModalCtrl.dismiss).toHaveBeenCalled();
  });
});
