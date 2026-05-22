import { NgModule } from '@angular/core';
import { AddTransactionPageSharedModule } from './add-transaction-page-shared.module';
import { AddTransactionPageRoutingModule } from './add-transaction-page-routing.module';

@NgModule({
  imports: [
    AddTransactionPageSharedModule,
    AddTransactionPageRoutingModule
  ]
})
export class AddTransactionPageModule { }
