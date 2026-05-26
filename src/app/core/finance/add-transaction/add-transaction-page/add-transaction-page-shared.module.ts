import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule, ReactiveFormsModule } from '@angular/forms';
import { IonicModule, NavParams } from '@ionic/angular';
import { AddTransactionPagePage } from './add-transaction-page.page';

@NgModule({
  imports: [
    CommonModule,
    FormsModule,
    ReactiveFormsModule,
    IonicModule
  ],
  declarations: [AddTransactionPagePage],
  exports: [AddTransactionPagePage],
  providers: [NavParams]
})
export class AddTransactionPageSharedModule { }
