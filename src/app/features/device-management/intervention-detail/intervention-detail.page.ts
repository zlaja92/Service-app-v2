import { Component, inject } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { Timestamp } from '@capacitor-firebase/firestore';
import {
  IonHeader, IonToolbar, IonTitle, IonContent, IonButtons, IonBackButton,
  IonButton, IonMenuButton, IonList, IonItem, IonLabel, IonTextarea, IonSkeletonText,
  ViewWillEnter, ToastController,
} from '@ionic/angular/standalone';
import { TranslocoModule, TranslocoService } from '@jsverse/transloco';
import { InterventionService } from '../services/intervention.service';
import { DeviceLookupService } from '../services/device-lookup.service';
import { DeviceEnvInfoService } from '../services/device-env-info.service';
import { LoggerService } from '../../../core/logger/logger.service';
import { ServicerService } from '../../../core/servicer/servicer.service';
import { StorageService } from '../../../core/firebase/storage.service';
import { ReportService } from '../../reports/services/report.service';
import { LoadingAlertService } from '../../../shared/services/loading-alert.service';
import { InterventionReportContext, ReportConsent, ReportSection } from '../../reports/models/report.model';
import { Device, DeviceType } from '../../../shared/models/device.model';
import { getEnvInfoFields, getEnvInfoSections } from '../models/device-env-info.model';
import { toDate } from '../../../core/firebase/timestamp.utils';
import {
  INTERVENTION_DISPLAY_FIELDS,
  REGISTRATION_DISPLAY_FIELDS,
} from '../models/intervention.model';

interface DisplayField {
  key: string;
  labelKey: string;
  labelSuffix?: string;
  rawValue: unknown;
  translatable: boolean;
}

const FIELD_LABEL_KEYS: Record<string, string> = {
  date: 'intervention_date_label',
  interventionType: 'intervention_type_label',
  interventionDescription: 'intervention_description_label',
  error: 'intervention_error_label',
  distance: 'intervention_distance_label',
  installerName: 'commissioning_installer_name',
  installerPhoneNumber: 'commissioning_installer_phone',
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
    IonButton, IonMenuButton, IonList, IonItem, IonLabel, IonTextarea, IonSkeletonText,
    TranslocoModule,
  ],
})
export class InterventionDetailPage implements ViewWillEnter {
  private readonly route = inject(ActivatedRoute);
  private readonly interventionService = inject(InterventionService);
  private readonly lookupService = inject(DeviceLookupService);
  private readonly envInfoService = inject(DeviceEnvInfoService);
  private readonly logger = inject(LoggerService);
  private readonly servicerService = inject(ServicerService);
  private readonly reportService = inject(ReportService);
  private readonly storageService = inject(StorageService);
  private readonly loadingAlert = inject(LoadingAlertService);
  private readonly transloco = inject(TranslocoService);
  private readonly toastCtrl = inject(ToastController);

  protected sn = '';
  protected pageTitleKey = '';
  protected fields: DisplayField[] = [];
  protected isLoading = false;
  protected notFound = false;
  protected hasEnvInfo = false;
  protected canReport = false;
  private envInfoData: Record<string, string> | null = null;
  private interventionData: Record<string, unknown> | null = null;
  private interventionDeviceType: string | null = null;
  private isRegistration = false;

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
    this.isRegistration = false;

    const deviceType = this.lookupService.device?.type ?? '';

    if (id === 'registration') {
      data = await this.interventionService.getRegistration(this.sn);
      this.isRegistration = true;
      this.pageTitleKey = 'history_type_purchase';
    } else {
      data = await this.interventionService.getInterventionById(id, deviceType);
      this.pageTitleKey = 'history_detail_title';
    }

    if (!data) {
      this.notFound = true;
      this.isLoading = false;
      return;
    }

    this.fields = this.buildDisplayFields(data, this.isRegistration);

    if (!this.isRegistration) {
      const envInfo = data['envInfo'] as Record<string, string> | undefined;
      this.envInfoData = envInfo && Object.keys(envInfo).length > 0 ? envInfo : null;
      this.hasEnvInfo = !!this.envInfoData;
      this.interventionDeviceType = (data['deviceType'] as string) ?? null;
      this.interventionData = data;
      this.canReport = true;
    }

    this.isLoading = false;
  }

  async onReport(): Promise<void> {
    const device = this.lookupService.device;
    const data = this.interventionData;
    if (!device || !data) return;

    try {
      await this.loadingAlert.wrap(async () => {
        const [registration, company] = await Promise.all([
          this.interventionService.getRegistration(this.sn),
          this.servicerService.getCurrent(),
        ]);
        const reg = registration ?? {};

        const parts = ['sparePart1', 'sparePart2', 'sparePart3', 'sparePart4']
          .map(key => this.str(data[key]));

        const callAccepted = await this.resolveCallAccepted(device, data);

        const signaturePath = this.str(data['signaturePath']);
        const signatureUrl = signaturePath
          ? (await this.storageService.getFileUrl(signaturePath)) ?? undefined
          : undefined;

        const typeRaw = String(data['interventionType'] ?? '');
        const typeLabelKey = this.interventionService.getInterventionLabel(device.type, typeRaw) ?? typeRaw;

        const fullName = `${this.str(reg['firstName'])} ${this.str(reg['lastName'])}`.trim();
        const address = `${this.str(reg['streetName'])} ${this.str(reg['homeNumber'])}`.trim();
        const connectedSn = device.type === DeviceType.HEAT_PUMP ? this.str(reg['connectedDevice']) : '';

        const ctx: InterventionReportContext = {
          company: company ?? {},
          user: {
            fullName,
            address,
            city: this.str(reg['city']),
            phone: this.str(reg['phoneNumber']),
          },
          device: {
            name: device.name,
            type: device.type,
            subType: device.subType,
            sn: this.sn,
            connectedSn: connectedSn || undefined,
          },
          intervention: {
            typeLabel: typeLabelKey ? this.transloco.translate(typeLabelKey) : typeRaw,
            faultDescription: this.translateMaybe(data['interventionDescription']),
            date: this.formatDate(data['addedDate']),
            purchaseDate: this.formatDate(reg['dateOfPurchase']),
            servicer: this.str(data['addedBy']),
            note: this.str(data['note']),
            parts,
          },
          parameterSections: this.buildParameterSections(device, this.envInfoData),
          consent: this.buildConsent(device.type, callAccepted),
          signatureUrl,
        };

        await this.reportService.generate('intervention-receipt', ctx);
      });
    } catch (error) {
      this.logger.error('Report generation failed', { error: String(error) });
      await this.showToast(this.transloco.translate('report_error'));
    }
  }

  /** Builds translated device-parameter sections from env-info, reusing the env-info field defs. */
  private buildParameterSections(device: Device, envInfo: Record<string, string> | null): ReportSection[] {
    if (!envInfo) return [];

    const fields = getEnvInfoFields(device.type, device.subType);
    const sections = getEnvInfoSections(device.type, device.subType);
    const result: ReportSection[] = [];

    for (const section of sections) {
      const rows = fields
        .filter(f => f.section === section.key)
        .map(f => {
          const raw = envInfo[f.key];
          if (raw == null || String(raw).trim() === '') return null;
          // select values are stored as i18n keys; numbers carry an optional unit
          const value = f.type === 'select'
            ? this.transloco.translate(String(raw))
            : `${raw}${f.unit ? ' ' + f.unit : ''}`;
          return { label: this.transloco.translate(f.label), value };
        })
        .filter((r): r is { label: string; value: string } => r !== null);

      if (rows.length > 0) {
        result.push({ title: this.transloco.translate(section.label), rows });
      }
    }

    return result;
  }

  /**
   * Resolves the customer's "contact me for next service" answer. Uses the viewed
   * intervention's own value if present; otherwise the most recent intervention
   * that recorded it (callAccepted is only captured on commissioning/annual).
   */
  private async resolveCallAccepted(device: Device, data: Record<string, unknown>): Promise<boolean | null> {
    if (typeof data['callAccepted'] === 'boolean') {
      return data['callAccepted'] as boolean;
    }
    if (device.type !== DeviceType.GAS_BOILER && device.type !== DeviceType.HEAT_PUMP) {
      return null;
    }
    try {
      const interventions = await this.interventionService.getInterventionsBySn(this.sn, device.type);
      for (let i = interventions.length - 1; i >= 0; i--) {
        const value = interventions[i].data['callAccepted'];
        if (typeof value === 'boolean') return value;
      }
    } catch (error) {
      this.logger.warn('Could not resolve callAccepted for report', { sn: this.sn, error: String(error) });
    }
    return null;
  }

  private buildConsent(deviceType: DeviceType, callAccepted: boolean | null): ReportConsent | undefined {
    if (deviceType === DeviceType.BOILER) {
      return { type: 'boiler-disclaimer', accepted: null };
    }
    if (deviceType === DeviceType.GAS_BOILER || deviceType === DeviceType.HEAT_PUMP) {
      return { type: 'service-consent', accepted: callAccepted };
    }
    return undefined;
  }

  private str(value: unknown): string {
    return value == null ? '' : String(value);
  }

  /** Translates intervention-description i18n keys; free-text descriptions pass through unchanged. */
  private translateMaybe(value: unknown): string {
    const raw = this.str(value);
    if (!raw) return '';
    return raw.startsWith('intervention_description_') ? this.transloco.translate(raw) : raw;
  }

  private formatDate(value: unknown): string {
    const d = toDate(value as Timestamp | null | undefined);
    if (!d) return '';
    const day = String(d.getDate()).padStart(2, '0');
    const month = String(d.getMonth() + 1).padStart(2, '0');
    return `${day}.${month}.${d.getFullYear()}`;
  }

  private async showToast(message: string): Promise<void> {
    const toast = await this.toastCtrl.create({ message, duration: 3000, color: 'danger', position: 'bottom' });
    await toast.present();
  }

  async onViewEnvInfo(): Promise<void> {
    const device = this.lookupService.device;
    if (!device || !this.envInfoData) return;
    await this.envInfoService.viewEnvInfo(device.type, this.envInfoData, device.subType);
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
    const labelKey = FIELD_LABEL_KEYS[key] ?? key;
    const sparePartMatch = key.match(/^sparePart(\d)$/);

    return {
      key,
      labelKey,
      labelSuffix: sparePartMatch ? sparePartMatch[1] : undefined,
      rawValue: this.resolveRawValue(key, value),
      translatable: this.isTranslatable(key),
    };
  }

  private resolveRawValue(key: string, value: unknown): unknown {
    if (value == null) return '-';

    if (key === 'interventionType') {
      const deviceType = this.lookupService.device?.type;
      if (deviceType) {
        return this.interventionService.getInterventionLabel(deviceType, String(value)) ?? String(value);
      }
      return String(value);
    }

    if (key === 'callAccepted') {
      if (value === true) return 'intervention_call_accepted_yes';
      if (value === false) return 'intervention_call_accepted_no';
      return '-';
    }

    if (key === 'warrantyStatus') {
      if (value === 'in-warranty') return 'intervention_warranty_in';
      if (value === 'out-of-warranty') return 'intervention_warranty_out';
      return String(value);
    }

    if (key === 'spareParts' && Array.isArray(value)) {
      const parts = value.filter((v: string) => v?.trim());
      return parts.length > 0 ? parts.join(', ') : '-';
    }

    const dateFields = ['date', 'addedDate', 'createdAt', 'registeredAt', 'warrantyDate', 'dateOfPurchase'];
    if (dateFields.includes(key)) {
      const d = toDate(value as Timestamp | null | undefined);
      if (!d) return '-';
      const day = String(d.getDate()).padStart(2, '0');
      const month = String(d.getMonth() + 1).padStart(2, '0');
      return `${day}.${month}.${d.getFullYear()}`;
    }

    return String(value);
  }

  private isTranslatable(key: string): boolean {
    return ['interventionType', 'interventionDescription', 'error', 'callAccepted', 'warrantyStatus'].includes(key);
  }
}
