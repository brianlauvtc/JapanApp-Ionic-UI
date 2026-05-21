import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { IonicModule } from '@ionic/angular';
import { AnalysisPagePage } from './analysis-page/analysis-page.page';
import { AnalysisPageRoutingModule } from './analysis-page-routing.module';

@NgModule({
  imports: [
    CommonModule,
    FormsModule,
    IonicModule,
    AnalysisPageRoutingModule
  ],
  declarations: [AnalysisPagePage]
})
export class AnalysisPageModule { }