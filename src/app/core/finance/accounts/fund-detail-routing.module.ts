import { NgModule } from '@angular/core';
import { RouterModule, Routes } from '@angular/router';
import { FundDetailPage } from './fund-detail/fund-detail.page';

const routes: Routes = [
  {
    path: ':id',
    component: FundDetailPage
  }
];

@NgModule({
  imports: [RouterModule.forChild(routes)],
  exports: [RouterModule]
})
export class FundDetailRoutingModule { }