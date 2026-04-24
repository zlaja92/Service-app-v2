import { signalStore, withState, withMethods, patchState } from '@ngrx/signals';

interface TenantState {
  tenantId: string | null;
  role: string | null;
  servicerId: string | null;
  deviceTypes: string[];
}

const initialState: TenantState = {
  tenantId: null,
  role: null,
  servicerId: null,
  deviceTypes: [],
};

export const TenantStore = signalStore(
  { providedIn: 'root' },
  withState(initialState),

  withMethods((store) => ({
    setTenant(
      tenantId: string | null,
      role: string | null,
      servicerId: string | null,
      deviceTypes: string[] = [],
    ): void {
      patchState(store, { tenantId, role, servicerId, deviceTypes });
    },

    clear(): void {
      patchState(store, initialState);
    },
  })),
);
