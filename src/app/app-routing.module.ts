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
    path: 'add-transaction',
    loadChildren: () => import('./core/finance/add-transaction/add-transaction.module').then(m => m.AddTransactionModule)
  },
  {
    path: 'auto-upload-receipt',
    loadChildren: () => import('./core/finance/auto-upload-receipt/auto-upload-receipt.module').then(m => m.AutoUploadReceiptPageModule)
  },
  {
    path: 'ai-processing',
    loadChildren: () => import('./core/finance/ai-processing/ai-processing.module').then(m => m.AIProcessingPageModule)
  }
];

@NgModule({
  imports: [
    RouterModule.forRoot(routes, { preloadingStrategy: PreloadAllModules })
  ],
  exports: [RouterModule]
})
export class AppRoutingModule {}