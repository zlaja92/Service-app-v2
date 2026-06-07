import { Injectable, inject } from '@angular/core';
import { Timestamp } from '@capacitor-firebase/firestore';
import { ToastController } from '@ionic/angular/standalone';
import { TranslocoService } from '@jsverse/transloco';
import { InterventionService } from '../../device-management/services/intervention.service';
import { getEnvInfoFields, getEnvInfoSections } from '../../device-management/models/device-env-info.model';
import { ServicerService } from '../../../core/servicer/servicer.service';
import { StorageService } from '../../../core/firebase/storage.service';
import { LoggerService } from '../../../core/logger/logger.service';
import { toDate } from '../../../core/firebase/timestamp.utils';
import { Device, DeviceType } from '../../../shared/models/device.model';
import { InterventionReportContext, ReportConsent, ReportSection } from '../models/report.model';
import { ReportService } from './report.service';

/**
 * Assembles the intervention-report context and opens the PDF. Shared by the
 * intervention-detail page (manual "Report" button) and the save flows
 * (auto-open after saving). `data` is the intervention document/data object —
 * it must carry the same fields a saved intervention has, including `envInfo`
 * (and, when available, `addedBy`). When `addedBy` is absent (a just-saved
 * intervention), the company header falls back to the current servicer, which
 * is the person performing the save — the correct author in that moment.
 *
 * Layering: this is the domain "assembler"; the generic rendering/output engine
 * is ReportService (which it delegates to via generate()).
 */
@Injectable({ providedIn: 'root' })
export class InterventionReportService {
  private interventionService = inject(InterventionService);
  private servicerService = inject(ServicerService);
  private reportService = inject(ReportService);
  private storageService = inject(StorageService);
  private transloco = inject(TranslocoService);
  private toastCtrl = inject(ToastController);
  private logger = inject(LoggerService);

  /**
   * Builds the context and renders the report. Does NOT manage a loading spinner
   * itself — the CALLER owns the loader (the save flows keep their save spinner
   * up; the detail page wraps this call). This keeps loader presentation a UI
   * concern and avoids overwriting the single shared loader reference (which
   * would orphan the caller's spinner).
   */
  async open(sn: string, device: Device, data: Record<string, unknown>): Promise<void> {
    try {
      const servicerEmail = this.str(data['addedBy']);
      const [registration, company] = await Promise.all([
        this.interventionService.getRegistration(sn),
        servicerEmail
          ? this.servicerService.getByEmail(servicerEmail)
          : this.servicerService.getCurrent(),
      ]);
      const reg = registration ?? {};

      const parts = ['sparePart1', 'sparePart2', 'sparePart3', 'sparePart4']
        .map(key => this.str(data[key]));

      const callAccepted = await this.resolveCallAccepted(sn, device, data);

      const signaturePath = this.str(data['signaturePath']);
      const signatureUrl = signaturePath
        ? (await this.storageService.getFileUrl(signaturePath)) ?? undefined
        : undefined;

      const typeRaw = String(data['interventionType'] ?? '');
      const typeLabelKey = this.interventionService.getInterventionLabel(device.type, typeRaw) ?? typeRaw;

      const fullName = `${this.str(reg['firstName'])} ${this.str(reg['lastName'])}`.trim();
      const address = `${this.str(reg['streetName'])} ${this.str(reg['homeNumber'])}`.trim();
      const connectedSn = device.type === DeviceType.HEAT_PUMP ? this.str(reg['connectedDevice']) : '';

      const envInfoRaw = data['envInfo'] as Record<string, string> | undefined;
      const envInfo = envInfoRaw && Object.keys(envInfoRaw).length > 0 ? envInfoRaw : null;

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
          sn,
          connectedSn: connectedSn || undefined,
        },
        intervention: {
          typeLabel: typeLabelKey ? this.transloco.translate(typeLabelKey) : typeRaw,
          faultDescription: data['interventionDescription']
            ? this.transloco.translate(this.str(data['interventionDescription']))
            : '',
          date: this.formatDate(data['addedDate']),
          purchaseDate: this.formatDate(reg['dateOfPurchase']),
          servicer: servicerEmail,
          note: this.str(data['note']),
          parts,
        },
        parameterSections: this.buildParameterSections(device, envInfo),
        consent: this.buildConsent(device.type, callAccepted),
        signatureUrl,
      };

      await this.reportService.generate('intervention-receipt', ctx);
    } catch (error) {
      this.logger.error('Report generation failed', { error: String(error) });
      await this.showError();
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
   * Resolves the customer's "contact me for next service" answer. Uses the given
   * intervention's own value if present; otherwise the most recent intervention
   * that recorded it (callAccepted is only captured on commissioning/annual).
   */
  private async resolveCallAccepted(sn: string, device: Device, data: Record<string, unknown>): Promise<boolean | null> {
    if (typeof data['callAccepted'] === 'boolean') {
      return data['callAccepted'] as boolean;
    }
    if (device.type !== DeviceType.GAS_BOILER && device.type !== DeviceType.HEAT_PUMP) {
      return null;
    }
    try {
      const interventions = await this.interventionService.getInterventionsBySn(sn, device.type);
      for (let i = interventions.length - 1; i >= 0; i--) {
        const value = interventions[i].data['callAccepted'];
        if (typeof value === 'boolean') return value;
      }
    } catch (error) {
      this.logger.warn('Could not resolve callAccepted for report', { sn, error: String(error) });
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

  private formatDate(value: unknown): string {
    const d = toDate(value as Timestamp | null | undefined);
    if (!d) return '';
    const day = String(d.getDate()).padStart(2, '0');
    const month = String(d.getMonth() + 1).padStart(2, '0');
    return `${day}.${month}.${d.getFullYear()}`;
  }

  private async showError(): Promise<void> {
    const toast = await this.toastCtrl.create({
      message: this.transloco.translate('report_error'),
      duration: 3000,
      color: 'danger',
      position: 'bottom',
    });
    await toast.present();
  }
}
