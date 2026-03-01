/**
 * App routing configuration.
 * /account/profile - Profile page (Mon Profil), accessible to all authenticated users.
 */
import { Routes } from '@angular/router';
import { Login } from '@features/user-management/login/login';
import { Dashboard } from '@features/dashboard-analytics/dashboard/dashboard';
import { MainLayout } from '@shared/layouts/main-layout/main-layout';
import { authGuard, roleGuard } from '@core/guards/auth.guard';
import { AnnualPlansComponent } from '@features/csr-plan-management/annual-plans/annual-plans';
import { SitesListComponent } from '@features/site-management/sites-list/sites-list';
import { UsersListComponent } from '@features/user-management/users-list/users-list';
import { UserDetailComponent } from '@features/user-management/user-detail/user-detail';
import { ProfileComponent } from '@features/user-management/profile/profile';
import { SiteFormComponent } from '@features/site-management/site-form/site-form';
import { EditSiteComponent } from '@features/site-management/edit-site/edit-site';
import { SiteUsersComponent } from '@features/site-management/site-users/site-users';

export const routes: Routes = [
  { path: 'login', component: Login },
  {
    path: '',
    component: MainLayout,
    canActivate: [authGuard],
    children: [
      { path: 'dashboard', component: Dashboard },
      { path: 'dashboard/corporate', component: Dashboard, canActivate: [roleGuard(['corporate'])] },
      { path: 'dashboard/site', component: Dashboard, canActivate: [roleGuard(['site'])] },
      { path: 'csr-plans', component: AnnualPlansComponent },
      { path: 'sites', component: SitesListComponent },
      { path: 'sites/create', component: SiteFormComponent },
      { path: 'sites/edit/:id', component: EditSiteComponent },
      { path: 'admin/users', component: UsersListComponent, canActivate: [roleGuard(['corporate'])] },
      { path: 'admin/users/:id', component: UserDetailComponent, canActivate: [roleGuard(['corporate'])] },
      { path: 'account/profile', component: ProfileComponent },
      {path: 'sites/:id/users', component: SiteUsersComponent},
      { path: '', redirectTo: 'dashboard', pathMatch: 'full' }
    ]
  },
  { path: '**', redirectTo: 'dashboard' }
];
