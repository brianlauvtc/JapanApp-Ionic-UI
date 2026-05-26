import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule, ReactiveFormsModule } from '@angular/forms';

import { IonicModule } from '@ionic/angular';

import { ReceiptConfirmationPageRoutingModule } from './receipt-confirmation-routing.module';

import { ReceiptConfirmationPage } from './receipt-confirmation.page';

@NgModule({
  imports: [
    CommonModule,
    FormsModule,
    ReactiveFormsModule,
    IonicModule,
    ReceiptConfirmationPageRoutingModule
  ],
  declarations: [ReceiptConfirmationPage]
})
export class ReceiptConfirmationPageModule {}