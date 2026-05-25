import { NgModule } from '@angular/core';
import { Routes, RouterModule } from '@angular/router';
import { AccountPage } from './account/account.page';


const routes: Routes = [
  {
    path: '',
    component: AccountPage, // The new wrapper
    children: [
      {
        path: '',
        redirectTo: 'accounts-list',
        pathMatch: 'full'
      },
      {
        path: 'accounts-list',
        loadChildren: () => import('./accounts-list/accounts-list.module').then(m => m.AccountsListModule)
      },
      {
        path: 'account-detail',
        loadChildren: () => import('./account-detail/account-detail.module').then(m => m.AccountDetailModule)
      },
      {
        path: 'fund-detail',
        loadChildren: () => import('./fund-detail/fund-detail.module').then( m => m.FundDetailModule)
      }
    ]
  }
];
@NgModule({
  imports: [RouterModule.forChild(routes)],
  exports: [RouterModule],
})
export class AccountsRoutingModule {}