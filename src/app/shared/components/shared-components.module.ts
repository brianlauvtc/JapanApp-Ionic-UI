import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { IonicModule } from '@ionic/angular';
import { TransactionItemComponent } from './transaction-item/transaction-item.component';

@NgModule({
  declarations: [
    TransactionItemComponent
  ],
  imports: [
    CommonModule,
    IonicModule
  ],
  exports: [
    TransactionItemComponent
  ]
})
export class SharedComponentsModule { }