import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { IonicModule } from '@ionic/angular';
import { AccountPage } from './account.page';
import { AccountRoutingModule } from './account-routing.module';
import { SharedComponentsModule } from '../../../../shared/components/shared-components.module';
import { NgApexchartsModule } from 'ng-apexcharts';
import { EditFundModalPageModule } from '../edit-fund-modal/edit-fund-modal.module';

@NgModule({
  imports: [
    CommonModule,
    IonicModule,
    AccountRoutingModule,
    SharedComponentsModule,
    NgApexchartsModule,
    EditFundModalPageModule
  ],
  declarations: [AccountPage]
})
export class AccountModule { }