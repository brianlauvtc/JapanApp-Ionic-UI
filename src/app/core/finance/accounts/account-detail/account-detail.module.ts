import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { IonicModule } from '@ionic/angular';
import { AccountDetailPage } from './account-detail.page';
import { AccountDetailRoutingModule } from './account-detail-routing.module';
import { SharedComponentsModule } from '../../../../shared/components/shared-components.module';
import { NgApexchartsModule } from 'ng-apexcharts';
import { EditAccountModalPageModule } from '../edit-account-modal/edit-account-modal.module';

@NgModule({
  imports: [
    CommonModule,
    IonicModule,
    AccountDetailRoutingModule,
    SharedComponentsModule,
    NgApexchartsModule,
    EditAccountModalPageModule
  ],
  declarations: [AccountDetailPage]
})
export class AccountDetailModule { }