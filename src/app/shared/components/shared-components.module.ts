import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { IonicModule } from '@ionic/angular';
import { TransactionItemComponent } from './transaction-item/transaction-item.component';
import { SearchBarComponent } from './search-bar/search-bar.component';
import { ChartCardComponent } from './chart-card/chart-card.component';

@NgModule({
  declarations: [
    TransactionItemComponent,
    SearchBarComponent,
    ChartCardComponent
  ],
  imports: [
    CommonModule,
    IonicModule
  ],
  exports: [
    TransactionItemComponent,
    SearchBarComponent,
    ChartCardComponent
  ]
})
export class SharedComponentsModule { }
