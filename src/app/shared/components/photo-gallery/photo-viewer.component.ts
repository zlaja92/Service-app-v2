import {
  AfterViewInit, ChangeDetectionStrategy, Component, CUSTOM_ELEMENTS_SCHEMA, ElementRef, Input, OnInit, ViewChild, inject,
} from '@angular/core';
import {
  IonHeader, IonToolbar, IonTitle, IonButtons, IonButton, IonIcon, IonContent,
  ModalController,
} from '@ionic/angular/standalone';
import { addIcons } from 'ionicons';
import { closeOutline } from 'ionicons/icons';
import { TranslocoModule } from '@jsverse/transloco';

/** The swiper-container element API used here (Swiper element, registered in main.ts). */
type SwiperContainerElement = HTMLElement & { initialize?: () => void };

/**
 * Generic full-screen photo viewer, opened as a modal by PhotoGalleryComponent.
 * Swipe between photos; pinch or double-tap to zoom (Swiper element, registered
 * in main.ts). Knows nothing about where the photos come from — only URLs.
 */
@Component({
  selector: 'app-photo-viewer',
  templateUrl: './photo-viewer.component.html',
  styleUrls: ['./photo-viewer.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    IonHeader, IonToolbar, IonTitle, IonButtons, IonButton, IonIcon, IonContent,
    TranslocoModule,
  ],
  schemas: [CUSTOM_ELEMENTS_SCHEMA],
})
export class PhotoViewerComponent implements OnInit, AfterViewInit {
  private readonly modalCtrl = inject(ModalController);

  /** Photo URLs to show. */
  @Input() urls: string[] = [];
  /** Index of the photo shown first. */
  @Input() startIndex = 0;

  @ViewChild('swiper', { static: true }) private swiperRef?: ElementRef<SwiperContainerElement>;

  protected current = 0;

  constructor() {
    addIcons({ closeOutline });
  }

  ngOnInit(): void {
    this.current = this.startIndex;
  }

  ngAfterViewInit(): void {
    // swiper-container reads its options when it initializes. With auto-init it
    // initializes on insertion, before Angular binds attributes, and always
    // starts at the first photo — so it is initialized here, after the options.
    const el = this.swiperRef?.nativeElement;
    if (!el) return;
    Object.assign(el, { initialSlide: this.startIndex, zoom: true });
    el.initialize?.();
  }

  protected onSlideChange(event: Event): void {
    // swiper-container emits 'swiperslidechange' with [swiper] as the detail.
    const swiper = (event as CustomEvent<[{ activeIndex: number }]>).detail?.[0];
    if (swiper) this.current = swiper.activeIndex;
  }

  protected close(): void {
    void this.modalCtrl.dismiss();
  }
}
