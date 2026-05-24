import { NgModule } from '@angular/core';
import { Routes, RouterModule } from '@angular/router';
import { AccountsListModule } from './accounts-list/accounts-list.module';

const routes: Routes = [
  {
    path: '',
    loadChildren: () => import('./accounts-list/accounts-list.module').then(m => m.AccountsListModule)
  },
  // 👇 確保詳情頁是獨立在同一個陣列層級 (不要包在上面的 children 裡)
  {
    path: 'account-detail/:id',
    loadChildren: () => import('./account-detail/account-detail.module').then( m => m.AccountDetailModule)
  },
  {
    path: 'fund-detail/:id',
    loadChildren: () => import('./fund-detail/fund-detail.module').then( m => m.FundDetailModule)
  }
];

@NgModule({
  imports: [RouterModule.forChild(routes)],
  exports: [RouterModule],
})
export class AccountsRoutingModule {}