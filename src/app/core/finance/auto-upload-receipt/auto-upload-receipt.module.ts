import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';

import { IonicModule } from '@ionic/angular';

import { AutoUploadReceiptPageRoutingModule } from './auto-upload-receipt-routing.module';

import { AutoUploadReceiptPage } from './auto-upload-receipt.page';

@NgModule({
  imports: [
    CommonModule,
    FormsModule,
    IonicModule,
    AutoUploadReceiptPageRoutingModule
  ],
  declarations: [AutoUploadReceiptPage]
})
export class AutoUploadReceiptPageModule {}