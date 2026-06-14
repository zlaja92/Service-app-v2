import { Component, inject } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { Timestamp } from '@capacitor-firebase/firestore';
import {
  IonHeader, IonToolbar, IonTitle, IonContent, IonButtons, IonBackButton,
  IonButton, IonMenuButton, IonList, IonItem, IonLabel, IonTextarea, IonSkeletonText,
  ViewWillEnter,
} from '@ionic/angular/standalone';
import { TranslocoModule } from '@jsverse/transloco';
import { InterventionService } from '../services/intervention.service';
import { DeviceLookupService } from '../services/device-lookup.service';
import { DeviceEnvInfoService } from '../services/device-env-info.service';
import { InterventionReportService } from '../../reports/services/intervention-report.service';
import { ServicerService } from '../../../core/servicer/servicer.service';
import { LoadingAlertService } from '../../../shared/services/loading-alert.service';
import { ConfigStore } from '../../../core/config/config.store';
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
  serviceCenter: 'history_detail_service_center',
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
  private readonly interventionReportService = inject(InterventionReportService);
  private readonly servicerService = inject(ServicerService);
  private readonly loadingAlert = inject(LoadingAlertService);
  private readonly configStore = inject(ConfigStore);

  protected sn = '';
  protected pageTitleKey = '';
  protected fields: DisplayField[] = [];
  protected isLoading = false;
  protected notFound = false;
  protected hasEnvInfo = false;
  protected canReport = false;
  private envInfoData: Record<string, string> | null = null;
  private interventionData: Record<string, unknown> | null = null;
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

    if (!this.isRegistration) {
      // Resolve the company of the servicer who performed the intervention
      // (servicers/{addedBy}, NOT the logged-in account) so it can be shown as
      // a regular field. Written into `data` before building the field list so
      // it is ordered automatically (right after the servicer email).
      const email = data['addedBy'] ? String(data['addedBy']) : '';
      if (email) {
        const servicer = await this.servicerService.getByEmail(email);
        data['serviceCenter'] = servicer?.company?.trim() || '-';
      }
    }

    this.fields = this.buildDisplayFields(data, this.isRegistration);

    if (!this.isRegistration) {
      const envInfo = data['envInfo'] as Record<string, string> | undefined;
      this.envInfoData = envInfo && Object.keys(envInfo).length > 0 ? envInfo : null;
      this.hasEnvInfo = !!this.envInfoData;
      this.interventionData = data;
      // Show the Report button only for interventions AND when the PDF report
      // feature is enabled for the tenant.
      this.canReport = this.configStore.isFeatureEnabled('pdfReports');
    }

    this.isLoading = false;
  }

  /**
   * Manual "Report" button: always opens the report regardless of the menu
   * auto-open toggle. Delegates building + rendering to InterventionReportService.
   */
  async onReport(): Promise<void> {
    const device = this.lookupService.device;
    const data = this.interventionData;
    if (!device || !data) return;
    // The detail page has no loader of its own, so it owns one for the report.
    await this.loadingAlert.wrap(() => this.interventionReportService.open(this.sn, device, data));
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
      return `${day}.${month}.${d.getFullYear()}.`;
    }

    return String(value);
  }

  private isTranslatable(key: string): boolean {
    return ['interventionType', 'interventionDescription', 'error', 'callAccepted', 'warrantyStatus'].includes(key);
  }
}
