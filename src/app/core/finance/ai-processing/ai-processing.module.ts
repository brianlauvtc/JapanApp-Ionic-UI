import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';

import { IonicModule } from '@ionic/angular';

import { AIProcessingPageRoutingModule } from './ai-processing-routing.module';

import { AIProcessingPage } from './ai-processing.page';

@NgModule({
  imports: [
    CommonModule,
    FormsModule,
    IonicModule,
    AIProcessingPageRoutingModule
  ],
  declarations: [AIProcessingPage]
})
export class AIProcessingPageModule {}