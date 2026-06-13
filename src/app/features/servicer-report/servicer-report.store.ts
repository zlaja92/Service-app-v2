import { computed, inject } from '@angular/core';
import { signalStore, withState, withComputed, withMethods, patchState } from '@ngrx/signals';
import { LoggerService } from '../../core/logger/logger.service';
import { ServicerReportService } from './services/servicer-report.service';
import { ServicerReportAssemblerService } from './services/servicer-report-assembler.service';
import { ServicerReportItem, ServicerReportFilter } from './models/servicer-report.model';

interface ServicerReportState {
  /** All loaded interventions (unfiltered); each carries its own checkbox state. */
  items: ServicerReportItem[];
  /** Client-side type filter; empty array = show all types. */
  selectedInterventionTypes: string[];
  isLoading: boolean;
  isExporting: boolean;
  /** i18n key of the load error, or null. The UI translates it. */
  error: string | null;
  /** True after the first search — distinguishes "not searched yet" from "no results". */
  hasSearched: boolean;
  /** Last successfully submitted date filter — needed for the PDF period on export. */
  lastFilter: ServicerReportFilter | null;
}

const initialState: ServicerReportState = {
  items: [],
  selectedInterventionTypes: [],
  isLoading: false,
  isExporting: false,
  error: null,
  hasSearched: false,
  lastFilter: null,
};

/**
 * Component-scoped store for the servicer-report page.
 * NOT providedIn root — provide it in the page component
 * (`providers: [ServicerReportStore]`) so the state resets on every visit.
 */
export const ServicerReportStore = signalStore(
  withState(initialState),

  withComputed((state) => {
    const filteredItems = computed(() => {
      const types = state.selectedInterventionTypes();
      const allItems = state.items();
      if (types.length === 0) {
        return allItems;
      }
      return allItems.filter((item) => types.includes(item.interventionType));
    });

    const selectedItems = computed(() => filteredItems().filter((item) => item.selected));

    const selectedCount = computed(() => selectedItems().length);

    return {
      filteredItems,
      selectedItems,
      selectedCount,

      totalCount: computed(() => filteredItems().length),

      allSelected: computed(() => {
        const filtered = filteredItems();
        return filtered.length > 0 && filtered.every((item) => item.selected);
      }),

      hasItems: computed(() => filteredItems().length > 0),

      canExport: computed(
        () => selectedCount() > 0 && !state.isExporting() && state.lastFilter() !== null,
      ),

      totalSelectedDistance: computed(() =>
        selectedItems().reduce((sum, item) => sum + item.distance, 0),
      ),
    };
  }),

  withMethods((store) => {
    const servicerReportService = inject(ServicerReportService);
    const assemblerService = inject(ServicerReportAssemblerService);
    const logger = inject(LoggerService);

    return {
      /** Loads the servicer's interventions for the given date range. */
      async search(filter: ServicerReportFilter, types: string[]): Promise<void> {
        patchState(store, {
          isLoading: true,
          error: null,
          hasSearched: true,
          selectedInterventionTypes: types,
          lastFilter: filter,
        });

        try {
          const items = await servicerReportService.getServicerInterventions(filter);
          patchState(store, { items, isLoading: false });
        } catch (error) {
          logger.error('ServicerReportStore: search failed', { error: String(error) });
          patchState(store, {
            items: [],
            isLoading: false,
            error: 'servicer_report_load_error',
          });
        }
      },

      /** Changes the client-side intervention-type filter (no re-query). */
      setTypeFilter(types: string[]): void {
        patchState(store, { selectedInterventionTypes: types });
      },

      /** Toggles the checkbox state of a single item. */
      toggleItem(docId: string): void {
        patchState(store, {
          items: store.items().map((item) =>
            item.docId === docId ? { ...item, selected: !item.selected } : item,
          ),
        });
      },

      /**
       * Selects/deselects all currently visible (type-filtered) items.
       * Items hidden by the type filter keep their selection state.
       */
      toggleAll(checked: boolean): void {
        const visibleDocIds = new Set(store.filteredItems().map((item) => item.docId));
        patchState(store, {
          items: store.items().map((item) =>
            visibleDocIds.has(item.docId) ? { ...item, selected: checked } : item,
          ),
        });
      },

      /** Generates the PDF from the currently selected items. */
      async exportPdf(): Promise<void> {
        const selected = store.selectedItems();
        const lastFilter = store.lastFilter();

        if (selected.length === 0 || store.isExporting() || !lastFilter) {
          return;
        }

        patchState(store, { isExporting: true });
        try {
          await assemblerService.export(selected, lastFilter.dateFrom, lastFilter.dateTo);
        } finally {
          patchState(store, { isExporting: false });
        }
      },
    };
  }),
);
