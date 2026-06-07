import { AfterViewInit, Component, ElementRef, OnDestroy, ViewChild, inject } from '@angular/core';
import {
  IonHeader, IonToolbar, IonTitle, IonButtons, IonButton, IonContent, IonIcon,
  ModalController, ToastController,
} from '@ionic/angular/standalone';
import { addIcons } from 'ionicons';
import { arrowBackOutline } from 'ionicons/icons';
import { ScreenOrientation } from '@capacitor/screen-orientation';
import { TranslocoModule, TranslocoService } from '@jsverse/transloco';
import SignaturePad from 'signature_pad';
import { LoggerService } from '../../../../core/logger/logger.service';

/**
 * Fullscreen modal for capturing a customer signature on a canvas.
 * Dismisses with { dataUrl } (role 'save') on confirm, or null (role 'cancel').
 */
@Component({
  selector: 'app-signature-modal',
  templateUrl: './signature-modal.component.html',
  styleUrls: ['./signature-modal.component.scss'],
  imports: [
    IonHeader, IonToolbar, IonTitle, IonButtons, IonButton, IonContent, IonIcon,
    TranslocoModule,
  ],
})
export class SignatureModalComponent implements AfterViewInit, OnDestroy {
  @ViewChild('canvas', { static: true }) private canvasRef!: ElementRef<HTMLCanvasElement>;

  private readonly modalCtrl = inject(ModalController);
  private readonly toastCtrl = inject(ToastController);
  private readonly transloco = inject(TranslocoService);
  private readonly logger = inject(LoggerService);

  constructor() {
    addIcons({ arrowBackOutline });
  }

  private pad: SignaturePad | null = null;
  private readonly onResize = (): void => this.resizeCanvas();

  ngAfterViewInit(): void {
    // Force landscape while signing, regardless of how the phone is held, so the
    // signing field is always wide. Restored on close. (Best-effort; web may not
    // support locking.)
    void this.lockLandscape();
    this.pad = new SignaturePad(this.canvasRef.nativeElement, {
      penColor: '#000000',
      backgroundColor: '#ffffff',
    });
    // Size the canvas once the modal layout has settled.
    setTimeout(() => this.resizeCanvas(), 50);
    window.addEventListener('resize', this.onResize);
  }

  ngOnDestroy(): void {
    window.removeEventListener('resize', this.onResize);
    void this.unlockOrientation();
    this.pad?.off();
  }

  private async lockLandscape(): Promise<void> {
    try {
      await ScreenOrientation.lock({ orientation: 'landscape' });
    } catch (error) {
      this.logger.warn('Signature: failed to lock landscape orientation', { error: String(error) });
    }
  }

  private async unlockOrientation(): Promise<void> {
    try {
      await ScreenOrientation.unlock();
    } catch (error) {
      this.logger.warn('Signature: failed to unlock orientation', { error: String(error) });
    }
  }

  protected clear(): void {
    this.pad?.clear();
  }

  protected async confirm(): Promise<void> {
    if (!this.pad || this.pad.isEmpty()) {
      const toast = await this.toastCtrl.create({
        message: this.transloco.translate('signature_required'),
        duration: 2500,
        color: 'warning',
        position: 'bottom',
      });
      await toast.present();
      return;
    }
    await this.modalCtrl.dismiss({ dataUrl: this.croppedDataUrl() }, 'save');
  }

  /** Exports only the drawn area (bounding box of the strokes) so the signature
   *  isn't a mostly-empty full-screen image. Falls back to the full canvas. */
  private croppedDataUrl(): string {
    const canvas = this.canvasRef.nativeElement;
    const full = this.pad!.toDataURL('image/png');
    const groups = this.pad!.toData();

    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    for (const group of groups) {
      for (const point of group.points) {
        minX = Math.min(minX, point.x);
        minY = Math.min(minY, point.y);
        maxX = Math.max(maxX, point.x);
        maxY = Math.max(maxY, point.y);
      }
    }
    if (!isFinite(minX)) return full;

    const ratio = Math.max(window.devicePixelRatio || 1, 1);
    const pad = 4; // px of breathing room around the signature (CSS units)
    minX = Math.max(0, minX - pad);
    minY = Math.max(0, minY - pad);
    maxX = Math.min(canvas.offsetWidth, maxX + pad);
    maxY = Math.min(canvas.offsetHeight, maxY + pad);

    const sx = minX * ratio, sy = minY * ratio;
    const sw = (maxX - minX) * ratio, sh = (maxY - minY) * ratio;
    if (sw <= 0 || sh <= 0) return full;

    const out = document.createElement('canvas');
    out.width = sw;
    out.height = sh;
    const ctx = out.getContext('2d');
    if (!ctx) return full;
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, sw, sh);
    ctx.drawImage(canvas, sx, sy, sw, sh, 0, 0, sw, sh);
    return out.toDataURL('image/png');
  }

  protected cancel(): void {
    void this.modalCtrl.dismiss(null, 'cancel');
  }

  /** Resize the canvas backing store to its CSS size × devicePixelRatio (preserving any strokes). */
  private resizeCanvas(): void {
    const canvas = this.canvasRef.nativeElement;
    const ratio = Math.max(window.devicePixelRatio || 1, 1);
    const data = this.pad?.toData();

    canvas.width = canvas.offsetWidth * ratio;
    canvas.height = canvas.offsetHeight * ratio;
    canvas.getContext('2d')?.scale(ratio, ratio);

    this.pad?.clear();
    if (data && this.pad) this.pad.fromData(data);
  }
}
