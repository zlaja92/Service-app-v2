import { Injectable, inject } from '@angular/core';
import { ToastController } from '@ionic/angular/standalone';
import { TranslocoService } from '@jsverse/transloco';
import { ServicerService } from '../../../core/servicer/servicer.service';
import { Servicer } from '../../../core/servicer/servicer.model';
import { LoggerService } from '../../../core/logger/logger.service';
import { ServicerReportItem } from '../models/servicer-report.model';
import { ServicerReportContext, ServicerReportPdfItem } from '../../reports/models/report.model';
import { ReportService } from '../../reports/services/report.service';

/**
 * Assembles the servicer-report context from pre-loaded ServicerReportItem[]
 * data and delegates PDF generation to ReportService.
 *
 * This is the domain "assembler" layer — it translates UI-level data
 * (ServicerReportItem, selected date range) into the PDF-level context
 * (ServicerReportContext) that the generic rendering engine (ReportService)
 * consumes. Analogous to InterventionReportService for intervention receipts.
 *
 * The caller (UI component / store) owns the loading spinner; this service
 * does NOT manage loading indicators itself.
 */
@Injectable({ providedIn: 'root' })
export class ServicerReportAssemblerService {
  private readonly servicerService = inject(ServicerService);
  private readonly reportService = inject(ReportService);
  private readonly transloco = inject(TranslocoService);
  private readonly toastCtrl = inject(ToastController);
  private readonly logger = inject(LoggerService);

  /**
   * Builds the ServicerReportContext from the supplied items and date range,
   * then generates and opens the servicer-report PDF.
   *
   * On failure, shows a danger toast and logs the error; the error is
   * NOT re-thrown (matches the InterventionReportService pattern).
   *
   * @param items  Pre-loaded ServicerReportItem[]. May be empty — an empty
   *               array produces a valid PDF with zero rows, zero totals.
   * @param dateFrom  Start of the date range (inclusive).
   * @param dateTo    End of the date range (inclusive).
   */
  async export(items: ServicerReportItem[], dateFrom: Date, dateTo: Date): Promise<void> {
    try {
      const company = await this.servicerService.getCurrent();

      const pdfItems: ServicerReportPdfItem[] = items.map((item) => this.toPdfItem(item));

      const totalInterventions = items.length;
      const totalDistance = items.reduce((sum, item) => sum + item.distance, 0);

      const ctx: ServicerReportContext = {
        company: company ?? ({} as Servicer),
        items: pdfItems,
        dateFrom: this.formatDate(dateFrom),
        dateTo: this.formatDate(dateTo),
        totalInterventions,
        totalDistance,
      };

      await this.reportService.generateServicerReport(ctx);
    } catch (error) {
      this.logger.error('Servicer report generation failed', { error: String(error) });
      await this.showError();
    }
  }

  /**
   * Maps a single ServicerReportItem (UI-level model with selection state,
   * raw codes, timestamps) to a ServicerReportPdfItem (PDF-level model
   * with translated labels and only the fields the template needs).
   */
  private toPdfItem(item: ServicerReportItem): ServicerReportPdfItem {
    const interventionTypeLabel = item.interventionTypeLabelKey
      ? this.transloco.translate(item.interventionTypeLabelKey)
      : '';

    return {
      sn: item.sn,
      address: item.address,
      city: item.city,
      interventionTypeLabel,
      spareParts: item.spareParts,
      date: item.date,
      distance: item.distance,
      warrantyLabel: this.warrantyLabel(item.warrantyStatus),
    };
  }

  /** Translates a raw warranty status into a short, human-readable label.
   *  Returns an empty string for unknown/empty statuses. */
  private warrantyLabel(status: string): string {
    if (status === 'in-warranty') return this.transloco.translate('servicer_report_warranty_in');
    if (status === 'out-of-warranty') return this.transloco.translate('servicer_report_warranty_out');
    return '';
  }

  /** Formats a JS Date as dd.mm.yyyy. (e.g. 05.01.2026.). */
  private formatDate(date: Date): string {
    const day = String(date.getDate()).padStart(2, '0');
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const year = date.getFullYear();
    return `${day}.${month}.${year}.`;
  }

  /** Shows a danger toast when report generation fails. */
  private async showError(): Promise<void> {
    const toast = await this.toastCtrl.create({
      message: this.transloco.translate('servicer_report_export_error'),
      duration: 3000,
      color: 'danger',
      position: 'bottom',
    });
    await toast.present();
  }
}
