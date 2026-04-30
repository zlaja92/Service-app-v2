import { Component, inject } from '@angular/core';
import {
  IonHeader, IonToolbar, IonTitle, IonContent, IonButtons,
  IonButton, IonIcon, IonGrid, IonRow, IonCol,
  ModalController, ActionSheetController,
} from '@ionic/angular/standalone';
import { addIcons } from 'ionicons';
import { addOutline, trashOutline, arrowBackOutline, cameraOutline, imageOutline } from 'ionicons/icons';
import { TranslocoModule, TranslocoService } from '@jsverse/transloco';
import { PhotoService } from './services/photo.service';

@Component({
  selector: 'app-photo-upload',
  templateUrl: './photo-upload.page.html',
  styleUrls: ['./photo-upload.page.scss'],
  imports: [
    IonHeader, IonToolbar, IonTitle, IonContent, IonButtons,
    IonButton, IonIcon, IonGrid, IonRow, IonCol,
    TranslocoModule,
  ],
})
export class PhotoUploadPage {
  protected readonly photoService = inject(PhotoService);
  private readonly modalController = inject(ModalController);
  private readonly actionSheetCtrl = inject(ActionSheetController);
  private readonly transloco = inject(TranslocoService);

  constructor() {
    addIcons({ addOutline, trashOutline, arrowBackOutline, cameraOutline, imageOutline });
  }

  async onAddPhoto(): Promise<void> {
    const actionSheet = await this.actionSheetCtrl.create({
      buttons: [
        {
          text: this.transloco.translate('photo_take'),
          icon: 'camera-outline',
          handler: () => { void this.photoService.takePhoto(); },
        },
        {
          text: this.transloco.translate('photo_gallery'),
          icon: 'image-outline',
          handler: () => { void this.photoService.pickFromGallery(); },
        },
        {
          text: this.transloco.translate('photo_cancel'),
          role: 'cancel',
        },
      ],
    });
    await actionSheet.present();
  }

  onRemovePhoto(id: string): void {
    this.photoService.removePhoto(id);
  }

  onOk(): void {
    this.modalController.dismiss(null, 'ok');
  }

  onDismiss(): void {
    this.modalController.dismiss(null, 'cancel');
  }
}
