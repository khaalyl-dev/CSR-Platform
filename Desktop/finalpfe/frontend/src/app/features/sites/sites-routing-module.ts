import { NgModule } from '@angular/core';
import { RouterModule, Routes } from '@angular/router';
import { SitesListComponent } from './sites-list/sites-list';
import { SitesDetailComponent } from './sites-detail/sites-detail';

const routes: Routes = [
  { path: '', component: SitesListComponent },
  { path: 'detail/:id', component: SitesDetailComponent }
];

@NgModule({
  imports: [RouterModule.forChild(routes)],
  exports: [RouterModule]
})
export class SitesRoutingModule { }
