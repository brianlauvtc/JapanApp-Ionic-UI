import { NgModule } from '@angular/core';
import { RouterModule, Routes } from '@angular/router';

const routes: Routes = [
  {
    path: 'home',
    loadChildren: () => import('./home/home.module').then(m => m.HomeModule)
  },
  {
    path: 'accounts',
    loadChildren: () => import('./accounts/accounts.module').then(m => m.AccountsModule)
  },
  {
    path: 'account-detail/:id',
    loadChildren: () => import('./accounts/account-detail/account-detail.module').then(m => m.AccountDetailModule)
  },
  {
    path: 'fund-detail/:id',
    loadChildren: () => import('./accounts/fund-detail/fund-detail.module').then(m => m.FundDetailModule)
  },
  {
    path: 'add-transaction',
    loadChildren: () => import('./add-transaction/add-transaction.module').then(m => m.AddTransactionModule)
  },
  {
    path: 'analysis',
    loadChildren: () => import('./analysis/analysis.module').then(m => m.AnalysisModule)
  },
  {
    path: 'settings',
    loadChildren: () => import('./settings/settings.module').then(m => m.SettingsModule)
  }
];

@NgModule({
  imports: [RouterModule.forChild(routes)],
  exports: [RouterModule]
})
export class FinanceRoutingModule { }