import { Component, OnInit, ViewChild } from '@angular/core';
import { FinanceVarService } from '../../service/finance-var.service';
import { FinanceService } from '../../service/finance.service';
import { AnalysisStatisticsComponent } from '../components/analysis-statistics/analysis-statistics.component';

@Component({
  selector: 'app-analysis-page',
  templateUrl: './analysis-page.page.html',
  styleUrls: ['./analysis-page.page.scss']
})
export class AnalysisPagePage implements OnInit {
  @ViewChild(AnalysisStatisticsComponent) statsComponent!: AnalysisStatisticsComponent;
  aiTab: 'stats' | 'ai' | 'plans' = 'stats';

  constructor(
    private financeVar: FinanceVarService,
    private financeService: FinanceService
  ) {}

  ngOnInit() {
    this.checkAutoAI();
  }

  ionViewDidEnter() {
    if (this.statsComponent) {
      this.statsComponent.ionViewDidEnter();
    }
  }

  switchTab(tab: 'stats' | 'ai' | 'plans') {
    this.aiTab = tab;
    if (tab === 'stats') {
      setTimeout(() => {
        if (this.statsComponent) {
          this.statsComponent.ionViewDidEnter();
        }
      }, 50);
    }
  }

  triggerAIAnalysis() {
    // This would integrate with Gemini API
    console.log('Trigger AI analysis');
  }

  checkAutoAI() {
    const settings = this.financeVar.getAppData().settings;
    if (!settings.apiKey || settings.aiFrequency === 'manual') return;
    
    const today = this.financeService.getToday();
    if (this.financeVar.getAppData().lastAITime !== today) {
      this.triggerAIAnalysis();
    }
  }

  getAIHistory() {
    return this.financeVar.getAppData().aiHistory;
  }

  getLastAITime() {
    return this.financeVar.getAppData().lastAITime;
  }

  hasAPIKey() {
    return !!this.financeVar.getAppData().settings.apiKey;
  }
}