import { Component, inject } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import {
  IonHeader, IonToolbar, IonTitle, IonContent, IonButtons, IonBackButton,
  IonMenuButton, IonList, IonItem, IonLabel, IonSpinner,
  ViewWillEnter,
} from '@ionic/angular/standalone';
import { TranslocoModule, TranslocoService } from '@jsverse/transloco';
import { InterventionService } from '../services/intervention.service';
import { LoggerService } from '../../../core/logger/logger.service';
import {
  INTERVENTION_DISPLAY_FIELDS,
  REGISTRATION_DISPLAY_FIELDS,
  HIDDEN_FIELDS,
} from '../models/intervention.model';

interface DisplayField {
  label: string;
  value: string;
}

const FIELD_LABEL_KEYS: Record<string, string> = {
  date: 'intervention_date_label',
  interventionType: 'intervention_type_label',
  description: 'intervention_description_label',
  error: 'intervention_error_label',
  distance: 'intervention_distance_label',
  callAccepted: 'intervention_call_accepted_label',
  spareParts: 'history_detail_spare_parts',
  note: 'intervention_note_label',
  createdBy: 'history_detail_created_by',
  createdAt: 'history_detail_created_at',
  warrantyStatus: 'add_device_warranty',
  warrantyDate: 'add_device_warranty_date',
  comment: 'add_device_comment',
  registeredBy: 'history_detail_registered_by',
  registeredAt: 'history_detail_registered_at',
};

@Component({
  selector: 'app-intervention-detail',
  templateUrl: './intervention-detail.page.html',
  styleUrls: ['./intervention-detail.page.scss'],
  imports: [
    IonHeader, IonToolbar, IonTitle, IonContent, IonButtons, IonBackButton,
    IonMenuButton, IonList, IonItem, IonLabel, IonSpinner,
    TranslocoModule,
  ],
})
export class InterventionDetailPage implements ViewWillEnter {
  private readonly route = inject(ActivatedRoute);
  private readonly interventionService = inject(InterventionService);
  private readonly transloco = inject(TranslocoService);
  private readonly logger = inject(LoggerService);

  protected sn = '';
  protected pageTitle = '';
  protected fields: DisplayField[] = [];
  protected isLoading = false;
  protected notFound = false;

  ionViewWillEnter(): void {
    this.sn = this.route.snapshot.paramMap.get('sn') ?? '';
    const id = this.route.snapshot.paramMap.get('id') ?? '';
    void this.loadDetail(id);
  }

  private async loadDetail(id: string): Promise<void> {
    this.isLoading = true;
    this.notFound = false;

    let data: Record<string, unknown> | null;
    let isRegistration = false;

    if (id === 'registration') {
      data = await this.interventionService.getRegistration(this.sn);
      isRegistration = true;
      this.pageTitle = this.transloco.translate('history_type_purchase');
    } else {
      data = await this.interventionService.getInterventionById(id);
      this.pageTitle = this.transloco.translate('history_detail_title');
    }

    if (!data) {
      this.notFound = true;
      this.isLoading = false;
      return;
    }

    this.fields = this.buildDisplayFields(data, isRegistration);
    this.isLoading = false;
  }

  private buildDisplayFields(
    data: Record<string, unknown>,
    isRegistration: boolean,
  ): DisplayField[] {
    const orderedKeys = isRegistration
      ? REGISTRATION_DISPLAY_FIELDS
      : INTERVENTION_DISPLAY_FIELDS;

    const allHidden = new Set([...HIDDEN_FIELDS]);
    const result: DisplayField[] = [];
    const processed = new Set<string>();

    for (const key of orderedKeys) {
      if (key in data) {
        result.push(this.toDisplayField(key, data[key]));
        processed.add(key);
      }
    }

    for (const [key, value] of Object.entries(data)) {
      if (processed.has(key) || allHidden.has(key)) continue;
      result.push(this.toDisplayField(key, value));
    }

    return result;
  }

  private toDisplayField(key: string, value: unknown): DisplayField {
    const labelKey = FIELD_LABEL_KEYS[key];
    const label = labelKey ? this.transloco.translate(labelKey) : key;
    return { label, value: this.formatValue(key, value) };
  }

  private formatValue(key: string, value: unknown): string {
    if (value == null) return '-';

    if (key === 'interventionType' && typeof value === 'object') {
      return (value as { name: string }).name ?? '-';
    }

    if (key === 'spareParts' && Array.isArray(value)) {
      const parts = value.filter((v: string) => v?.trim());
      return parts.length > 0 ? parts.join(', ') : '-';
    }

    if (key === 'callAccepted') {
      if (value === true) return this.transloco.translate('intervention_call_accepted_yes');
      if (value === false) return this.transloco.translate('intervention_call_accepted_no');
      return '-';
    }

    if (key === 'warrantyStatus') {
      if (value === 'in_warranty') return this.transloco.translate('add_device_in_warranty');
      if (value === 'out_of_warranty') return this.transloco.translate('add_device_out_of_warranty');
    }

    const dateFields = ['date', 'createdAt', 'registeredAt', 'warrantyDate', 'dateOfPurchase'];
    if (dateFields.includes(key)) {
      return this.formatDate(this.toDateString(value));
    }

    return String(value);
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
    if (!raw) return '-';
    if (/^\d{2}[./]\d{2}[./]\d{4}$/.test(raw)) {
      return raw.replace(/\//g, '.');
    }
    const d = new Date(raw);
    if (isNaN(d.getTime())) return raw;
    const day = String(d.getDate()).padStart(2, '0');
    const month = String(d.getMonth() + 1).padStart(2, '0');
    return `${day}.${month}.${d.getFullYear()}`;
  }
}
