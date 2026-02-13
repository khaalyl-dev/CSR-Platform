import { Routes } from '@angular/router';
import { Login } from './features/auth/login';
import { Dashboard } from './features/dashboard/dashboard';
import { MainLayout } from './app/main-layout/main-layout';
import { authGuard } from './core/auth.guard';
import { roleGuard } from './core/auth.guard';
import { AnnualPlansComponent } from './app/features/annual-plans/annual-plans';
import { SitesListComponent } from './app/features/sites/sites-list/sites-list';


export const routes: Routes = [
  { path: 'login', component: Login },
  {
    path: '',
    component: MainLayout,
    canActivate: [authGuard],
    children: [
      { path: 'dashboard', component: Dashboard },
      { path: 'annual-plans', component: AnnualPlansComponent },
      { path: '', redirectTo: 'dashboard', pathMatch: 'full' },
      { path: 'sites', component: SitesListComponent },





    ]
  },
  { path: '**', redirectTo: 'dashboard' }
];
