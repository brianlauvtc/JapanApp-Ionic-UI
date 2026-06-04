import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { IonicModule } from '@ionic/angular';
import { NgApexchartsModule } from 'ng-apexcharts';
import { AnalysisPagePage } from './analysis-page.page';
import { AnalysisPageRoutingModule } from './analysis-page-routing.module';
import { AnalysisStatisticsComponent } from '../components/analysis-statistics/analysis-statistics.component';
import { AddTransactionPageSharedModule } from '../../add-transaction/add-transaction-page/add-transaction-page-shared.module';

@NgModule({
  imports: [
    CommonModule,
    FormsModule,
    IonicModule,
    NgApexchartsModule,
    AnalysisPageRoutingModule,
    AddTransactionPageSharedModule
  ],
  declarations: [
    AnalysisPagePage,
    AnalysisStatisticsComponent
  ],
  exports: [
    AnalysisStatisticsComponent
  ]
})
export class AnalysisPageModule { }