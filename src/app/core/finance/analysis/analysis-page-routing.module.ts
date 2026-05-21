import { NgModule } from '@angular/core';
import { RouterModule, Routes } from '@angular/router';
import { AnalysisPagePage } from './analysis-page/analysis-page.page';

const routes: Routes = [
  {
    path: '',
    component: AnalysisPagePage
  }
];

@NgModule({
  imports: [RouterModule.forChild(routes)],
  exports: [RouterModule]
})
export class AnalysisPageRoutingModule { }