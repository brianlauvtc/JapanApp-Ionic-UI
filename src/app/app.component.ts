import { Component, OnInit } from '@angular/core';
import { Platform } from '@ionic/angular';
import { FinanceService } from './core/finance/service/finance.service';

@Component({
  selector: 'app-root',
  templateUrl: 'app.component.html',
  styleUrls: ['app.component.scss'],
})
export class AppComponent implements OnInit {
  constructor(
    private platform: Platform,
    private financeService: FinanceService
  ) {}

  ngOnInit() {
    this.initializeApp();
  }

  private initializeApp() {
    this.platform.ready().then(() => {
      // Process daily rollovers when app starts
      this.financeService.processDailyRollovers();
    });
  }
}