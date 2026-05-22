import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { IonicModule } from '@ionic/angular';
import { FundDetailPage } from './fund-detail.page';
import { FundDetailRoutingModule } from './fund-detail-routing.module';
import { SharedComponentsModule } from '../../../../shared/components/shared-components.module';
import { NgApexchartsModule } from 'ng-apexcharts';
import { EditFundModalPageModule } from '../edit-fund-modal/edit-fund-modal.module';

@NgModule({
  imports: [
    CommonModule,
    IonicModule,
    FundDetailRoutingModule,
    SharedComponentsModule,
    NgApexchartsModule,
    EditFundModalPageModule
  ],
  declarations: [FundDetailPage]
})
export class FundDetailModule { }