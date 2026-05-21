import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { IonicModule } from '@ionic/angular';
import { FundDetailPage } from './fund-detail/fund-detail.page';
import { FundDetailRoutingModule } from './fund-detail-routing.module';
import { SharedComponentsModule } from '../../../shared/components/shared-components.module';
import { NgApexchartsModule } from 'ng-apexcharts';

@NgModule({
  imports: [
    CommonModule,
    IonicModule,
    FundDetailRoutingModule,
    SharedComponentsModule,
    NgApexchartsModule
  ],
  declarations: [FundDetailPage]
})
export class FundDetailModule { }