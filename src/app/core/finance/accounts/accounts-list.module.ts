import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { IonicModule } from '@ionic/angular';
import { AccountsListPage } from './accounts-list/accounts-list.page';
import { AccountsListRoutingModule } from './accounts-list-routing.module';
import { SharedComponentsModule } from '../../../shared/components/shared-components.module';

@NgModule({
  imports: [
    CommonModule,
    IonicModule,
    AccountsListRoutingModule,
    SharedComponentsModule
  ],
  declarations: [AccountsListPage]
})
export class AccountsListModule { }