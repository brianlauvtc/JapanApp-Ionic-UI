import { NgModule } from '@angular/core';
import { RouterModule, Routes } from '@angular/router';
import { AIProcessingPage } from './ai-processing.page';

const routes: Routes = [
  {
    path: '',
    component: AIProcessingPage
  }
];

@NgModule({
  imports: [RouterModule.forChild(routes)],
  exports: [RouterModule]
})
export class AIProcessingPageRoutingModule {}