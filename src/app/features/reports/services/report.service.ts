import { Injectable, inject } from '@angular/core';
import { CapacitorHttp } from '@capacitor/core';
import { TranslocoService } from '@jsverse/transloco';
import { TenantService } from '../../../core/tenant/tenant.service';
import { LoggerService } from '../../../core/logger/logger.service';
import { InterventionReportContext, ReportTranslate, ReportType, ServicerReportContext } from '../models/report.model';
import { resolveTemplate, resolveServicerReportTemplate } from '../templates/template-registry';
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
      signatureDataUrl: await this.toDataUrl(ctx.signatureUrl),
    };

    const doc = template(renderCtx, t);
    // Stable, human-readable file name (also the document title shown on open/print).
    // Stable → each new report overwrites the previous one instead of piling up.
    const fileName = 'Intervention-report.pdf';
    await this.pdfOutput.openPdf(doc, fileName);
    this.logger.info('Report generated', { type, tenantId });
  }

  /**
   * Generates and opens a servicer (period) report PDF.
   * Unlike intervention receipts, this report has no images to resolve
   * (no signature, no logo), so the context is used directly.
   */
  async generateServicerReport(ctx: ServicerReportContext): Promise<void> {
    const tenantId = this.tenantService.getCurrentTenantId();
    const template = resolveServicerReportTemplate(tenantId);

    const t: ReportTranslate = (key, params) => this.transloco.translate(key, params);

    const doc = template(ctx, t);
    const fileName = 'Servicer-report.pdf';
    await this.pdfOutput.openPdf(doc, fileName);
    this.logger.info('Report generated', { type: 'servicer-report', tenantId });
  }

  /** Fetches an image URL and returns it as a base64 data URL. Best-effort: returns undefined on failure. */
  private async toDataUrl(url?: string): Promise<string | undefined> {
    if (!url) return undefined;
    if (url.startsWith('data:')) return url;
    try {
      // CapacitorHttp runs the request natively, bypassing CORS — a WebView fetch()
      // of a Firebase Storage URL fails ("Load failed") because Storage sends no
      // CORS headers. On native, responseType 'blob' returns base64 in `data`.
      const response = await CapacitorHttp.get({ url, responseType: 'blob' });
      const base64 = typeof response.data === 'string' ? response.data : '';
      if (!base64) return undefined;
      const contentType = this.contentTypeOf(response.headers) ?? 'image/png';
      return `data:${contentType};base64,${base64}`;
    } catch (error) {
      this.logger.warn('Report: failed to load image, skipping', { error: String(error) });
      return undefined;
    }
  }

  private contentTypeOf(headers: Record<string, string> | undefined): string | undefined {
    if (!headers) return undefined;
    const key = Object.keys(headers).find(k => k.toLowerCase() === 'content-type');
    return key ? headers[key].split(';')[0].trim() : undefined;
  }
}
