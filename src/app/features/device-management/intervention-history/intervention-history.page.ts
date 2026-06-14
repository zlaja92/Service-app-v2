import { Component, inject } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { Timestamp } from '@capacitor-firebase/firestore';
import {
  IonHeader, IonToolbar, IonTitle, IonContent, IonButtons, IonBackButton,
  IonMenuButton, IonList, IonItem, IonLabel, IonSpinner, IonSkeletonText,
  ViewWillEnter,
} from '@ionic/angular/standalone';
import { TranslocoModule, TranslocoService } from '@jsverse/transloco';
import { ToastController } from '@ionic/angular/standalone';
import { DeviceLookupService } from '../services/device-lookup.service';
import { InterventionService } from '../services/intervention.service';
import { LoggerService } from '../../../core/logger/logger.service';
import { toDate } from '../../../core/firebase/timestamp.utils';
import { InterventionHistoryItem, InterventionType } from '../models/intervention.model';

@Component({
  selector: 'app-intervention-history',
  templateUrl: './intervention-history.page.html',
  styleUrls: ['./intervention-history.page.scss'],
  imports: [
    IonHeader, IonToolbar, IonTitle, IonContent, IonButtons, IonBackButton,
    IonMenuButton, IonList, IonItem, IonLabel, IonSpinner, IonSkeletonText,
    TranslocoModule,
  ],
})
export class InterventionHistoryPage implements ViewWillEnter {
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly lookupService = inject(DeviceLookupService);
  private readonly interventionService = inject(InterventionService);
  private readonly transloco = inject(TranslocoService);
  private readonly toastCtrl = inject(ToastController);
  private readonly logger = inject(LoggerService);

  protected sn = '';
  protected items: InterventionHistoryItem[] = [];
  protected isLoading = false;

  ionViewWillEnter(): void {
    this.sn = this.route.snapshot.paramMap.get('sn') ?? '';
    void this.initialize();
  }

  private async initialize(): Promise<void> {
    if (!this.lookupService.device || this.lookupService.sn !== this.sn) {
      await this.lookupService.lookup(this.sn);
    }
    await this.loadHistory();
  }

  openDetail(item: InterventionHistoryItem): void {
    if (!item.clickable) return;

    if (item.source === 'commissioning-header') {
      const commissioning = this.findCommissioningIntervention();
      if (commissioning) {
        void this.router.navigate(
          ['/device-management', this.sn, 'history', commissioning.id],
        );
      } else {
        void this.showToast(this.transloco.translate('history_no_commissioning'));
      }
      return;
    }

    void this.router.navigate(
      ['/device-management', this.sn, 'history', item.id],
    );
  }

  private async loadHistory(): Promise<void> {
    this.isLoading = true;
    this.items = [];

    const device = this.lookupService.device;
    if (!device) {
      this.isLoading = false;
      return;
    }

    const interventions = await this.interventionService.getInterventionsBySn(this.sn, device.type);
    this.cachedInterventions = interventions;

    const items: InterventionHistoryItem[] = [];

    const registration = await this.interventionService.getRegistration(this.sn);
    const isCommissioning = device?.commissioning === true;

    if (registration) {
      const purchaseDate = toDate(registration['dateOfPurchase'] as Timestamp | null | undefined);
      const hasDate = !!purchaseDate;
      const day = purchaseDate ? String(purchaseDate.getDate()).padStart(2, '0') : '';
      const month = purchaseDate ? String(purchaseDate.getMonth() + 1).padStart(2, '0') : '';
      const formatted = purchaseDate ? `${day}.${month}.${purchaseDate.getFullYear()}.` : '';

      items.push({
        id: 'header',
        date: formatted,
        dateKey: hasDate ? undefined : (isCommissioning ? 'history_unknown_commissioning_date' : 'history_unknown_date'),
        typeLabelKey: hasDate ? (isCommissioning ? 'history_type_commissioning' : 'history_type_purchase') : '',
        source: isCommissioning ? 'commissioning-header' : 'registration',
        clickable: isCommissioning,
      });
    }

    for (const intervention of interventions) {
      if (intervention.data['interventionType'] === InterventionType.COMMISSIONING) continue;

      items.push({
        id: intervention.id,
        date: this.extractDate(intervention.data),
        typeLabelKey: this.resolveTypeLabelKey(intervention.data),
        source: 'intervention',
        clickable: true,
      });
    }

    this.items = items;
    this.isLoading = false;
  }

  private cachedInterventions: { id: string; data: Record<string, unknown> }[] = [];

  private findCommissioningIntervention(): { id: string } | undefined {
    return this.cachedInterventions.find(
      i => i.data['interventionType'] === InterventionType.COMMISSIONING,
    );
  }

  private resolveTypeLabelKey(data: Record<string, unknown>): string {
    const type = data['interventionType'] as string;

    switch (type) {
      case InterventionType.COMMISSIONING:
        return 'history_type_commissioning';
      case InterventionType.ANNUAL_SERVICE:
        return 'history_type_annual_service';
      default:
        return 'history_type_repair';
    }
  }

  private extractDate(data: Record<string, unknown>): string {
    const d = toDate(data['addedDate'] as Timestamp | null | undefined);
    if (!d) return '';
    const day = String(d.getDate()).padStart(2, '0');
    const month = String(d.getMonth() + 1).padStart(2, '0');
    return `${day}.${month}.${d.getFullYear()}.`;
  }

  private async showToast(message: string): Promise<void> {
    const toast = await this.toastCtrl.create({
      message,
      duration: 3000,
      position: 'bottom',
    });
    await toast.present();
  }
}
