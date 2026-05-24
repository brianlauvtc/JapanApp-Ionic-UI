import { NgModule } from '@angular/core';
import { RouterModule, Routes } from '@angular/router';
import { TabsPage } from './tabs.page';

const routes: Routes = [
  {
    path: '',
    component: TabsPage,
    children: [
      {
        path: 'home',
        loadChildren: () => import('../core/finance/home/home-page/home-page.module').then(m => m.HomePageModule)
      },
      {
        path: 'accounts',
        loadChildren: () => import('../core/finance/accounts/accounts.module').then(m => m.AccountsModule)
      },
      {
        path: 'analysis',
        loadChildren: () => import('../core/finance/analysis/analysis-page/analysis-page.module').then(m => m.AnalysisPageModule)
      },
      {
        path: 'settings',
        loadChildren: () => import('../core/finance/settings/settings-page/settings-page.module').then(m => m.SettingsPageModule)
      },
     
      {
        path: '',
        redirectTo: '/tabs/home',
        pathMatch: 'full'
      }
    ]
  }
];

@NgModule({
  imports: [RouterModule.forChild(routes)],
  exports: [RouterModule]
})
export class TabsPageRoutingModule {}