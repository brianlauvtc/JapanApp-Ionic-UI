import { NgModule } from '@angular/core';
import { RouterModule, Routes } from '@angular/router';

const routes: Routes = [
  {
    path: '',
    loadChildren: () => import('./accounts-list/accounts-list.module').then(m => m.AccountsListModule)
  },
  {
    path: 'account-detail/:id',
    loadChildren: () => import('./account-detail/account-detail.module').then(m => m.AccountDetailModule)
  },
  {
    path: 'fund-detail/:id',
    loadChildren: () => import('./fund-detail/fund-detail.module').then(m => m.FundDetailModule)
  }
];

@NgModule({
  imports: [RouterModule.forChild(routes)],
  exports: [RouterModule]
})
export class AccountsRoutingModule { }