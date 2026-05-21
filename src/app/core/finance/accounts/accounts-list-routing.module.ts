import { NgModule } from '@angular/core';
import { RouterModule, Routes } from '@angular/router';
import { AccountsListPage } from './accounts-list/accounts-list.page';

const routes: Routes = [
  {
    path: '',
    component: AccountsListPage
  }
];

@NgModule({
  imports: [RouterModule.forChild(routes)],
  exports: [RouterModule]
})
export class AccountsListRoutingModule { }