import { Injectable, signal, computed } from '@angular/core';
import { FinanceVarService } from './finance-var.service';
import { FinanceService } from './finance.service';
import { Transaction, AppData } from '../model/finance.model';
import moment from 'moment';

@Injectable({
  providedIn: 'root'
})
export class AnalysisService {
  // Reactive Signals for active state
  public selectedRangeType = signal<'week' | 'month' | 'year' | 'custom'>('month');
  public currentWeekDate = signal<string>(moment().format('YYYY-MM-DD'));
  public selectedMonth = signal<string>(moment().format('YYYY-MM'));
  public selectedYear = signal<string>(moment().format('YYYY'));
  public customStartDate = signal<string>(moment().subtract(30, 'days').format('YYYY-MM-DD'));
  public customEndDate = signal<string>(moment().format('YYYY-MM-DD'));
  public selectedType = signal<'expense' | 'income' | 'overall'>('expense');
  public appDataSignal = signal<AppData | null>(null);

  // Computed Date Range coordinates derived automatically from selection
  public startDate = computed(() => {
    const type = this.selectedRangeType();
    if (type === 'week') {
      return moment(this.currentWeekDate()).startOf('isoWeek').format('YYYY-MM-DD');
    } else if (type === 'month') {
      return `${this.selectedMonth()}-01`;
    } else if (type === 'year') {
      return `${this.selectedYear()}-01-01`;
    } else {
      return this.customStartDate();
    }
  });

  public endDate = computed(() => {
    const type = this.selectedRangeType();
    if (type === 'week') {
      return moment(this.currentWeekDate()).endOf('isoWeek').format('YYYY-MM-DD');
    } else if (type === 'month') {
      return moment(`${this.selectedMonth()}-01`).endOf('month').format('YYYY-MM-DD');
    } else if (type === 'year') {
      return `${this.selectedYear()}-12-31`;
    } else {
      return this.customEndDate();
    }
  });

  constructor(
    private financeVar: FinanceVarService,
    private financeService: FinanceService
  ) {
    // Sync state reactivity between IndexedDB AppData emissions and our Signals
    this.financeVar.appData$.subscribe(data => {
      if (data) {
        this.appDataSignal.set(data);
      }
    });
  }

  /**
   * Safe data-modeling conversion logic to translate foreign currency (like JPY) 
   * to Base Currency (e.g., HKD) preserving exact historical snapshots.
   */
  public getTransactionBaseAmount(t: Transaction, appData: AppData): number {
    const baseCurrency = appData.settings.baseCurrency || 'HKD';
    
    // F-1: If transaction is already logged in base currency, return amount
    if (t.currency === baseCurrency) {
      return t.amount;
    }
    
    // F-2: If transaction currency differs, check if the payment account matches base currency
    const account = appData.accounts.find(a => a.id === t.accountId);
    if (account && account.currency === baseCurrency) {
      // accDeduction holds the snapshotted equivalent converted at creation time
      return Math.abs(t.accDeduction);
    }
    
    // F-3: Fallback calculation converting original foreign currency to base using rates
    const rate = this.financeService.getRateToBase(t.currency);
    return t.amount * rate;
  }

  // Retrieve clean transaction logs in the selected date range bounds
  public transactionsInPeriod = computed(() => {
    const data = this.appDataSignal();
    if (!data) return [];
    
    const start = this.startDate();
    const end = this.endDate();
    
    return data.transactions.filter(t => {
      // Exclude transfer transactions since they do not change total assets
      if (t.type === 'transfer') return false;
      
      // Exclude system balance-rollover fund transactions so they do not contaminate category totals
      if (t.type.startsWith('sys_fund_')) return false;
      
      const tDate = t.date;
      return tDate >= start && tDate <= end;
    });
  });

  // Filter items in active period by transaction direction
  public expensesInPeriod = computed(() => {
    return this.transactionsInPeriod().filter(t => t.type === 'expense');
  });

  public incomesInPeriod = computed(() => {
    return this.transactionsInPeriod().filter(t => t.type === 'income');
  });

  // Core KPI Aggregates: Total expenses sum
  public totalExpenses = computed(() => {
    const appData = this.appDataSignal();
    if (!appData) return 0;
    return this.expensesInPeriod().reduce((sum, t) => {
      return sum + this.getTransactionBaseAmount(t, appData);
    }, 0);
  });

  // Core KPI Aggregates: Total incomes sum
  public totalIncomes = computed(() => {
    const appData = this.appDataSignal();
    if (!appData) return 0;
    return this.incomesInPeriod().reduce((sum, t) => {
      return sum + this.getTransactionBaseAmount(t, appData);
    }, 0);
  });

  // Net monthly balance cash flow
  public netSavings = computed(() => {
    return this.totalIncomes() - this.totalExpenses();
  });

  // Percent of income retained
  public savingsRate = computed(() => {
    const inc = this.totalIncomes();
    if (inc <= 0) return 0;
    const rate = ((inc - this.totalExpenses()) / inc) * 100;
    return Number(rate.toFixed(2));
  });

  // Daily average expenditure rate
  public dailyAverageExpense = computed(() => {
    const totalExp = this.totalExpenses();
    const start = this.startDate();
    const end = this.endDate();
    
    const startMom = moment(start);
    const endMom = moment(end);
    const today = moment();
    
    let days = 1;
    if (today.isBetween(startMom, endMom, 'day', '[]')) {
      days = today.diff(startMom, 'days') + 1;
    } else if (today.isBefore(startMom)) {
      days = 1;
    } else {
      days = endMom.diff(startMom, 'days') + 1;
    }
    
    const avg = totalExp / (days || 1);
    return Number(avg.toFixed(2));
  });

  // Category composition data, mapping localized labels, icons, sums, and percentages
  public categorySummaries = computed(() => {
    const appData = this.appDataSignal();
    if (!appData) return [];
    
    const type = this.selectedType();
    let txns: Transaction[];
    if (type === 'overall') {
      txns = this.transactionsInPeriod();
    } else {
      txns = type === 'expense' ? this.expensesInPeriod() : this.incomesInPeriod();
    }
    
    const categoryTotals: { [key: string]: { amount: number, icon: string, name: string, type: 'expense' | 'income', txns: Transaction[] } } = {};
    
    txns.forEach(t => {
      const txnType = t.type;
      const catName = t.category || '其他';
      const key = `${catName}_${txnType}`;
      const baseAmt = this.getTransactionBaseAmount(t, appData);
      
      const categoriesList = txnType === 'expense' 
        ? this.financeVar.getAllExpenseCategories()
        : this.financeVar.getAllIncomeCategories();
        
      if (!categoryTotals[key]) {
        const matched = categoriesList.find(c => c.name === catName || c.id === catName);
        categoryTotals[key] = {
          amount: 0,
          icon: matched?.icon || t.icon || (txnType === 'income' ? '📈' : '📉'),
          name: type === 'overall' ? (txnType === 'income' ? `[收] ${catName}` : `[支] ${catName}`) : catName,
          type: txnType as 'expense' | 'income',
          txns: []
        };
      }
      
      categoryTotals[key].amount += baseAmt;
      categoryTotals[key].txns.push(t);
    });
    
    const totalAmount = type === 'overall' 
      ? (this.totalExpenses() + this.totalIncomes())
      : (type === 'expense' ? this.totalExpenses() : this.totalIncomes());
    
    return Object.values(categoryTotals)
      .map(cat => ({
        amount: cat.amount,
        icon: cat.icon,
        name: cat.name,
        type: cat.type,
        txns: cat.txns,
        percentage: totalAmount > 0 ? (cat.amount / totalAmount) * 100 : 0
      }))
      .sort((a, b) => b.amount - a.amount);
  });

  // Daily cumulative data mapped coordinates for Cashflow Trend Bar Graphs
  public dailyTrendData = computed(() => {
    const appData = this.appDataSignal();
    if (!appData) return { dates: [], expenses: [], incomes: [] };
    
    const start = this.startDate();
    const end = this.endDate();
    
    const startMom = moment(start);
    const endMom = moment(end);
    
    const dates: string[] = [];
    const expensesMap: { [key: string]: number } = {};
    const incomesMap: { [key: string]: number } = {};
    
    let cur = startMom.clone();
    while (cur.isSameOrBefore(endMom)) {
      const dateStr = cur.format('YYYY-MM-DD');
      dates.push(cur.format('DD')); // Just show Day number for chart aesthetics e.g. "01", "02"
      expensesMap[dateStr] = 0;
      incomesMap[dateStr] = 0;
      cur.add(1, 'day');
    }
    
    this.expensesInPeriod().forEach(t => {
      if (expensesMap[t.date] !== undefined) {
        expensesMap[t.date] += this.getTransactionBaseAmount(t, appData);
      }
    });
    
    this.incomesInPeriod().forEach(t => {
      if (incomesMap[t.date] !== undefined) {
        incomesMap[t.date] += this.getTransactionBaseAmount(t, appData);
      }
    });
    
    const expensesSeries = Object.keys(expensesMap).sort().map(k => Number(expensesMap[k].toFixed(2)));
    const incomesSeries = Object.keys(incomesMap).sort().map(k => Number(incomesMap[k].toFixed(2)));
    
    return {
      dates,
      expenses: expensesSeries,
      incomes: incomesSeries
    };
  });

  /**
   * Compiles monthly summaries and logs into plain strings.
   * Enables seamless downloading of clean financial exports.
   */
  public generateExportData(format: 'csv' | 'json' | 'html'): string {
    const appData = this.appDataSignal();
    if (!appData) return '';
    
    const month = this.selectedMonth();
    const expenses = this.expensesInPeriod();
    const incomes = this.incomesInPeriod();
    const all = [...expenses, ...incomes].sort((a, b) => b.date.localeCompare(a.date));
    
    if (format === 'json') {
      const exportObj = {
        month,
        summary: {
          totalIncome: this.totalIncomes(),
          totalExpense: this.totalExpenses(),
          netSavings: this.netSavings(),
          savingsRatePercent: this.savingsRate(),
          dailyAverageExpense: this.dailyAverageExpense()
        },
        categoryTotals: this.categorySummaries().map(c => ({
          category: c.name,
          icon: c.icon,
          totalAmountBase: Number(c.amount.toFixed(2)),
          percentage: Number(c.percentage.toFixed(2))
        })),
        transactions: all.map(t => ({
          id: t.id,
          date: t.date,
          type: t.type,
          category: t.category,
          amount: t.amount,
          currency: t.currency,
          exRateToAccount: t.exRate,
          accDeduction: t.accDeduction,
          amountBase: Number(this.getTransactionBaseAmount(t, appData).toFixed(2)),
          note: t.note || ''
        }))
      };
      return JSON.stringify(exportObj, null, 2);
    } else if (format === 'html') {
      const summaries = this.categorySummaries();
      const type = this.selectedType();
      const typeLabel = type === 'overall' ? '綜合' : (type === 'expense' ? '支出' : '收入');
      const colors = ['#6366f1', '#10b981', '#f59e0b', '#ef4444', '#ec4899', '#8b5cf6', '#06b6d4', '#f97316'];
      
      const baseCurrency = appData.settings?.baseCurrency || 'JPY';
      const baseCurrencySymbol = baseCurrency === 'JPY' ? '¥' : '$';
      
      let accumAngle = 0;
      const gradientSegments: string[] = [];
      const legendRows: string[] = [];
      
      if (type === 'overall') {
        const totalExp = this.totalExpenses();
        const totalInc = this.totalIncomes();
        const totalAmt = totalExp + totalInc;
        
        const expPct = totalAmt > 0 ? (totalExp / totalAmt) * 100 : 0;
        const incPct = totalAmt > 0 ? (totalInc / totalAmt) * 100 : 0;
        
        const nextAngle = accumAngle + (expPct * 3.6);
        gradientSegments.push(`#ef4444 ${accumAngle.toFixed(1)}deg ${nextAngle.toFixed(1)}deg`);
        accumAngle = nextAngle;
        
        const finalAngle = accumAngle + (incPct * 3.6);
        gradientSegments.push(`#10b981 ${accumAngle.toFixed(1)}deg ${finalAngle.toFixed(1)}deg`);
        
        legendRows.push(`
          <div class="legend-item">
            <span class="color-dot" style="background: #ef4444"></span>
            <span class="legend-icon">💸</span>
            <span class="legend-name">總支出</span>
            <span class="legend-pct">${expPct.toFixed(1)}%</span>
            <span class="legend-val">${baseCurrencySymbol}${totalExp.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
          </div>
        `);
        
        legendRows.push(`
          <div class="legend-item">
            <span class="color-dot" style="background: #10b981"></span>
            <span class="legend-icon">📈</span>
            <span class="legend-name">總收入</span>
            <span class="legend-pct">${incPct.toFixed(1)}%</span>
            <span class="legend-val">${baseCurrencySymbol}${totalInc.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
          </div>
        `);
      } else {
        summaries.forEach((c, idx) => {
          const color = colors[idx % colors.length];
          const nextAngle = accumAngle + (c.percentage * 3.6);
          gradientSegments.push(`${color} ${accumAngle.toFixed(1)}deg ${nextAngle.toFixed(1)}deg`);
          accumAngle = nextAngle;
          
          legendRows.push(`
            <div class="legend-item">
              <span class="color-dot" style="background: ${color}"></span>
              <span class="legend-icon">${c.icon}</span>
              <span class="legend-name">${c.name}</span>
              <span class="legend-pct">${c.percentage.toFixed(1)}%</span>
              <span class="legend-val">${baseCurrencySymbol}${c.amount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
            </div>
          `);
        });
      }
      
      const conicGradientStr = gradientSegments.join(', ') || '#475569 0deg 360deg';
      
      let transRows = '';
      all.forEach(t => {
        const baseAmt = this.getTransactionBaseAmount(t, appData);
        transRows += `
          <tr>
            <td>${t.date}</td>
            <td><span class="badge ${t.type}">${t.type === 'expense' ? '支出' : '收入'}</span></td>
            <td>${t.category || '無分類'}</td>
            <td class="amount">${t.currency === 'JPY' ? '¥' : '$'}${t.amount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
            <td class="amount">${baseCurrencySymbol}${baseAmt.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
            <td>${t.note || ''}</td>
          </tr>
        `;
      });

      return `<!DOCTYPE html>
<html lang="zh-Hant">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>JapanApp 財務分析報告 - ${month}</title>
  <style>
    :root {
      --bg: #0b0f19;
      --card-bg: rgba(17, 24, 39, 0.7);
      --border: rgba(255, 255, 255, 0.06);
      --text: #f3f4f6;
      --text-muted: #9ca3af;
      --primary: #6366f1;
    }
    body {
      font-family: system-ui, -apple-system, sans-serif;
      background: var(--bg);
      color: var(--text);
      margin: 0;
      padding: 40px 20px;
      display: flex;
      justify-content: center;
    }
    .report-container {
      background: var(--card-bg);
      border: 1px solid var(--border);
      backdrop-filter: blur(20px);
      -webkit-backdrop-filter: blur(20px);
      border-radius: 24px;
      padding: 32px;
      max-width: 900px;
      width: 100%;
      box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.5);
    }
    .header {
      display: flex;
      justify-content: space-between;
      align-items: flex-start;
      border-bottom: 1px solid var(--border);
      padding-bottom: 24px;
      margin-bottom: 32px;
    }
    .header h1 {
      margin: 0;
      font-size: 26px;
      font-weight: 800;
      background: linear-gradient(135deg, #a5b4fc 0%, #6366f1 100%);
      -webkit-background-clip: text;
      -webkit-text-fill-color: transparent;
    }
    .header p {
      margin: 6px 0 0 0;
      font-size: 14px;
      color: var(--text-muted);
    }
    .meta-badge {
      background: rgba(99, 102, 241, 0.1);
      color: #818cf8;
      border: 1px solid rgba(99, 102, 241, 0.2);
      padding: 6px 16px;
      border-radius: 9999px;
      font-weight: 600;
      font-size: 13px;
    }
    .summary-grid {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(140px, 1fr));
      gap: 16px;
      margin-bottom: 32px;
    }
    .summary-card {
      background: rgba(255, 255, 255, 0.02);
      border: 1px solid var(--border);
      padding: 16px;
      border-radius: 16px;
      text-align: center;
    }
    .summary-card h3 {
      margin: 0 0 6px 0;
      font-size: 11px;
      text-transform: uppercase;
      letter-spacing: 1px;
      color: var(--text-muted);
    }
    .summary-card .value {
      font-size: 18px;
      font-weight: 700;
      color: var(--text);
    }
    .summary-card .value.expense { color: #f87171; }
    .summary-card .value.income { color: #34d399; }
    
    .chart-section {
      display: flex;
      flex-wrap: wrap;
      gap: 40px;
      align-items: center;
      justify-content: center;
      margin-bottom: 40px;
      background: rgba(255, 255, 255, 0.01);
      border: 1px solid var(--border);
      padding: 32px;
      border-radius: 20px;
    }
    .pie-chart {
      width: 200px;
      height: 200px;
      border-radius: 50%;
      background: conic-gradient(${conicGradientStr});
      box-shadow: 0 10px 30px rgba(0, 0, 0, 0.4);
    }
    .legend-list {
      display: flex;
      flex-direction: column;
      gap: 12px;
      flex: 1;
      min-width: 250px;
    }
    .legend-item {
      display: flex;
      align-items: center;
      gap: 12px;
      font-size: 14px;
      border-bottom: 1px solid rgba(255, 255, 255, 0.02);
      padding-bottom: 8px;
    }
    .color-dot {
      width: 12px;
      height: 12px;
      border-radius: 3px;
      flex-shrink: 0;
    }
    .legend-icon {
      font-size: 16px;
    }
    .legend-name {
      font-weight: 500;
      flex-grow: 1;
    }
    .legend-pct {
      color: var(--text-muted);
      font-size: 12px;
      background: rgba(255, 255, 255, 0.05);
      padding: 1px 6px;
      border-radius: 9999px;
    }
    .legend-val {
      font-weight: 700;
      font-variant-numeric: tabular-nums;
    }
    .table-section {
      margin-bottom: 32px;
    }
    .table-section h2 {
      font-size: 18px;
      font-weight: 700;
      margin: 0 0 16px 0;
      color: #818cf8;
    }
    .table-wrapper {
      overflow-x: auto;
      border: 1px solid var(--border);
      border-radius: 16px;
    }
    table {
      width: 100%;
      border-collapse: collapse;
      font-size: 13px;
      text-align: left;
    }
    th, td {
      padding: 12px 16px;
      border-bottom: 1px solid var(--border);
    }
    th {
      background: rgba(255, 255, 255, 0.02);
      color: var(--text-muted);
      font-weight: 600;
    }
    tr:last-child td {
      border-bottom: none;
    }
    td.amount {
      font-weight: 700;
      text-align: right;
      font-variant-numeric: tabular-nums;
    }
    .badge {
      display: inline-block;
      padding: 2px 8px;
      border-radius: 6px;
      font-size: 11px;
      font-weight: 600;
    }
    .badge.expense {
      background: rgba(239, 68, 68, 0.1);
      color: #f87171;
    }
    .badge.income {
      background: rgba(16, 185, 129, 0.1);
      color: #34d399;
    }
    @media print {
      body { background: #fff; color: #000; padding: 0; }
      .report-container { box-shadow: none; border: none; padding: 0; background: transparent; }
      .pie-chart { box-shadow: none; print-color-adjust: exact; -webkit-print-color-adjust: exact; }
    }
  </style>
</head>
<body>
  <div class="report-container">
    <div class="header">
      <div>
        <h1>JapanApp 財務分析報告</h1>
        <p>自動生成會計統計分析報表</p>
      </div>
      <div class="meta-badge">${month}</div>
    </div>
    
    <div class="summary-grid">
      <div class="summary-card">
        <h3>總支出</h3>
        <div class="value expense">${baseCurrencySymbol}${this.totalExpenses().toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</div>
      </div>
      <div class="summary-card">
        <h3>總收入</h3>
        <div class="value income">${baseCurrencySymbol}${this.totalIncomes().toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</div>
      </div>
      <div class="summary-card">
        <h3>儲蓄淨額</h3>
        <div class="value">${baseCurrencySymbol}${this.netSavings().toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</div>
      </div>
      <div class="summary-card">
        <h3>儲蓄率</h3>
        <div class="value">${this.savingsRate()}%</div>
      </div>
    </div>

    <div class="table-section">
      <h2>📊 分類佔比分析 (${typeLabel})</h2>
      <div class="chart-section">
        <div class="pie-chart"></div>
        <div class="legend-list">
          ${legendRows.join('\n')}
        </div>
      </div>
    </div>

    <div class="table-section">
      <h2>📝 收支交易明細</h2>
      <div class="table-wrapper">
        <table>
          <thead>
            <tr>
              <th>日期</th>
              <th>類型</th>
              <th>分類</th>
              <th style="text-align: right;">本地金額</th>
              <th style="text-align: right;">折合金額 (${baseCurrency})</th>
              <th>備忘錄</th>
            </tr>
          </thead>
          <tbody>
            ${transRows}
          </tbody>
        </table>
      </div>
    </div>
  </div>
</body>
</html>`;
    } else {
      const rows: string[] = [];
      
      rows.push(`"Month Report","${month}"`);
      rows.push(`"Total Income (Base)","${this.totalIncomes().toFixed(2)}"`);
      rows.push(`"Total Expense (Base)","${this.totalExpenses().toFixed(2)}"`);
      rows.push(`"Net Savings (Base)","${this.netSavings().toFixed(2)}"`);
      rows.push(`"Savings Rate","${this.savingsRate().toFixed(2)}%"`);
      rows.push(`"Daily Average (Base)","${this.dailyAverageExpense().toFixed(2)}"`);
      rows.push('');
      
      rows.push('"--- Category Breakdown ---"');
      rows.push('"Category","Icon","Amount (Base)","Percentage","Visual Distribution (Sparkline)"');
      this.categorySummaries().forEach(c => {
        const filled = Math.round(c.percentage / 10);
        const bar = '█'.repeat(Math.max(0, Math.min(10, filled))) + '░'.repeat(Math.max(0, Math.min(10, 10 - filled)));
        rows.push(`"${c.name}","${c.icon}","${c.amount.toFixed(2)}","${c.percentage.toFixed(2)}%","${bar}"`);
      });
      rows.push('');
      
      rows.push('"--- Itemized Transaction Log ---"');
      rows.push('"Date","Type","Category","Local Amount","Local Currency","Base Amount","Note"');
      all.forEach(t => {
        const baseAmt = this.getTransactionBaseAmount(t, appData).toFixed(2);
        rows.push(`"${t.date}","${t.type === 'expense' ? '支出' : '收入'}","${t.category || ''}","${t.amount}","${t.currency}","${baseAmt}","${(t.note || '').replace(/"/g, '""')}"`);
      });
      
      return rows.join('\n');
    }
  }
}
