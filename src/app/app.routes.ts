import { Routes } from '@angular/router';
import { authGuard } from './core/auth/auth.guard';
import { featureGuard } from './core/config/feature.guard';

export const routes: Routes = [
  {
    path: 'login',
    loadComponent: () =>
      import('./features/auth/login/login.page').then((m) => m.LoginPage),
  },
  {
    path: '',
    loadComponent: () =>
      import('./layout/shell/shell.component').then((m) => m.ShellComponent),
    canActivate: [authGuard],
    children: [
      {
        path: 'home',
        loadComponent: () =>
          import('./features/home/home.page').then((m) => m.HomePage),
      },
      {
        path: 'search-by-device',
        loadComponent: () =>
          import('./features/device-catalog/search/device-search.page').then((m) => m.DeviceSearchPage),
        canMatch: [featureGuard('deviceCatalog')],
      },
      {
        path: 'device/:code/device-groups',
        loadComponent: () =>
          import('./features/device-catalog/device-groups/device-groups.page').then((m) => m.DeviceGroupsPage),
        canMatch: [featureGuard('deviceCatalog')],
      },
      {
        path: 'device/:code/device-groups/:groupId/device-parts',
        loadComponent: () =>
          import('./features/device-catalog/device-parts/device-parts.page').then((m) => m.DevicePartsPage),
        canMatch: [featureGuard('deviceCatalog')],
      },
      {
        path: 'docs',
        loadComponent: () =>
          import('./features/docs/list/docs-list.page').then((m) => m.DocsListPage),
        canMatch: [featureGuard('documentation')],
      },
      {
        path: 'cart',
        loadComponent: () =>
          import('./features/cart/cart.page').then((m) => m.CartPage),
        canMatch: [featureGuard('cart')],
      },
      {
        path: '',
        redirectTo: 'home',
        pathMatch: 'full',
      },
    ],
  },
];
