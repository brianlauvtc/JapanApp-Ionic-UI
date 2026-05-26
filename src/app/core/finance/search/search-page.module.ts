import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { IonicModule } from '@ionic/angular';
import { SearchRoutingModule } from './search-routing.module';
import { SearchPage } from './search-page.page';
import { SharedComponentsModule } from '../../../shared/components/shared-components.module';

@NgModule({
  imports: [
    CommonModule,
    IonicModule,
    SearchRoutingModule,
    SharedComponentsModule
  ],
  declarations: [SearchPage]
})
export class SearchPageModule { }
