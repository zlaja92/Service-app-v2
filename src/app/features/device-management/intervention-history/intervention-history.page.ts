import { Component, inject } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import {
  IonHeader, IonToolbar, IonTitle, IonContent, IonButtons, IonBackButton,
  IonMenuButton, IonList, IonItem, IonLabel, IonSpinner,
  ViewWillEnter,
} from '@ionic/angular/standalone';
import { TranslocoModule, TranslocoService } from '@jsverse/transloco';
import { ToastController } from '@ionic/angular/standalone';
import { DeviceLookupService } from '../services/device-lookup.service';
import { InterventionService } from '../services/intervention.service';
import { LoggerService } from '../../../core/logger/logger.service';
import { InterventionHistoryItem } from '../models/intervention.model';

@Component({
  selector: 'app-intervention-history',
  templateUrl: './intervention-history.page.html',
  styleUrls: ['./intervention-history.page.scss'],
  imports: [
    IonHeader, IonToolbar, IonTitle, IonContent, IonButtons, IonBackButton,
    IonMenuButton, IonList, IonItem, IonLabel, IonSpinner,
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
    void this.loadHistory();
  }

  openDetail(item: InterventionHistoryItem): void {
    void this.router.navigate(
      ['/device-management', this.sn, 'history', item.id],
    );
  }

  private async loadHistory(): Promise<void> {
    this.isLoading = true;
    this.items = [];

    const device = this.lookupService.device;
    const interventions = await this.interventionService.getInterventionsBySn(this.sn);

    const items: InterventionHistoryItem[] = [];

    if (device?.annualService) {
      const commissioning = interventions.find(i => this.isCommissioning(i.data));
      if (commissioning) {
        items.push({
          id: commissioning.id,
          date: this.extractDate(commissioning.data),
          typeLabel: this.transloco.translate('history_type_commissioning'),
          source: 'intervention',
        });
      } else {
        void this.showToast(this.transloco.translate('history_no_commissioning'));
      }
    } else {
      const registration = await this.interventionService.getRegistration(this.sn);
      if (registration) {
        items.push({
          id: 'registration',
          date: this.formatDate(this.toDateString(registration['dateOfPurchase'])),
          typeLabel: this.transloco.translate('history_type_purchase'),
          source: 'registration',
        });
      }
    }

    for (const intervention of interventions) {
      if (this.isCommissioning(intervention.data) && device?.annualService) continue;

      items.push({
        id: intervention.id,
        date: this.extractDate(intervention.data),
        typeLabel: this.resolveTypeLabel(intervention.data),
        source: 'intervention',
      });
    }

    this.items = items;
    this.isLoading = false;
  }

  private isCommissioning(data: Record<string, unknown>): boolean {
    const typeName = this.getInterventionTypeName(data);
    return typeName.toUpperCase().includes('PUŠTANJE')
      || typeName.toUpperCase().includes('PUSTANJE');
  }

  private resolveTypeLabel(data: Record<string, unknown>): string {
    const typeName = this.getInterventionTypeName(data);
    const upper = typeName.toUpperCase();

    if (upper.includes('POPRAVKA')) {
      return this.transloco.translate('history_type_repair');
    }
    if (upper.includes('GODIŠNJ') || upper.includes('SERVIS')) {
      return this.transloco.translate('history_type_annual_service');
    }
    if (upper.includes('PUŠTANJE') || upper.includes('PUSTANJE')) {
      return this.transloco.translate('history_type_commissioning');
    }
    return typeName || this.transloco.translate('history_type_repair');
  }

  private getInterventionTypeName(data: Record<string, unknown>): string {
    const interventionType = data['interventionType'];
    if (typeof interventionType === 'object' && interventionType !== null) {
      return (interventionType as { name: string }).name ?? '';
    }
    return String(interventionType ?? '');
  }

  private extractDate(data: Record<string, unknown>): string {
    const raw = String(data['date'] ?? data['createdAt'] ?? '');
    return this.formatDate(raw);
  }

  private toDateString(value: unknown): string {
    if (!value) return '';
    if (typeof value === 'string') return value;
    if (typeof value === 'object' && value !== null && 'seconds' in value) {
      return new Date((value as { seconds: number }).seconds * 1000).toISOString();
    }
    if (value instanceof Date) return value.toISOString();
    return String(value);
  }

  private formatDate(raw: string): string {
    if (!raw) return '';
    // Already dd/mm/yyyy or dd.mm.yyyy
    if (/^\d{2}[./]\d{2}[./]\d{4}$/.test(raw)) {
      return raw.replace(/\//g, '.');
    }
    // ISO string (2026-04-09T22:12:31.009Z)
    const d = new Date(raw);
    if (isNaN(d.getTime())) return raw;
    const day = String(d.getDate()).padStart(2, '0');
    const month = String(d.getMonth() + 1).padStart(2, '0');
    return `${day}.${month}.${d.getFullYear()}`;
  }

  private async showToast(message: string): Promise<void> {
    const toast = await this.toastCtrl.create({
      message,
      duration: 3000,
      color: 'warning',
      position: 'bottom',
    });
    await toast.present();
  }
}
