import { Component, OnInit, OnDestroy, computed, signal, effect, ChangeDetectorRef } from '@angular/core';
import { AnalysisService } from '../../../service/analysis.service';
import { FinanceVarService } from '../../../service/finance-var.service';
import { FinanceService } from '../../../service/finance.service';
import { AIService } from '../../../service/ai.service';
import { Transaction, AIAnalysisType, AIAnalysisResult } from '../../../model/finance.model';
import { ApexOptions } from 'ng-apexcharts';
import { AlertController, ToastController, ModalController } from '@ionic/angular';
import { AddTransactionPagePage } from '../../../add-transaction/add-transaction-page/add-transaction-page.page';
import moment from 'moment';

@Component({
  selector: 'app-analysis-statistics',
  templateUrl: './analysis-statistics.component.html',
  styleUrls: ['./analysis-statistics.component.scss']
})
export class AnalysisStatisticsComponent implements OnInit, OnDestroy {
  // Chart properties bound to ng-apexcharts
  public donutChartOptions: ApexOptions = {};
  public donutChartSeries: number[] = [];
  public trendChartOptions: ApexOptions = {};
  public trendChartSeries: any[] = [];
  public categoryBarChartOptions: ApexOptions = {};
  public categoryBarChartSeries: any[] = [];
  public selectedCategoryChartType: 'donut' | 'bar' = 'donut';

  // Local component states
  public isDarkMode = false;
  public isPageEntered = false;
  
  // AI Advisor state merged from analysis-page
  public selectedAnalysisType: AIAnalysisType = 'financial_health';
  public isAnalyzing: boolean = false;
  public latestResult: AIAnalysisResult | null = null;
  public historyList: AIAnalysisResult[] = [];
  public isEnglishExpanded: boolean = false;
  
  // Drill-down UI control maps
  public expandedCategories: { [key: string]: boolean } = {};
  public limitMap: { [key: string]: number } = {};

  // Mutation and system media query monitors for theme synching
  private themeMutationObserver!: MutationObserver;
  private mediaQueryListener!: (e: MediaQueryListEvent) => void;

  // Reactively calculate current base currency symbols
  public baseCurrencySymbol = computed(() => {
    const appData = this.analysisService.appDataSignal();
    return appData?.settings.baseCurrency === 'JPY' ? '¥' : '$';
  });

  // Local computed signal wrappers to decouple template from service caching
  public selectedRangeType = computed<'week' | 'month' | 'year' | 'custom'>(() => this.analysisService.selectedRangeType());
  public transactionsInPeriod = computed<any[]>(() => this.analysisService.transactionsInPeriod());
  public totalExpenses = computed<number>(() => this.analysisService.totalExpenses());
  public totalIncomes = computed<number>(() => this.analysisService.totalIncomes());
  public savingsRate = computed<number>(() => this.analysisService.savingsRate());
  public dailyAverageExpense = computed<number>(() => this.analysisService.dailyAverageExpense());
  public selectedType = computed<'expense' | 'income' | 'overall'>(() => this.analysisService.selectedType());
  public categorySummaries = computed<any[]>(() => this.analysisService.categorySummaries());
  public customStartDate = computed<string>(() => this.analysisService.customStartDate());
  public customEndDate = computed<string>(() => this.analysisService.customEndDate());
  public appDataSignal = computed<any>(() => this.analysisService.appDataSignal());

  // Dynamically compile active years and months that contain transactions
  public availableMonths = computed(() => {
    const data = this.analysisService.appDataSignal();
    const monthsSet = new Set<string>();
    
    // Make sure we always include current month
    monthsSet.add(moment().format('YYYY-MM'));
    
    if (data && data.transactions) {
      data.transactions.forEach(t => {
        if (t.date) {
          monthsSet.add(t.date.substring(0, 7));
        }
      });
    }
    
    return Array.from(monthsSet).sort().reverse();
  });

  constructor(
    public analysisService: AnalysisService,
    private financeVar: FinanceVarService,
    private financeService: FinanceService,
    private aiService: AIService,
    private alertController: AlertController,
    private toastCtrl: ToastController,
    private modalCtrl: ModalController,
    private cdr: ChangeDetectorRef
  ) {
    // Angular 18 Injection Context Effect to trigger reactive chart redraws on data alterations
    effect(() => {
      // Create explicit reactive dependencies on service aggregations
      const categoryData = this.analysisService.categorySummaries();
      const trendData = this.analysisService.dailyTrendData();
      const type = this.analysisService.selectedType();
      const month = this.analysisService.selectedMonth();
      
      if (this.isPageEntered) {
        // Redraw immediately inside animation frame
        requestAnimationFrame(() => {
          this.drawCharts();
        });
      }
    });
  }

  ngOnInit() {
    this.setupDarkModeListener();
    this.switchAnalysisType('financial_health');
  }

  ngOnDestroy() {
    this.removeDarkModeListener();
  }

  /**
   * Ionic Lifecycle Hook forward-triggered by parent component page.
   * Defers chart calculations until entering transition concludes.
   */
  public ionViewDidEnter() {
    this.isPageEntered = true;
    this.drawCharts();
    this.loadHistoryAndLatest();
    this.cdr.detectChanges();
  }

  // Human-readable formatted date range label
  public dateRangeLabel = computed(() => {
    const type = this.analysisService.selectedRangeType();
    const start = this.analysisService.startDate();
    const end = this.analysisService.endDate();
    
    if (type === 'week') {
      const startMom = moment(start);
      const endMom = moment(end);
      return `${startMom.format('YYYY年MM月DD日')} ~ ${endMom.format('MM月DD日')}`;
    } else if (type === 'month') {
      const monthMom = moment(`${this.analysisService.selectedMonth()}-01`);
      return `${monthMom.format('YYYY年 MM月')}`;
    } else if (type === 'year') {
      return `${this.analysisService.selectedYear()}年`;
    } else {
      const startMom = moment(start);
      const endMom = moment(end);
      return `${startMom.format('YYYY/MM/DD')} ~ ${endMom.format('YYYY/MM/DD')}`;
    }
  });

  // Set selected Month filter
  public changeMonthFilter(event: any) {
    const month = event.detail.value;
    if (month) {
      this.analysisService.selectedMonth.set(month);
      this.expandedCategories = {};
      this.limitMap = {};
    }
  }

  public changeRangeType(type: any) {
    this.analysisService.selectedRangeType.set(type);
    this.expandedCategories = {};
    this.limitMap = {};
  }

  public changeCustomStartDate(event: any) {
    if (event.target.value) {
      this.analysisService.customStartDate.set(event.target.value);
      this.expandedCategories = {};
      this.limitMap = {};
    }
  }

  public changeCustomEndDate(event: any) {
    if (event.target.value) {
      this.analysisService.customEndDate.set(event.target.value);
      this.expandedCategories = {};
      this.limitMap = {};
    }
  }

  public prevPeriod() {
    const type = this.analysisService.selectedRangeType();
    if (type === 'week') {
      const prevWeek = moment(this.analysisService.currentWeekDate()).subtract(1, 'week').format('YYYY-MM-DD');
      this.analysisService.currentWeekDate.set(prevWeek);
    } else if (type === 'month') {
      const prevMonth = moment(`${this.analysisService.selectedMonth()}-01`).subtract(1, 'month').format('YYYY-MM');
      this.analysisService.selectedMonth.set(prevMonth);
    } else if (type === 'year') {
      const prevYear = moment(`${this.analysisService.selectedYear()}-01-01`).subtract(1, 'year').format('YYYY');
      this.analysisService.selectedYear.set(prevYear);
    }
    this.expandedCategories = {};
    this.limitMap = {};
  }

  public nextPeriod() {
    const type = this.analysisService.selectedRangeType();
    if (type === 'week') {
      const nextWeek = moment(this.analysisService.currentWeekDate()).add(1, 'week').format('YYYY-MM-DD');
      this.analysisService.currentWeekDate.set(nextWeek);
    } else if (type === 'month') {
      const nextMonth = moment(`${this.analysisService.selectedMonth()}-01`).add(1, 'month').format('YYYY-MM');
      this.analysisService.selectedMonth.set(nextMonth);
    } else if (type === 'year') {
      const nextYear = moment(`${this.analysisService.selectedYear()}-01-01`).add(1, 'year').format('YYYY');
      this.analysisService.selectedYear.set(nextYear);
    }
    this.expandedCategories = {};
    this.limitMap = {};
  }

  // Change display category type (Expense / Income)
  public changeTypeSegment(event: any) {
    const type = event.detail.value as 'expense' | 'income' | 'overall';
    if (type) {
      this.analysisService.selectedType.set(type);
      this.expandedCategories = {};
      this.limitMap = {};
    }
  }

  /**
   * Performance Accordion: slice list to top 10 items initially
   */
  public getVisibleCategoryTransactions(category: any): Transaction[] {
    const limit = this.limitMap[category.name] || 10;
    return category.txns.slice(0, limit);
  }

  public hasMoreTransactions(category: any): boolean {
    const limit = this.limitMap[category.name] || 10;
    return category.txns.length > limit;
  }

  public loadMoreTransactions(category: any, event: Event) {
    event.stopPropagation(); // Avoid folding the accordion container
    this.limitMap[category.name] = (this.limitMap[category.name] || 10) + 20;
    this.cdr.detectChanges();
  }

  public toggleCategory(categoryName: string) {
    this.expandedCategories[categoryName] = !this.expandedCategories[categoryName];
    // Reset back to top 10 items when collapsing to garbage-collect off-screen DOM nodes
    if (!this.expandedCategories[categoryName]) {
      this.limitMap[categoryName] = 10;
    }
    this.cdr.detectChanges();
  }

  public isCategoryExpanded(categoryName: string): boolean {
    return !!this.expandedCategories[categoryName];
  }

  /**
   * Draw and refresh ApexCharts SVG/Canvas components with synchronized colors and options
   */
  private drawCharts() {
    const categoryData = this.analysisService.categorySummaries();
    const trendData = this.analysisService.dailyTrendData();
    const symbol = this.baseCurrencySymbol();
    const isDark = this.isDarkMode;

    // Zero State Guard: Do not attempt to calculate chart metrics if no records exist
    if (this.analysisService.transactionsInPeriod().length === 0) {
      this.donutChartSeries = [];
      this.trendChartSeries = [];
      return;
    }

    // Colors: Vibrant glassmorphic color scheme matching our premium theme guidelines
    const colorPalette = [
      '#6366f1', // Indigo
      '#10b981', // Emerald Green
      '#f59e0b', // Amber Caution
      '#ef4444', // Rose Coral
      '#06b6d4', // Premium Cyan
      '#ec4899', // Hot Pink
      '#8b5cf6', // Violet
      '#14b8a6', // Teal
      '#f43f5e', // Strawberry Rose
      '#3b82f6'  // Royal Blue
    ];

    // Donut Chart: Expenses/Incomes/Overall breakdown
    const isOverall = this.analysisService.selectedType() === 'overall';
    
    let chartSeries: number[];
    let chartLabels: string[];
    let chartColors: string[];
    
    if (isOverall) {
      chartSeries = [
        Number(this.analysisService.totalExpenses().toFixed(2)),
        Number(this.analysisService.totalIncomes().toFixed(2))
      ];
      chartLabels = ['💸 總支出', '📈 總收入'];
      chartColors = ['#f87171', '#34d399']; // Coral red & Emerald green
    } else {
      chartSeries = categoryData.map(c => Number(c.amount.toFixed(2)));
      chartLabels = categoryData.map(c => `${c.icon} ${c.name}`);
      chartColors = colorPalette;
    }

    this.donutChartSeries = chartSeries;
    this.donutChartOptions = {
      chart: {
        type: 'donut',
        height: 250,
        foreColor: isDark ? '#e2e8f0' : '#1e293b',
        toolbar: { show: false }
      },
      labels: chartLabels,
      colors: chartColors,
      stroke: {
        show: true,
        width: 2,
        colors: [isDark ? '#1e293b' : '#ffffff']
      },
      dataLabels: { enabled: false },
      legend: {
        show: true,
        position: 'bottom',
        fontSize: '13px',
        labels: { colors: isDark ? '#94a3b8' : '#475569' },
        markers: { shape: 'circle' }
      },
      plotOptions: {
        pie: {
          donut: {
            size: '72%',
            labels: {
              show: true,
              name: {
                show: true,
                fontSize: '14px',
                color: isDark ? '#94a3b8' : '#64748b'
              },
              value: {
                show: true,
                fontSize: '20px',
                fontWeight: '700',
                color: isDark ? '#f8fafc' : '#0f172a',
                formatter: (val: string) => `${symbol}${Number(val).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
              },
              total: {
                show: true,
                label: this.analysisService.selectedType() === 'overall' ? '儲蓄淨額' : (this.analysisService.selectedType() === 'expense' ? '總支出' : '總收入'),
                color: isDark ? '#94a3b8' : '#64748b',
                formatter: (w: any) => {
                  if (this.analysisService.selectedType() === 'overall') {
                    const savings = this.analysisService.netSavings();
                    return `${symbol}${savings.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
                  }
                  const total = w.globals.seriesTotals.reduce((a: number, b: number) => a + b, 0);
                  return `${symbol}${total.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
                }
              }
            }
          }
        }
      },
      tooltip: {
        theme: isDark ? 'dark' : 'light',
        y: {
          formatter: (val: number) => `${symbol}${val.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
        }
      }
    };

    // Category Bar Chart configuration (F-2.5)
    this.categoryBarChartSeries = [{
      name: this.analysisService.selectedType() === 'overall' ? '儲蓄淨額' : (this.analysisService.selectedType() === 'expense' ? '總支出' : '總收入'),
      data: chartSeries
    }];

    this.categoryBarChartOptions = {
      chart: {
        type: 'bar',
        height: Math.max(250, chartSeries.length * 40),
        foreColor: isDark ? '#e2e8f0' : '#1e293b',
        toolbar: { show: false }
      },
      colors: chartColors,
      plotOptions: {
        bar: {
          horizontal: true,
          barHeight: '60%',
          distributed: true,
          dataLabels: {
            position: 'end'
          }
        }
      },
      dataLabels: {
        enabled: true,
        textAnchor: 'start',
        style: {
          colors: ['#fff'],
          fontSize: '11px',
          fontWeight: 'bold'
        },
        formatter: (val: string) => `${symbol}${Number(val).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`,
        offsetX: 0
      },
      xaxis: {
        categories: chartLabels,
        labels: {
          formatter: (val: string) => `${symbol}${Number(val).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
        }
      },
      yaxis: {
        labels: {
          show: true,
          style: {
            fontSize: '12px',
            fontWeight: '600'
          }
        }
      },
      grid: {
        borderColor: isDark ? '#334155' : '#e2e8f0',
        xaxis: { lines: { show: true } }
      },
      tooltip: {
        theme: isDark ? 'dark' : 'light',
        y: {
          formatter: (val: number) => `${symbol}${val.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
        }
      },
      legend: { show: false }
    };

    // Monthly Bar Chart: Cash flow timeline trends - Bypassed at runtime for performance
    if (false as boolean) {
      this.trendChartSeries = [
        { name: '收入', data: trendData.incomes },
        { name: '支出', data: trendData.expenses }
      ];
      this.trendChartOptions = {
        chart: {
          type: 'bar',
          height: 220,
          stacked: false,
          foreColor: isDark ? '#e2e8f0' : '#1e293b',
          toolbar: { show: false }
        },
        colors: ['#10b981', '#ef4444'], // Glowing Green and premium Caution Red
        plotOptions: {
          bar: {
            horizontal: false,
            columnWidth: '55%',
            borderRadius: 4
          }
        },
        dataLabels: { enabled: false },
        stroke: {
          show: true,
          width: 2,
          colors: ['transparent']
        },
        xaxis: {
          categories: trendData.dates,
          axisBorder: { show: false },
          axisTicks: { show: false },
          labels: {
            style: { colors: isDark ? '#94a3b8' : '#64748b', fontSize: '11px' }
          }
        },
        yaxis: {
          labels: {
            style: { colors: isDark ? '#94a3b8' : '#64748b', fontSize: '11px' },
            formatter: (val: number) => `${symbol}${val.toFixed(0)}`
          }
        },
        grid: {
          show: true,
          borderColor: isDark ? '#334155' : '#e2e8f0',
          strokeDashArray: 4
        },
        // Responsive Tooltip clipping guard (Rec 7)
        tooltip: {
          theme: isDark ? 'dark' : 'light',
          shared: true,
          intersect: false,
          fixed: {
            enabled: true,
            position: 'topRight', // fixed top right prevents off-screen rendering
            offsetX: 0,
            offsetY: -10
          },
          y: {
            formatter: (val: number) => `${symbol}${val.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
          }
        },
        legend: {
          show: true,
          position: 'top',
          labels: { colors: isDark ? '#94a3b8' : '#475569' }
        }
      };
    }
  }

  /**
   * Data Export dialog trigger (Rec 5)
   */
  public async triggerExport() {
    const alert = await this.alertController.create({
      header: '📊 匯出財務報表',
      message: '請選擇要下載的檔案格式：',
      cssClass: 'premium-alert',
      buttons: [
        {
          text: 'HTML 報告 (含動態圓餅圖網頁)',
          cssClass: 'primary',
          handler: () => this.downloadFile('html')
        },
        {
          text: 'CSV 報表 (Excel / 試算表)',
          cssClass: 'primary',
          handler: () => this.downloadFile('csv')
        },
        {
          text: 'JSON 備份 (資料Portability)',
          cssClass: 'primary',
          handler: () => this.downloadFile('json')
        },
        {
          text: '取消',
          role: 'cancel'
        }
      ]
    });
    await alert.present();
  }

  private downloadFile(format: 'csv' | 'json' | 'html') {
    const dataString = this.analysisService.generateExportData(format);
    
    let blob: Blob;
    if (format === 'csv') {
      // Prepend UTF-8 BOM (\uFEFF) so Excel on Windows recognizes Chinese characters correctly
      blob = new Blob(['\ufeff', dataString], { type: 'text/csv;charset=utf-8;' });
    } else if (format === 'html') {
      blob = new Blob([dataString], { type: 'text/html;charset=utf-8;' });
    } else {
      blob = new Blob([dataString], { type: 'application/json' });
    }
    
    const url = URL.createObjectURL(blob);
    
    const month = this.analysisService.selectedMonth();
    const filename = `JapanApp_AnalysisReport_${month}.${format}`;
    
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', filename);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
    
    this.showToast(`已成功匯出並下載 ${format.toUpperCase()} 報表！`);
  }

  private async showToast(message: string) {
    const toast = await this.toastCtrl.create({
      message,
      duration: 2000,
      position: 'bottom',
      color: 'success'
    });
    await toast.present();
  }

  /**
   * Dual mutation observer listener checking and matching dark class styling attributes
   */
  private setupDarkModeListener() {
    this.isDarkMode = document.documentElement.classList.contains('dark') || 
                      document.body.classList.contains('dark') || 
                      window.matchMedia('(prefers-color-scheme: dark)').matches;
                      
    const darkMediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
    this.mediaQueryListener = (e: MediaQueryListEvent) => {
      this.isDarkMode = e.matches;
      if (this.isPageEntered) {
        this.drawCharts();
      }
    };
    darkMediaQuery.addEventListener('change', this.mediaQueryListener);
    
    this.themeMutationObserver = new MutationObserver(() => {
      const isDark = document.documentElement.classList.contains('dark') || 
                     document.body.classList.contains('dark');
      if (isDark !== this.isDarkMode) {
        this.isDarkMode = isDark;
        if (this.isPageEntered) {
          this.drawCharts();
        }
      }
    });
    this.themeMutationObserver.observe(document.documentElement, { attributes: true, attributeFilter: ['class'] });
  }

  private removeDarkModeListener() {
    const darkMediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
    if (this.mediaQueryListener) {
      darkMediaQuery.removeEventListener('change', this.mediaQueryListener);
    }
    if (this.themeMutationObserver) {
      this.themeMutationObserver.disconnect();
    }
  }

  // Currency helper formatting
  public formatCurrency(val: number): string {
    return val.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  }

  // Grouped transaction note and date formatting helper
  public formatDate(dateStr: string): string {
    return moment(dateStr).format('MM/DD');
  }

  public getCurrencySymbol(curr: string): string {
    return curr === 'JPY' ? '¥' : '$';
  }

  /**
   * Launch Add Transaction Modal directly from the Zero-State dashboard trigger (F-8/Component 9 aligned).
   */
  public async openAddForm() {
    try {
      const modal = await this.modalCtrl.create({
        component: AddTransactionPagePage,
        componentProps: {
          viewedMonth: this.analysisService.selectedMonth()
        },
        cssClass: 'add-transaction-modal'
      });
      await modal.present();
      
      const { data } = await modal.onWillDismiss();
      if (data) {
        console.log('Transaction action finished inside analysis tab:', data);
        this.cdr.detectChanges();
      }
    } catch (error) {
      console.error('Error opening add transaction modal:', error);
    }
  }

  // ===== Merged AI Advisor Methods =====
  public switchAnalysisType(type: AIAnalysisType) {
    this.selectedAnalysisType = type;
    this.isEnglishExpanded = false;
    this.loadHistoryAndLatest();
  }

  public loadHistoryAndLatest() {
    const history = this.financeVar.getAIAnalysisHistory(this.selectedAnalysisType);
    this.historyList = history;
    this.latestResult = history.length > 0 ? history[0] : null;
  }

  public viewHistoryItem(item: AIAnalysisResult) {
    this.latestResult = item;
  }

  public hasAPIKey(): boolean {
    return !!this.financeVar.getAppData()?.settings?.apiKey;
  }

  public async triggerAIAdvisorAnalysis() {
    if (!this.hasAPIKey()) return;
    this.isAnalyzing = true;
    this.cdr.detectChanges();
    
    try {
      const startDate = this.analysisService.startDate();
      const endDate = this.analysisService.endDate();
      
      // Calculate effective date range: cap end date to today if it is in the future
      const todayStr = moment().format('YYYY-MM-DD');
      const effectiveEndDate = moment(endDate).isAfter(todayStr) ? todayStr : endDate;
      const periodRange = `${startDate} ~ ${effectiveEndDate}`;
      
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
        contextData = { periodRange, baseCurrency, accounts, metrics, categorySummaries, plans };

      } else if (this.selectedAnalysisType === 'expense_optimization') {
        const totalExpense = this.analysisService.totalExpenses();
        const categorySummaries = this.analysisService.categorySummaries()
          .filter(c => c.type === 'expense')
          .map(c => ({
            name: c.name,
            amount: Number(c.amount.toFixed(2)),
            percentage: Number(c.percentage.toFixed(2))
          }));
        
        const recentTransactions = this.financeVar.getAppData().transactions
          .filter(t => t.type === 'expense' && t.date >= startDate && t.date <= endDate)
          .sort((a, b) => b.date.localeCompare(a.date))
          .slice(0, 10)
          .map(t => ({
            date: t.date,
            category: t.category,
            amount: t.amount,
            currency: t.currency,
            note: t.note || ''
          }));
        contextData = { periodRange, baseCurrency, totalExpense, categorySummaries, recentTransactions };

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
        contextData = { periodRange, baseCurrency, totalAssetsBase: netWorth.ast, monthlyNetSavings, savingsRatePercent, plans };

      } else if (this.selectedAnalysisType === 'asset_allocation') {
        const accounts = this.financeVar.getAccounts().map(a => ({
          name: a.name,
          type: a.type,
          currency: a.currency,
          balance: this.financeService.getAccBalance(a.id)
        }));
        contextData = { periodRange, baseCurrency, accounts };
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
          chineseText: chineseAdvice,
          periodRange: periodRange
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
      this.cdr.detectChanges();
    }
  }

  public async confirmClearHistory(type?: AIAnalysisType) {
    const header = type ? '⚠️ 清除本類歷史' : '⚠️ 清除全部歷史';
    const message = type ? '您確定要清除本類別的所有 AI 分析紀錄嗎？' : '您確定要清除所有類別的 AI 分析紀錄嗎？';

    const alert = await this.alertController.create({
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

  public async showToastError(msg: string) {
    const alert = await this.alertController.create({
      header: '分析失敗',
      message: msg,
      buttons: ['確定']
    });
    await alert.present();
  }

  public formatMarkdown(text: string): string {
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
