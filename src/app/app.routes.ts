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
          import('./features/search/search-by-device/search-by-device.page').then((m) => m.SearchByDevicePage),
        canMatch: [featureGuard('searchByDevice')],
      },
      {
        path: 'device/:code/device-groups',
        loadComponent: () =>
          import('./features/device/device-groups/device-groups.page').then((m) => m.DeviceGroupsPage),
        canMatch: [featureGuard('searchByDevice')],
      },
      {
        path: 'device/:code/device-groups/:groupId/device-parts',
        loadComponent: () =>
          import('./features/device/device-parts/device-parts.page').then((m) => m.DevicePartsPage),
        canMatch: [featureGuard('searchByDevice')],
      },
      {
        path: '',
        redirectTo: 'home',
        pathMatch: 'full',
      },
    ],
  },
];
