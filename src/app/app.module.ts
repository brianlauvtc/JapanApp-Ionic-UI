import { NgModule } from '@angular/core';
import { BrowserModule } from '@angular/platform-browser';
import { RouteReuseStrategy } from '@angular/router';
import { IonicModule, IonicRouteStrategy } from '@ionic/angular';
import { Storage } from '@ionic/storage-angular';
import { HttpClientModule } from '@angular/common/http';

import { AppComponent } from './app.component';
import { AppRoutingModule } from './app-routing.module';
import { AddTransactionPageSharedModule } from './core/finance/add-transaction/add-transaction-page/add-transaction-page-shared.module';
import { FinanceVarService } from './core/finance/service/finance-var.service';
import { FinanceService } from './core/finance/service/finance.service';
import { AIService } from './core/finance/service/ai.service';

@NgModule({
  declarations: [AppComponent],
  imports: [
    BrowserModule,
    IonicModule.forRoot(),
    AppRoutingModule,
    HttpClientModule,
    AddTransactionPageSharedModule
  ],
  providers: [
    { provide: RouteReuseStrategy, useClass: IonicRouteStrategy },
    Storage,
    FinanceVarService,
    FinanceService,
    AIService
  ],
  bootstrap: [AppComponent],
})
export class AppModule {}