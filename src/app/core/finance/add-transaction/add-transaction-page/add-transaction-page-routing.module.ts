import { NgModule } from '@angular/core';
import { RouterModule, Routes } from '@angular/router';
import { AddTransactionPagePage } from './add-transaction-page/add-transaction-page.page';

const routes: Routes = [
  {
    path: '',
    component: AddTransactionPagePage
  }
];

@NgModule({
  imports: [RouterModule.forChild(routes)],
  exports: [RouterModule]
})
export class AddTransactionPageRoutingModule { }