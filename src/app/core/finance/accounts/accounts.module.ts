import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { AccountsRoutingModule } from './accounts-routing.module';
import { IonicModule } from '@ionic/angular';
import { SharedComponentsModule } from '../../../shared/components/shared-components.module';
import { AccountPage } from './account/account.page';

@NgModule({
  imports: [
    CommonModule,
    AccountsRoutingModule,
    IonicModule,
    SharedComponentsModule
  ],
  declarations: [AccountPage]
})
export class AccountsModule { }