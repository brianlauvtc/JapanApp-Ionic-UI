import { NgModule } from '@angular/core';
import { RouterModule, Routes } from '@angular/router';
import { ReceiptConfirmationPage } from './receipt-confirmation.page';

const routes: Routes = [
  {
    path: '',
    component: ReceiptConfirmationPage
  }
];

@NgModule({
  imports: [RouterModule.forChild(routes)],
  exports: [RouterModule]
})
export class ReceiptConfirmationPageRoutingModule {}