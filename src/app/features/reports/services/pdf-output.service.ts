import { Injectable, inject } from '@angular/core';
import { Capacitor } from '@capacitor/core';
import { Directory, Filesystem } from '@capacitor/filesystem';
import { FileOpener } from '@capacitor-community/file-opener';
import { TDocumentDefinitions } from 'pdfmake/interfaces';
import { LoggerService } from '../../../core/logger/logger.service';

/** Minimal shape of the pdfMake browser instance (0.3.x: promise-based API). */
interface PdfMakeInstance {
  createPdf(doc: TDocumentDefinitions): { getBase64(): Promise<string>; open(win?: Window | null): Promise<void> };
  addVirtualFileSystem?(vfs: unknown): void;
  vfs?: unknown;
}

/**
 * Renders a pdfMake document and hands the PDF to the OS.
 * - Native: writes to the cache dir and opens the PDF in a viewer / "open with"
 *   so the user can pick a thermal-printer app (or Print).
 * - Web: opens the PDF in a new tab.
 *
 * pdfMake (large, with fonts) is dynamically imported so it stays out of the
 * main bundle and only loads when a report is actually generated.
 *
 * NOTE: pdfMake 0.3.x changed the browser API — all output methods return a
 * Promise (no callbacks) and fonts are registered via addVirtualFileSystem().
 */
@Injectable({ providedIn: 'root' })
export class PdfOutputService {
  private logger = inject(LoggerService);
  private pdfMake: PdfMakeInstance | null = null;

  async openPdf(doc: TDocumentDefinitions, fileName: string): Promise<void> {
    const pdfMake = await this.loadPdfMake();
    const created = pdfMake.createPdf(doc);

    if (!Capacitor.isNativePlatform()) {
      await created.open();
      return;
    }

    const base64 = await created.getBase64();
    const written = await Filesystem.writeFile({
      path: fileName,
      data: base64,
      directory: Directory.Cache,
    });

    // Open the PDF directly in a viewer / "open with" (so the user can pick a
    // thermal-printer app), rather than the share sheet.
    await FileOpener.open({ filePath: written.uri, contentType: 'application/pdf' });
  }

  private async loadPdfMake(): Promise<PdfMakeInstance> {
    if (this.pdfMake) return this.pdfMake;

    const pdfMakeMod = await import('pdfmake/build/pdfmake');
    const vfsMod = await import('pdfmake/build/vfs_fonts');

    const pdfMake = ((pdfMakeMod as { default?: unknown }).default ?? pdfMakeMod) as PdfMakeInstance;
    const vfsRaw = vfsMod as { default?: { vfs?: unknown }; vfs?: unknown; pdfMake?: { vfs?: unknown } };
    const vfs = vfsRaw.default ?? vfsRaw.vfs ?? vfsRaw.pdfMake?.vfs ?? vfsMod;

    // pdfMake 0.3.x: register fonts via addVirtualFileSystem; 0.2.x fallback to .vfs
    if (typeof pdfMake.addVirtualFileSystem === 'function') {
      pdfMake.addVirtualFileSystem(vfs);
    } else if (!pdfMake.vfs) {
      pdfMake.vfs = vfs;
    }

    this.pdfMake = pdfMake;
    this.logger.debug('pdfMake loaded for report generation');
    return pdfMake;
  }
}
