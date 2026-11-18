import { ChangeDetectionStrategy, Component, Input, inject } from '@angular/core';
import { IonIcon, IonSkeletonText, ModalController } from '@ionic/angular/standalone';
import { addIcons } from 'ionicons';
import { imageOutline } from 'ionicons/icons';
import { TranslocoModule } from '@jsverse/transloco';
import { PhotoViewerComponent } from './photo-viewer.component';

/**
 * Generic thumbnail grid. A tap opens the full-screen PhotoViewerComponent.
 *
 * - `urls`: photo URLs in display order; null = the photo could not be resolved
 *   (shown as a placeholder and left out of the viewer).
 * - `loading` + `count`: shows `count` skeleton tiles while the URLs are resolved.
 */
@Component({
  selector: 'app-photo-gallery',
  templateUrl: './photo-gallery.component.html',
  styleUrls: ['./photo-gallery.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [IonIcon, IonSkeletonText, TranslocoModule],
})
export class PhotoGalleryComponent {
  private readonly modalCtrl = inject(ModalController);

  @Input() urls: (string | null)[] = [];
  @Input() loading = false;
  /** Number of skeleton tiles while loading. */
  @Input() count = 0;

  constructor() {
    addIcons({ imageOutline });
  }

  protected get skeletons(): number[] {
    return Array.from({ length: this.count }, (_, i) => i);
  }

  async open(index: number): Promise<void> {
    const url = this.urls[index];
    if (!url) return;

    // The viewer shows only resolvable photos; map the tapped tile to its index there.
    const viewable = this.urls.filter((u): u is string => !!u);
    const modal = await this.modalCtrl.create({
      component: PhotoViewerComponent,
      componentProps: { urls: viewable, startIndex: viewable.indexOf(url) },
      cssClass: 'fullscreen-modal',
    });
    await modal.present();
  }
}
