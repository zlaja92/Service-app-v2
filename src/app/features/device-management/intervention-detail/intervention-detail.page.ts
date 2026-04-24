import { Component, inject } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import {
  IonHeader, IonToolbar, IonTitle, IonContent, IonButtons, IonBackButton,
  IonButton, IonMenuButton, IonList, IonItem, IonLabel, IonTextarea, IonSpinner,
  ViewWillEnter,
} from '@ionic/angular/standalone';
import { TranslocoModule, TranslocoService } from '@jsverse/transloco';
import { InterventionService } from '../services/intervention.service';
import { DeviceLookupService } from '../services/device-lookup.service';
import { DeviceEnvInfoService } from '../services/device-env-info.service';
import { LoggerService } from '../../../core/logger/logger.service';
import {
  INTERVENTION_DISPLAY_FIELDS,
  REGISTRATION_DISPLAY_FIELDS,
} from '../models/intervention.model';

interface DisplayField {
  key: string;
  label: string;
  value: string;
}

const FIELD_LABEL_KEYS: Record<string, string> = {
  date: 'intervention_date_label',
  interventionType: 'intervention_type_label',
  interventionDescription: 'intervention_description_label',
  error: 'intervention_error_label',
  distance: 'intervention_distance_label',
  callAccepted: 'intervention_call_accepted_label',
  sparePart1: 'intervention_spare_part_label',
  sparePart2: 'intervention_spare_part_label',
  sparePart3: 'intervention_spare_part_label',
  sparePart4: 'intervention_spare_part_label',
  note: 'intervention_note_label',
  addedBy: 'history_detail_servicer_email',
  addedDate: 'intervention_date_label',
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
    IonButton, IonMenuButton, IonList, IonItem, IonLabel, IonTextarea, IonSpinner,
    TranslocoModule,
  ],
})
export class InterventionDetailPage implements ViewWillEnter {
  private readonly route = inject(ActivatedRoute);
  private readonly interventionService = inject(InterventionService);
  private readonly lookupService = inject(DeviceLookupService);
  private readonly envInfoService = inject(DeviceEnvInfoService);
  private readonly transloco = inject(TranslocoService);
  private readonly logger = inject(LoggerService);

  protected sn = '';
  protected pageTitle = '';
  protected fields: DisplayField[] = [];
  protected isLoading = false;
  protected notFound = false;
  protected hasEnvInfo = false;
  private envInfoData: Record<string, string> | null = null;
  private interventionDeviceType: string | null = null;

  ionViewWillEnter(): void {
    this.sn = this.route.snapshot.paramMap.get('sn') ?? '';
    const id = this.route.snapshot.paramMap.get('id') ?? '';
    void this.initialize(id);
  }

  private async initialize(id: string): Promise<void> {
    if (!this.lookupService.device || this.lookupService.sn !== this.sn) {
      await this.lookupService.lookup(this.sn);
    }
    await this.loadDetail(id);
  }

  private async loadDetail(id: string): Promise<void> {
    this.isLoading = true;
    this.notFound = false;

    let data: Record<string, unknown> | null;
    let isRegistration = false;

    const deviceType = this.lookupService.device?.type ?? '';

    if (id === 'registration') {
      data = await this.interventionService.getRegistration(this.sn);
      isRegistration = true;
      this.pageTitle = this.transloco.translate('history_type_purchase');
    } else {
      data = await this.interventionService.getInterventionById(id, deviceType);
      this.pageTitle = this.transloco.translate('history_detail_title');
    }

    if (!data) {
      this.notFound = true;
      this.isLoading = false;
      return;
    }

    this.fields = this.buildDisplayFields(data, isRegistration);

    if (!isRegistration) {
      const envInfo = data['envInfo'] as Record<string, string> | undefined;
      this.envInfoData = envInfo && Object.keys(envInfo).length > 0 ? envInfo : null;
      this.hasEnvInfo = !!this.envInfoData;
      this.interventionDeviceType = (data['deviceType'] as string) ?? null;
    }

    this.isLoading = false;
  }

  async onViewEnvInfo(): Promise<void> {
    const deviceType = this.lookupService.device?.type;
    if (!deviceType || !this.envInfoData) return;
    await this.envInfoService.viewEnvInfo(deviceType, this.envInfoData);
  }

  private buildDisplayFields(
    data: Record<string, unknown>,
    isRegistration: boolean,
  ): DisplayField[] {
    const orderedKeys = isRegistration
      ? REGISTRATION_DISPLAY_FIELDS
      : INTERVENTION_DISPLAY_FIELDS;

    const result: DisplayField[] = [];

    for (const key of orderedKeys) {
      if (key in data) {
        result.push(this.toDisplayField(key, data[key]));
      }
    }

    return result;
  }

  private toDisplayField(key: string, value: unknown): DisplayField {
    const labelKey = FIELD_LABEL_KEYS[key];
    let label = labelKey ? this.transloco.translate(labelKey) : key;

    const sparePartMatch = key.match(/^sparePart(\d)$/);
    if (sparePartMatch) {
      label = `${label} ${sparePartMatch[1]}`;
    }

    return { key, label, value: this.formatValue(key, value) };
  }

  private formatValue(key: string, value: unknown): string {
    if (value == null) return '-';

    if (key === 'interventionType') {
      const deviceType = this.lookupService.device?.type;
      if (deviceType) {
        const label = this.interventionService.getInterventionLabel(deviceType, String(value));
        if (label) return this.transloco.translate(label);
      }
      return String(value);
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

    const dateFields = ['date', 'addedDate', 'createdAt', 'registeredAt', 'warrantyDate', 'dateOfPurchase'];
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
