import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { IonicModule } from '@ionic/angular';
import { HomePagePage } from './home-page.page';
import { HomePageRoutingModule } from './home-page-routing.module';
import { SharedComponentsModule } from '../../../../shared/components/shared-components.module';
import { NgApexchartsModule } from 'ng-apexcharts';
import { AddTransactionPageSharedModule } from '../../add-transaction/add-transaction-page/add-transaction-page-shared.module';

@NgModule({
  imports: [
    CommonModule,
    IonicModule,
    HomePageRoutingModule,
    SharedComponentsModule,
    NgApexchartsModule,
    AddTransactionPageSharedModule
  ],
  declarations: [HomePagePage]
})
export class HomePageModule { }