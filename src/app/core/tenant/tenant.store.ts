import { signalStore, withState, withMethods, patchState } from '@ngrx/signals';

interface TenantState {
  tenantId: string | null;
  role: string | null;
  servicerId: string | null;
}

const initialState: TenantState = {
  tenantId: null,
  role: null,
  servicerId: null,
};

export const TenantStore = signalStore(
  { providedIn: 'root' },
  withState(initialState),

  withMethods((store) => ({
    setTenant(tenantId: string | null, role: string | null, servicerId: string | null): void {
      patchState(store, { tenantId, role, servicerId });
    },

    clear(): void {
      patchState(store, initialState);
    },
  })),
);
