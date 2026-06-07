import { Injectable, inject } from '@angular/core';
import { TranslocoService } from '@jsverse/transloco';
import { TenantService } from '../../../core/tenant/tenant.service';
import { LoggerService } from '../../../core/logger/logger.service';
import { InterventionReportContext, ReportTranslate, ReportType } from '../models/report.model';
import { resolveTemplate } from '../templates/template-registry';
import { PdfOutputService } from './pdf-output.service';

/**
 * Public entry point for generating reports. Features call `generate(type, ctx)`;
 * the tenant-specific template is resolved internally, optional images (logo,
 * signature) are converted to base64, the PDF is rendered (client-side) and
 * opened via the OS for viewing/printing.
 */
@Injectable({ providedIn: 'root' })
export class ReportService {
  private tenantService = inject(TenantService);
  private pdfOutput = inject(PdfOutputService);
  private transloco = inject(TranslocoService);
  private logger = inject(LoggerService);

  async generate(type: ReportType, ctx: InterventionReportContext): Promise<void> {
    const tenantId = this.tenantService.getCurrentTenantId();
    const template = resolveTemplate(type, tenantId);

    // The template translates its own static labels in the active language.
    const t: ReportTranslate = (key, params) => this.transloco.translate(key, params);

    // pdfMake embeds images as base64 data URLs, not remote URLs.
    const renderCtx: InterventionReportContext = {
      ...ctx,
      logoDataUrl: await this.toDataUrl(ctx.company.logoUrl),
      signatureDataUrl: await this.toDataUrl(ctx.signatureUrl),
    };

    const doc = template(renderCtx, t);
    // Stable, human-readable file name (also the document title shown on open/print).
    // Stable → each new report overwrites the previous one instead of piling up.
    const fileName = 'Intervention-report.pdf';
    await this.pdfOutput.openPdf(doc, fileName);
    this.logger.info('Report generated', { type, tenantId });
  }

  /** Fetches an image URL and returns it as a base64 data URL. Best-effort: returns undefined on failure. */
  private async toDataUrl(url?: string): Promise<string | undefined> {
    if (!url) return undefined;
    if (url.startsWith('data:')) return url;
    try {
      const response = await fetch(url);
      const blob = await response.blob();
      return await this.blobToDataUrl(blob);
    } catch (error) {
      this.logger.warn('Report: failed to load image, skipping', { error: String(error) });
      return undefined;
    }
  }

  private blobToDataUrl(blob: Blob): Promise<string> {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onloadend = () => resolve(reader.result as string);
      reader.onerror = () => reject(reader.error);
      reader.readAsDataURL(blob);
    });
  }
}
