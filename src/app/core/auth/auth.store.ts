import { computed } from '@angular/core';
import { signalStore, withState, withComputed, withMethods, patchState } from '@ngrx/signals';
import { AuthUser } from './auth.model';

interface AuthState {
  user: AuthUser | null;
  isLoading: boolean;
  error: string | null;
}

const initialState: AuthState = {
  user: null,
  isLoading: false,
  error: null,
};

export const AuthStore = signalStore(
  { providedIn: 'root' },
  withState(initialState),

  withComputed((state) => ({
    isAuthenticated: computed(() => state.user() !== null),
    userEmail: computed(() => state.user()?.email ?? ''),
    userId: computed(() => state.user()?.uid ?? ''),
  })),

  withMethods((store) => ({
    setUser(user: AuthUser): void {
      patchState(store, { user, error: null });
    },

    clearUser(): void {
      patchState(store, { user: null, error: null });
    },

    setLoading(isLoading: boolean): void {
      patchState(store, { isLoading });
    },

    setError(error: string): void {
      patchState(store, { error, isLoading: false });
    },
  })),
);
