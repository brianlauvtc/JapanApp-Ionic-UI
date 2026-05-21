import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { IonicModule } from '@ionic/angular';
import { AccountDetailPage } from './account-detail/account-detail.page';
import { AccountDetailRoutingModule } from './account-detail-routing.module';
import { SharedComponentsModule } from '../../../shared/components/shared-components.module';
import { NgApexchartsModule } from 'ng-apexcharts';

@NgModule({
  imports: [
    CommonModule,
    IonicModule,
    AccountDetailRoutingModule,
    SharedComponentsModule,
    NgApexchartsModule
  ],
  declarations: [AccountDetailPage]
})
export class AccountDetailModule { }