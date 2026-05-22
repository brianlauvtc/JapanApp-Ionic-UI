import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { IonicModule } from '@ionic/angular';
import { AccountsListPage } from './accounts-list/accounts-list.page';
import { AccountsListRoutingModule } from './accounts-list-routing.module';
import { SharedComponentsModule } from '../../../shared/components/shared-components.module';
import { EditAccountModalPageModule } from './edit-account-modal/edit-account-modal.module';
import { EditFundModalPageModule } from './edit-fund-modal/edit-fund-modal.module';

@NgModule({
  imports: [
    CommonModule,
    IonicModule,
    AccountsListRoutingModule,
    SharedComponentsModule,
    EditAccountModalPageModule,
    EditFundModalPageModule
  ],
  declarations: [AccountsListPage]
})
export class AccountsListModule { }