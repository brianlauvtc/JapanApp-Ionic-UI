import { NgModule } from '@angular/core';
import { PreloadAllModules, RouterModule, Routes } from '@angular/router';

const routes: Routes = [
  {
    path: '',
    redirectTo: '/tabs/home',
    pathMatch: 'full'
  },
  {
    path: 'tabs',
    loadChildren: () => import('./tabs/tabs.module').then(m => m.TabsPageModule)
  },
  {
    path: 'account-detail/:id',
    loadChildren: () => import('./core/finance/accounts/account-detail.module').then(m => m.AccountDetailModule)
  },
  {
    path: 'fund-detail/:id',
    loadChildren: () => import('./core/finance/accounts/fund-detail.module').then(m => m.FundDetailModule)
  }
];

@NgModule({
  imports: [
    RouterModule.forRoot(routes, { preloadingStrategy: PreloadAllModules })
  ],
  exports: [RouterModule]
})
export class AppRoutingModule {}