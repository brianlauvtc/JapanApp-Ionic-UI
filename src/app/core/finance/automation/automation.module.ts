import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { IonicModule } from '@ionic/angular';
import { RecurringListPage } from './recurring-list/recurring-list.page';
import { AddRecurringModalComponent } from './add-recurring-modal/add-recurring-modal.component';
import { AutomationRoutingModule } from './automation-routing.module';

@NgModule({
  imports: [
    CommonModule,
    IonicModule,
    AutomationRoutingModule
  ],
  declarations: [
    RecurringListPage,
    AddRecurringModalComponent
  ]
})
export class AutomationModule { }
