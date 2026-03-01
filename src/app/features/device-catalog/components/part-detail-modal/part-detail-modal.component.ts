import { Component, Input, OnInit, inject } from '@angular/core';
import { IonButton, IonSkeletonText, ModalController } from '@ionic/angular/standalone';
import { PartDetailService, PartDetail } from '../../services/part-detail.service';
import { TranslocoModule } from '@jsverse/transloco';
import { ConfigStore } from '../../../../core/config/config.store';

@Component({
  selector: 'app-part-detail-modal',
  templateUrl: './part-detail-modal.component.html',
  styleUrls: ['./part-detail-modal.component.scss'],
  imports: [IonButton, IonSkeletonText, TranslocoModule],
})
export class PartDetailModalComponent implements OnInit {
  @Input() partName = '';
  @Input() partCode = '';

  protected configStore = inject(ConfigStore);
  private modalController = inject(ModalController);
  private partDetailService = inject(PartDetailService);

  detail: PartDetail | null = null;
  isLoading = true;

  async ngOnInit(): Promise<void> {
    this.detail = await this.partDetailService.loadPartDetail(this.partCode, this.partName);
    this.isLoading = false;
  }

  addToCart(): void {
    this.modalController.dismiss(this.detail, 'add-to-cart');
  }

  dismiss(): void {
    this.modalController.dismiss();
  }
}
