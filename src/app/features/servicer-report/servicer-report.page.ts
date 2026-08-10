import { Component, inject, ChangeDetectionStrategy } from '@angular/core';
import { FormsModule } from '@angular/forms';
import {
  IonHeader, IonToolbar, IonTitle, IonContent, IonButtons, IonBackButton,
  IonButton, IonIcon, IonItem, IonLabel, IonList, IonCheckbox,
  IonMenuButton, IonSpinner, IonSelect, IonSelectOption, IonNote,
  IonFooter, IonInput, IonSkeletonText,
  ToastController,
} from '@ionic/angular/standalone';
import { addIcons } from 'ionicons';
import { searchOutline, downloadOutline } from 'ionicons/icons';
import { TranslocoModule, TranslocoService } from '@jsverse/transloco';
import { ServicerReportStore } from './servicer-report.store';
import { ServicerReportFilter } from './models/servicer-report.model';
import { InterventionType } from '../device-management/models/intervention.model';
import { ConfigStore } from '../../core/config/config.store';

@Component({
  selector: 'app-servicer-report',
  templateUrl: './servicer-report.page.html',
  styleUrls: ['./servicer-report.page.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
  providers: [ServicerReportStore],
  imports: [
    FormsModule,
    IonHeader, IonToolbar, IonTitle, IonContent, IonButtons, IonBackButton,
    IonButton, IonIcon, IonItem, IonLabel, IonList, IonCheckbox,
    IonMenuButton, IonSpinner, IonSelect, IonSelectOption, IonNote,
    IonFooter, IonInput, IonSkeletonText,
    TranslocoModule,
  ],
})
export class ServicerReportPage {
  protected readonly store = inject(ServicerReportStore);
  private readonly toastCtrl = inject(ToastController);
  private readonly transloco = inject(TranslocoService);
  private readonly configStore = inject(ConfigStore);

  /** mode2 (BusinessConfig.appMode) hides the type filter — all types always shown. */
  protected get isMode2(): boolean {
    return this.configStore.business()?.appMode === 'mode2';
  }

  /** ISO date string yyyy-MM-dd bound to the date input. Default: first day of current month. */
  protected dateFrom = '';

  /** ISO date string yyyy-MM-dd bound to the date input. Default: today. */
  protected dateTo = '';

  /** Currently selected intervention types for the multi-select. Default: all. */
  protected selectedTypes: string[] = [];

  /** All intervention types as multi-select options with generic (device-agnostic) labels. */
  protected readonly interventionTypeOptions: { value: string; labelKey: string }[] = [
    { value: InterventionType.COMMISSIONING, labelKey: 'servicer_report_type_commissioning' },
    { value: InterventionType.ANNUAL_SERVICE, labelKey: 'servicer_report_type_annual_service' },
    { value: InterventionType.INTERVENTION_REPAIR, labelKey: 'servicer_report_type_repair' },
    { value: InterventionType.INTERVENTION_NOISE, labelKey: 'servicer_report_type_noise' },
    { value: InterventionType.INTERVENTION_REPLACE, labelKey: 'servicer_report_type_replace' },
  ];

  /** Placeholder rows for the loading skeleton. */
  protected readonly skeletonRows = [0, 1, 2, 3, 4, 5];

  constructor() {
    addIcons({ searchOutline, downloadOutline });
    this.initDefaults();
  }

  /** Validates the filter inputs and triggers the search. */
  protected onSearch(): void {
    if (!this.dateFrom || !this.dateTo) {
      void this.showToast('servicer_report_date_required');
      return;
    }

    const from = new Date(this.dateFrom + 'T00:00:00');
    const to = new Date(this.dateTo + 'T23:59:59.999');

    if (from.getTime() > to.getTime()) {
      void this.showToast('servicer_report_date_invalid');
      return;
    }

    const diffDays = Math.ceil((to.getTime() - from.getTime()) / (1000 * 60 * 60 * 24));
    if (diffDays > 365) {
      void this.showToast('servicer_report_period_error');
      return;
    }

    const filter: ServicerReportFilter = { dateFrom: from, dateTo: to };
    void this.store.search(filter, this.selectedTypes);
  }

  /** Re-filters the loaded results client-side (no re-query). */
  protected onTypeFilterChange(event: CustomEvent): void {
    this.selectedTypes = event.detail.value as string[];
    this.store.setTypeFilter(this.selectedTypes);
  }

  protected onExport(): void {
    void this.store.exportPdf();
  }

  private initDefaults(): void {
    const today = new Date();
    const firstOfMonth = new Date(today.getFullYear(), today.getMonth(), 1);
    this.dateFrom = this.toIsoDateString(firstOfMonth);
    this.dateTo = this.toIsoDateString(today);
    this.selectedTypes = this.interventionTypeOptions.map((o) => o.value);
  }

  private toIsoDateString(date: Date): string {
    const y = date.getFullYear();
    const m = String(date.getMonth() + 1).padStart(2, '0');
    const d = String(date.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
  }

  private async showToast(translationKey: string): Promise<void> {
    const toast = await this.toastCtrl.create({
      message: this.transloco.translate(translationKey),
      duration: 3000,
      position: 'bottom',
    });
    await toast.present();
  }
}
