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
import { PlanCreateComponent } from '@features/csr-plan-management/plan-create/plan-create';
import { SitesListComponent } from '@features/site-management/sites-list/sites-list';
import { UsersListComponent } from '@features/user-management/users-list/users-list';
import { UserDetailComponent } from '@features/user-management/user-detail/user-detail';
import { ProfileComponent } from '@features/user-management/profile/profile';
import { SiteFormComponent } from '@features/site-management/site-form/site-form';
import { EditSiteComponent } from '@features/site-management/edit-site/edit-site';
import { SiteUsersComponent } from '@features/site-management/site-users/site-users';
import { RealizedListComponent } from '@features/realized-activity-management/realized-list/realized-list';
import { RealizedDetailComponent } from '@features/realized-activity-management/realized-detail/realized-detail';
import { RealizedCreateComponent } from '@features/realized-activity-management/realized-create/realized-create';
import { PlanDetailComponent } from '@features/csr-plan-management/plan-detail/plan-detail';
import { PlanEditComponent } from '@features/csr-plan-management/plan-edit/plan-edit';
import { PlanValidationComponent } from '@features/csr-plan-management/plan-validation/plan-validation';
import { PlannedActivityCreateComponent } from '@features/csr-plan-management/planned-activity-create/planned-activity-create';
import { PlannedActivityDetailComponent } from '@features/csr-plan-management/planned-activity-detail/planned-activity-detail';
import { PlannedActivityEditComponent } from '@features/csr-plan-management/planned-activity-edit/planned-activity-edit';
import { PlannedActivitiesListComponent } from '@features/csr-plan-management/planned-activities-list/planned-activities-list';
import { RealizedEditComponent } from '@features/realized-activity-management/realized-edit/realized-edit';
import { DocumentsListComponent } from '@features/file-management/documents-list/documents-list';
import { CategoriesListComponent } from '@features/site-management/categories-list/categories-list';
import { ChangeRequestCreateComponent } from '@features/change-request-management/change-request-create/change-request-create';
import { ChangeRequestsListComponent } from '@features/change-request-management/change-requests-list/change-requests-list';
import { ChangeRequestsPendingComponent } from '@features/change-request-management/change-requests-pending/change-requests-pending';
import { ChangeRequestsHistoryComponent } from '@features/change-request-management/change-requests-history/change-requests-history';
import { ChangeRequestDetailComponent } from '@features/change-request-management/change-request-detail/change-request-detail';
import { AuditListComponent } from '@features/audit-history-management/audit-list/audit-list';

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
      { path: 'csr-plans/create', component: PlanCreateComponent },
      { path: 'csr-plans/:id', component: PlanDetailComponent },
      { path: 'csr-plans/:id/edit', component: PlanEditComponent },
      { path: 'annual-plans/validation', component: PlanValidationComponent },
      { path: 'planned-activities', component: PlannedActivitiesListComponent },
      { path: 'planned-activity/create', component: PlannedActivityCreateComponent },
      { path: 'planned-activity/:id/edit', component: PlannedActivityEditComponent },
      { path: 'planned-activity/:id', component: PlannedActivityDetailComponent },
      { path: 'realized-csr', component: RealizedListComponent },
      { path: 'realized-csr/create', component: RealizedCreateComponent },
      { path: 'realized-csr/:id/edit', component: RealizedEditComponent },
      { path: 'realized-csr/:id', component: RealizedDetailComponent },
      { path: 'sites', component: SitesListComponent, canActivate: [roleGuard(['corporate'])] },
      { path: 'categories', component: CategoriesListComponent, canActivate: [roleGuard(['corporate'])] },
      { path: 'sites/create', component: SiteFormComponent, canActivate: [roleGuard(['corporate'])] },
      { path: 'sites/edit/:id', component: EditSiteComponent, canActivate: [roleGuard(['corporate'])] },
      { path: 'admin/users', component: UsersListComponent, canActivate: [roleGuard(['corporate'])] },
      { path: 'admin/users/:id', component: UserDetailComponent, canActivate: [roleGuard(['corporate'])] },
      { path: 'account/profile', component: ProfileComponent },
      {path: 'sites/:id/users', component: SiteUsersComponent},
      { path: 'documents', component: DocumentsListComponent },
      { path: 'changes', component: ChangeRequestsListComponent },
      { path: 'changes/create', component: ChangeRequestCreateComponent },
      { path: 'changes/pending', component: ChangeRequestsPendingComponent, canActivate: [roleGuard(['corporate'])] },
      { path: 'changes/history', component: ChangeRequestsHistoryComponent, canActivate: [roleGuard(['corporate'])] },
      { path: 'changes/:id', component: ChangeRequestDetailComponent },
      { path: 'admin/audit', component: AuditListComponent, canActivate: [roleGuard(['corporate'])] },

      { path: '', redirectTo: 'dashboard', pathMatch: 'full' }
    ]
  },
  { path: '**', redirectTo: 'dashboard' }
];
