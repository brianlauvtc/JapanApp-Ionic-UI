import { NgModule } from '@angular/core';
import { RouterModule, Routes } from '@angular/router';
import { RecurringListPage } from './recurring-list/recurring-list.page';

const routes: Routes = [
  {
    path: '',
    component: RecurringListPage
  }
];

@NgModule({
  imports: [RouterModule.forChild(routes)],
  exports: [RouterModule]
})
export class AutomationRoutingModule { }
