import { Component, OnInit, ViewChild } from '@angular/core';
import { FinanceVarService } from '../../service/finance-var.service';
import { FinanceService } from '../../service/finance.service';
import { AIService } from '../../service/ai.service';
import { AnalysisService } from '../../service/analysis.service';
import { AIAnalysisType, AIAnalysisResult } from '../../model/finance.model';
import { AlertController } from '@ionic/angular';
import { AnalysisStatisticsComponent } from '../components/analysis-statistics/analysis-statistics.component';

@Component({
  selector: 'app-analysis-page',
  templateUrl: './analysis-page.page.html',
  styleUrls: ['./analysis-page.page.scss']
})
export class AnalysisPagePage implements OnInit {
  @ViewChild(AnalysisStatisticsComponent) statsComponent!: AnalysisStatisticsComponent;
  aiTab: 'stats' | 'ai' | 'plans' = 'stats';

  // AI Advisor state
  selectedAnalysisType: AIAnalysisType = 'financial_health';
  isAnalyzing: boolean = false;
  latestResult: AIAnalysisResult | null = null;
  historyList: AIAnalysisResult[] = [];
  isEnglishExpanded: boolean = false;

  constructor(
    private financeVar: FinanceVarService,
    private financeService: FinanceService,
    private aiService: AIService,
    private analysisService: AnalysisService,
    private alertCtrl: AlertController
  ) {}

  ngOnInit() {
    this.switchAnalysisType('financial_health');
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
    } else if (tab === 'ai') {
      this.loadHistoryAndLatest();
    }
  }

  switchAnalysisType(type: AIAnalysisType) {
    this.selectedAnalysisType = type;
    this.isEnglishExpanded = false;
    this.loadHistoryAndLatest();
  }

  loadHistoryAndLatest() {
    const history = this.financeVar.getAIAnalysisHistory(this.selectedAnalysisType);
    this.historyList = history;
    this.latestResult = history.length > 0 ? history[0] : null;
  }

  viewHistoryItem(item: AIAnalysisResult) {
    this.latestResult = item;
  }

  hasAPIKey(): boolean {
    return !!this.financeVar.getAppData()?.settings?.apiKey;
  }

  async triggerAIAdvisorAnalysis() {
    if (!this.hasAPIKey()) return;
    this.isAnalyzing = true;
    
    try {
      const month = this.analysisService.selectedMonth();
      const baseCurrency = this.financeVar.getAppData().settings.baseCurrency || 'HKD';
      let contextData: any = {};

      if (this.selectedAnalysisType === 'financial_health') {
        const accounts = this.financeVar.getAccounts().map(a => ({
          name: a.name,
          type: a.type,
          currency: a.currency,
          balance: this.financeService.getAccBalance(a.id)
        }));
        const metrics = {
          totalIncome: this.analysisService.totalIncomes(),
          totalExpense: this.analysisService.totalExpenses(),
          netSavings: this.analysisService.netSavings(),
          savingsRatePercent: this.analysisService.savingsRate(),
          dailyAverageExpense: this.analysisService.dailyAverageExpense()
        };
        const categorySummaries = this.analysisService.categorySummaries().map(c => ({
          name: c.name,
          type: c.type,
          amount: Number(c.amount.toFixed(2)),
          percentage: Number(c.percentage.toFixed(2))
        }));
        const plans = this.financeVar.getPlans().map(p => ({
          name: p.name,
          type: p.type,
          amount: p.amount,
          targetMonth: p.targetMonth
        }));
        contextData = { month, baseCurrency, accounts, metrics, categorySummaries, plans };

      } else if (this.selectedAnalysisType === 'expense_optimization') {
        const totalExpense = this.analysisService.totalExpenses();
        const categorySummaries = this.analysisService.categorySummaries()
          .filter(c => c.type === 'expense')
          .map(c => ({
            name: c.name,
            amount: Number(c.amount.toFixed(2)),
            percentage: Number(c.percentage.toFixed(2))
          }));
        
        const start = this.analysisService.startDate();
        const end = this.analysisService.endDate();
        const appData = this.financeVar.getAppData();
        const recentTransactions = appData.transactions
          .filter(t => t.type === 'expense' && t.date >= start && t.date <= end)
          .sort((a, b) => b.date.localeCompare(a.date))
          .slice(0, 10)
          .map(t => ({
            date: t.date,
            category: t.category,
            amount: t.amount,
            currency: t.currency,
            note: t.note || ''
          }));
        contextData = { month, baseCurrency, totalExpense, categorySummaries, recentTransactions };

      } else if (this.selectedAnalysisType === 'saving_goals') {
        const netWorth = this.financeService.getNetWorth();
        const monthlyNetSavings = this.analysisService.netSavings();
        const savingsRatePercent = this.analysisService.savingsRate();
        const plans = this.financeVar.getPlans().map(p => ({
          name: p.name,
          type: p.type,
          amount: p.amount,
          targetMonth: p.targetMonth
        }));
        contextData = { month, baseCurrency, totalAssetsBase: netWorth.ast, monthlyNetSavings, savingsRatePercent, plans };

      } else if (this.selectedAnalysisType === 'asset_allocation') {
        const accounts = this.financeVar.getAccounts().map(a => ({
          name: a.name,
          type: a.type,
          currency: a.currency,
          balance: this.financeService.getAccBalance(a.id)
        }));
        contextData = { month, baseCurrency, accounts };
      }

      // Check if there is history for comparison (using previous english text or previous chinese text if English is not available)
      const previousResult = this.historyList.length > 0 ? (this.historyList[0].englishText || this.historyList[0].chineseText) : undefined;

      // Call single-request Traditional Chinese Gemini Advisor analysis
      const chineseAdvice = await this.aiService.generateAIAdvisorAnalysis(
        this.selectedAnalysisType,
        contextData,
        previousResult
      );

      if (chineseAdvice) {
        const newResult: AIAnalysisResult = {
          id: `ai_${Date.now()}`,
          type: this.selectedAnalysisType,
          date: new Date().toLocaleString('zh-TW', { hour12: false }),
          chineseText: chineseAdvice
        };
        this.financeVar.addAIAnalysisResult(newResult);
        this.loadHistoryAndLatest();
      } else {
        this.showToastError('無法取得分析建議，請稍後再試。');
      }
    } catch (e: any) {
      console.error('Advisor analysis failed:', e);
      this.showToastError('分析發生錯誤：' + (e?.message || e));
    } finally {
      this.isAnalyzing = false;
    }
  }

  async confirmClearHistory(type?: AIAnalysisType) {
    const header = type ? '⚠️ 清除本類歷史' : '⚠️ 清除全部歷史';
    const message = type ? '您確定要清除本類別的所有 AI 分析紀錄嗎？' : '您確定要清除所有類別的 AI 分析紀錄嗎？';

    const alert = await this.alertCtrl.create({
      header,
      message,
      buttons: [
        {
          text: '取消',
          role: 'cancel'
        },
        {
          text: '確定清除',
          cssClass: 'danger',
          handler: () => {
            this.financeVar.clearAIAnalysisHistory(type);
            this.loadHistoryAndLatest();
          }
        }
      ]
    });

    await alert.present();
  }

  async showToastError(msg: string) {
    const alert = await this.alertCtrl.create({
      header: '分析失敗',
      message: msg,
      buttons: ['確定']
    });
    await alert.present();
  }

  formatMarkdown(text: string): string {
    if (!text) return '';
    let html = text;
    // Bold: **text**
    html = html.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');
    // Bullet points starting with - or *
    html = html.replace(/^\s*[-*]\s+(.*)$/gm, '<li>$1</li>');
    // Subheaders: ### Title
    html = html.replace(/^###\s+(.*)$/gm, '<h4>$1</h4>');
    html = html.replace(/^##\s+(.*)$/gm, '<h3>$1</h3>');
    // Newlines to br
    html = html.replace(/\n/g, '<br>');
    return html;
  }
}