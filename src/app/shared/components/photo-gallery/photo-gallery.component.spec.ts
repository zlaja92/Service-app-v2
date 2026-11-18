import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ModalController } from '@ionic/angular/standalone';
import { TranslocoTestingModule } from '@jsverse/transloco';
import { PhotoGalleryComponent } from './photo-gallery.component';
import { PhotoViewerComponent } from './photo-viewer.component';

describe('PhotoGalleryComponent', () => {
  let fixture: ComponentFixture<PhotoGalleryComponent>;
  let component: PhotoGalleryComponent;
  let mockModalCtrl: jasmine.SpyObj<ModalController>;
  let mockModal: jasmine.SpyObj<HTMLIonModalElement>;

  beforeEach(() => {
    mockModal = jasmine.createSpyObj<HTMLIonModalElement>('HTMLIonModalElement', ['present']);
    mockModal.present.and.resolveTo();
    mockModalCtrl = jasmine.createSpyObj<ModalController>('ModalController', ['create']);
    mockModalCtrl.create.and.resolveTo(mockModal);

    TestBed.configureTestingModule({
      imports: [
        PhotoGalleryComponent,
        TranslocoTestingModule.forRoot({ langs: { en: {} }, translocoConfig: { availableLangs: ['en'], defaultLang: 'en' } }),
      ],
      providers: [{ provide: ModalController, useValue: mockModalCtrl }],
    });
    fixture = TestBed.createComponent(PhotoGalleryComponent);
    component = fixture.componentInstance;
  });

  function render(urls: (string | null)[], loading = false, count = 0): HTMLElement {
    fixture.componentRef.setInput('urls', urls);
    fixture.componentRef.setInput('loading', loading);
    fixture.componentRef.setInput('count', count);
    fixture.detectChanges();
    return fixture.nativeElement as HTMLElement;
  }

  it('renders one thumbnail per URL', () => {
    const el = render(['https://u/a.jpg', 'https://u/b.jpg']);

    const imgs = el.querySelectorAll('img');
    expect(imgs.length).toBe(2);
    expect(imgs[0].getAttribute('src')).toBe('https://u/a.jpg');
  });

  it('renders a placeholder for a photo that could not be resolved', () => {
    const el = render(['https://u/a.jpg', null]);

    expect(el.querySelectorAll('img').length).toBe(1);
    expect(el.querySelectorAll('.tile-missing').length).toBe(1);
  });

  it('renders `count` skeleton tiles while loading', () => {
    const el = render([], true, 3);

    expect(el.querySelectorAll('ion-skeleton-text').length).toBe(3);
    expect(el.querySelectorAll('img').length).toBe(0);
  });

  it('opens the viewer with the resolvable photos, starting at the tapped one', async () => {
    render(['https://u/a.jpg', null, 'https://u/c.jpg']);

    await component.open(2);

    expect(mockModalCtrl.create).toHaveBeenCalledWith(jasmine.objectContaining({
      component: PhotoViewerComponent,
      componentProps: { urls: ['https://u/a.jpg', 'https://u/c.jpg'], startIndex: 1 },
    }));
    expect(mockModal.present).toHaveBeenCalled();
  });

  it('does not open the viewer for a missing photo', async () => {
    render(['https://u/a.jpg', null]);

    await component.open(1);

    expect(mockModalCtrl.create).not.toHaveBeenCalled();
  });
});
