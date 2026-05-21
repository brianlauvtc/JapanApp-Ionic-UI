import { Component, OnInit } from '@angular/core';
import { FinanceVarService } from '../../service/finance-var.service';
import { FinanceService } from '../../service/finance.service';

@Component({
  selector: 'app-analysis-page',
  templateUrl: './analysis-page.page.html',
  styleUrls: ['./analysis-page.page.scss']
})
export class AnalysisPagePage implements OnInit {
  aiTab: 'ai' | 'plans' = 'ai';

  constructor(
    private financeVar: FinanceVarService,
    private financeService: FinanceService
  ) {}

  ngOnInit() {
    this.checkAutoAI();
  }

  switchTab(tab: 'ai' | 'plans') {
    this.aiTab = tab;
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