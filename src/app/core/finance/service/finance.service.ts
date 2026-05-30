import { Injectable } from '@angular/core';
import { FinanceVarService } from './finance-var.service';
import { Account, Transaction, Fund, AppData } from '../model/finance.model';
import moment from 'moment';
import { currencies } from '../environment/environment';

@Injectable({
  providedIn: 'root'
})
export class FinanceService {
  constructor(private financeVar: FinanceVarService) {}

  // Currency conversion methods
  getRateToBase(curr: string): number {
    const appData = this.financeVar.getAppData();
    const currenciesObj = currencies as any;
    return currenciesObj[curr].rate / currenciesObj[appData.settings.baseCurrency].rate;
  }

  // Account balance calculation
  getAccBalanceUpTo(accountId: string, upToDateStr: string | null = null): number {
    const appData = this.financeVar.getAppData();
    const acc = appData.accounts.find(a => a.id === accountId);
    if (!acc) return 0;
    
    let bal = acc.type === 'credit' ? -Math.abs(acc.initBalance) : acc.initBalance;
    
    appData.transactions.forEach(t => {
      if (upToDateStr && t.date >= upToDateStr) return;
      
      if (t.accountId === accountId) bal -= t.accDeduction;
      if (t.toAccountId === accountId) bal += Math.abs(t.toAccDeduction || t.accDeduction);
    });
    
    return bal;
  }

  getAccBalance(accountId: string): number {
    return this.getAccBalanceUpTo(accountId);
  }

  // Fund balance calculation
  getFundBalanceUpTo(fundId: string, upToDateStr: string | null = null): number {
    const appData = this.financeVar.getAppData();
    const fund = appData.funds.find(f => f.id === fundId);
    if (!fund) return 0;
    
    let bal = fund.initAmount;
    const currenciesObj = currencies as any;
    
    appData.transactions.forEach(t => {
      if (upToDateStr && t.date >= upToDateStr) return;
      
      // 修正 1：嚴格限制只有「手動新增的支出與收入」才進行這個區塊的換算
      if (t.fundId === fundId && (t.type === 'expense' || t.type === 'income')) {
        const baseVal = t.amount * currenciesObj[t.currency].rate;
        // 修正：依據基金本身的幣種來還原數值，而不是寫死用 baseCurrency
        const fundCurrency = fund.currency || 'HKD';
        const fundVal = baseVal / currenciesObj[fundCurrency].rate;
        
        bal -= (t.type === 'expense') ? fundVal : -fundVal;
      }
      
      // 修正 2：系統產生的紀錄獨立計算，且轉入/轉出都只看 fundId
      if (t.type === 'sys_fund_cancel' && t.fundId === fundId) bal -= t.amount;
      if (t.type === 'sys_fund_transfer_out' && t.fundId === fundId) bal -= t.amount;
      if (t.type === 'sys_fund_transfer_in' && t.fundId === fundId) bal += t.amount; // 這裡本來是 toFundId，改為 fundId
    });
    
    return bal;
  }

  getFundBalance(fundId: string): number {
    return this.getFundBalanceUpTo(fundId);
  }

  // Net worth calculation
  getNetWorth(): { ast: number; liab: number; net: number } {
    const appData = this.financeVar.getAppData();
    let ast = 0, liab = 0;
    
    appData.accounts.forEach(a => {
      const v = this.getAccBalance(a.id) * this.getRateToBase(a.currency);
      v >= 0 ? ast += v : liab += Math.abs(v);
    });
    
    return { ast, liab, net: ast - liab };
  }

  // Daily fund limit methods
  getFundDailyLimitForDate(fundId: string, dateStr: string): number | null {
    const appData = this.financeVar.getAppData();
    const fund = appData.funds.find(f => f.id === fundId);
    if (!fund || !fund.hasDaily) return null;
    
    let limit = fund.dailyLimit || 0;
    const carryTxn = appData.transactions.find(t => 
      t.type === 'sys_fund_carry' && t.fundId === fundId && t.date === dateStr
    );
    if (carryTxn) limit += carryTxn.amount;
    return limit;
  }

  getFundSpentOnDate(fundId: string, dateStr: string): number {
    const appData = this.financeVar.getAppData();
    let spent = 0;
    const currenciesObj = currencies as any;
    appData.transactions.forEach(t => {
      if (t.date === dateStr && t.fundId === fundId && t.type === 'expense') {
        const baseVal = t.amount * currenciesObj[t.currency].rate;
        spent += baseVal / currenciesObj[appData.settings.baseCurrency].rate;
      }
    });
    return spent;
  }

  // Date utility methods
  getToday(offset: number = 0): string {
    return moment().add(offset, 'days').format('YYYY-MM-DD');
  }

  formatMonthView(yyyyMM: string): string {
    const date = moment(yyyyMM, 'YYYY-MM');
    return `${date.year()}年 ${date.month() + 1}月`;
  }

  // Daily rollover processing
  async processDailyRollovers(): Promise<void> {
    // Ensure storage is initialized and appData is available
    let appData = this.financeVar.getAppData();
    if (!appData) {
      // Wait for initialization to complete
      await new Promise(resolve => {
        const subscription = this.financeVar.appData$.subscribe(data => {
          if (data !== null) {
            subscription.unsubscribe();
            resolve(null);
          }
        });
      });
      appData = this.financeVar.getAppData();
    }
    
    const today = this.getToday();
    
    if (!appData.lastRolloverDate) {
      this.financeVar.updateAppData({ lastRolloverDate: today });
      return;
    }
    
    if (appData.lastRolloverDate === today) return;
    
    const fundsWithDaily = appData.funds.filter(f => f.hasDaily && f.unspentAction !== 'none');
    if (fundsWithDaily.length === 0) {
      this.financeVar.updateAppData({ lastRolloverDate: today });
      return;
    }
    
    // Generate date array from last + 1 to yesterday
    let currentDate = moment(appData.lastRolloverDate).add(1, 'day');
    const processDates: string[] = [];
    
    while (currentDate.isBefore(today, 'day')) {
      processDates.push(currentDate.format('YYYY-MM-DD'));
      currentDate.add(1, 'day');
    }
    
    const newTransactions = [...appData.transactions];
    
    processDates.forEach(dateStr => {
      fundsWithDaily.forEach(fund => {
        const limit = this.getFundDailyLimitForDate(fund.id, dateStr) || 0;
        const spent = this.getFundSpentOnDate(fund.id, dateStr);
        const unspent = limit - spent;
        
        if (unspent > 0) {
          if (fund.unspentAction === 'carry') {
            const nextDate = moment(dateStr).add(1, 'day').format('YYYY-MM-DD');
            newTransactions.push({
              id: `sys_${Date.now()}${Math.random()}`,
              type: 'sys_fund_carry',
              amount: unspent,
              currency: appData.settings.baseCurrency,
              exRate: 1,
              accDeduction: 0,
              accountId: '',
              fundId: fund.id,
              date: nextDate,
              note: '遞延未用完額度'
            });
          } else if (fund.unspentAction === 'cancel') {
            newTransactions.push({
              id: `sys_${Date.now()}${Math.random()}`,
              type: 'sys_fund_cancel',
              amount: unspent,
              currency: appData.settings.baseCurrency,
              exRate: 1,
              accDeduction: 0,
              accountId: '',
              fundId: fund.id,
              date: dateStr,
              note: '系統取消未用額度'
            });
          } else if (fund.unspentAction === 'transfer' && fund.transferTargetId) {
            const targetFund = appData.funds.find(f => f.id === fund.transferTargetId);
            if (targetFund) {
              const sourceCurrency = fund.currency || 'HKD';
              const targetCurrency = targetFund.currency || 'HKD';
              const currenciesObj = currencies as any;
              
              // 計算跨幣種匯率： (日圓未用額度 * 日圓匯率) / 港幣匯率 = 港幣實際增加金額
              const sourceRate = currenciesObj[sourceCurrency].rate;
              const targetRate = currenciesObj[targetCurrency].rate;
              const baseVal = unspent * sourceRate;
              const convertedUnspent = baseVal / targetRate;

              // 1. 來源基金：轉出紀錄 (保留原本的幣種與金額)
              newTransactions.push({
                id: `sys_out_${Date.now()}${Math.random()}`,
                type: 'sys_fund_transfer_out',
                amount: unspent,
                currency: sourceCurrency, 
                exRate: 1,
                accDeduction: 0,
                accountId: '',
                fundId: fund.id,      // 只掛在來源基金
                date: dateStr,
                note: `自動轉出未用額度 (至 ${targetFund.name})`
              });

              // 2. 目標基金：轉入紀錄 (使用轉換後的幣種與金額)
              newTransactions.push({
                id: `sys_in_${Date.now()}${Math.random()}`,
                type: 'sys_fund_transfer_in',
                amount: convertedUnspent, 
                currency: targetCurrency, 
                exRate: 1,
                accDeduction: 0,
                accountId: '',
                fundId: targetFund.id, // 直接掛在目標基金
                date: dateStr,
                note: `來自 ${fund.name} 未用額度`
              });
            }
          }
        }
      });
    });
    
    this.financeVar.updateAppData({ 
      transactions: newTransactions,
      lastRolloverDate: today 
    });
  }

  // Calculate daily grouped data for charts and lists
  calculateDailyGroupedData(monthStr: string, context: 'home' | 'account' | 'fund', contextId?: string) {
    const appData = this.financeVar.getAppData();
    
    // Filter transactions for the month and context
    let txns = appData.transactions.filter(t => t.date.startsWith(monthStr));
    
    if (context === 'account' && contextId) {
      txns = txns.filter(t => t.accountId === contextId || t.toAccountId === contextId);
    } else if (context === 'fund' && contextId) {
      txns = txns.filter(t => t.fundId === contextId);
    } else {
      // Home view: hide system-level fund operations
      txns = txns.filter(t => !t.type.startsWith('sys_fund_'));
    }
    
    // Sort by date ascending
    txns.sort((a, b) => moment(a.date).diff(moment(b.date)));
    
    // Calculate opening balance
    const firstDayOfMonth = `${monthStr}-01`;
    let openingBal = 0;
    
    if (context === 'home') {
      appData.accounts.forEach(a => 
        openingBal += this.getAccBalanceUpTo(a.id, firstDayOfMonth) * this.getRateToBase(a.currency)
      );
    } else if (context === 'account' && contextId) {
      openingBal = this.getAccBalanceUpTo(contextId, firstDayOfMonth);
    } else if (context === 'fund' && contextId) {
      openingBal = this.getFundBalanceUpTo(contextId, firstDayOfMonth);
    }
    
    let currentBal = openingBal;
    const groupedDays: { [key: string]: any } = {};
    let totalInc = 0, totalExp = 0;
    
  
    
    // Process each transaction
    txns.forEach(t => {
      if (!groupedDays[t.date]) {
        groupedDays[t.date] = { date: t.date, txns: [], startBal: currentBal };
      }
      
      // Calculate impact on current balance
      let impact = 0;
      if (context === 'home') {
        if (t.type === 'expense') impact = -(t.amount * this.getRateToBase(t.currency));
        if (t.type === 'income') impact = t.amount * this.getRateToBase(t.currency);
      } else if (context === 'account' && contextId) {
          const acc = appData.accounts.find(a => a.id === contextId);
          if (acc && t.accountId === contextId) {
            impact = -t.accDeduction;
          }
          if (t.type === 'transfer' && t.toAccountId === contextId) {
            impact = Math.abs(t.toAccDeduction || t.accDeduction);
          }
      } else if (context === 'fund' && contextId) {
        const fund = appData.funds.find(f => f.id === contextId);
        const fundCurrency = fund?.currency || 'HKD';
        const currenciesObj = currencies as any;
        
        // 確保手動新增的交易，在明細清單中是以「該基金的幣值」顯示，而不是 baseCurrency
        const getFundVal = (txnAmt: number, txnCur: string) => {
             const baseVal = txnAmt * currenciesObj[txnCur].rate;
             return baseVal / currenciesObj[fundCurrency].rate;
        };

        if (t.type === 'expense' && t.fundId === contextId) impact = -getFundVal(t.amount, t.currency);
        if (t.type === 'income' && t.fundId === contextId) impact = getFundVal(t.amount, t.currency);
        
        // 系統交易的 impact (建立時就已經計算好正確幣值了)
        if (t.type === 'sys_fund_cancel' && t.fundId === contextId) impact = -t.amount;
        if (t.type === 'sys_fund_transfer_out' && t.fundId === contextId) impact = -t.amount;
        // 注意這裡原本是看 t.toFundId，現在改回 t.fundId
        if (t.type === 'sys_fund_transfer_in' && t.fundId === contextId) impact = t.amount;
      }
      
      currentBal += impact;
      
      t._runningBal = currentBal;
      
      // Track total income/expenses
      if (!t.type.startsWith('sys_') && t.type !== 'transfer') {
        if (impact > 0) totalInc += impact;
        else totalExp += Math.abs(impact);
      } else if (t.type === 'transfer' && context === 'account') {
        if (impact > 0) totalInc += impact;
        else totalExp += Math.abs(impact);
      }
      
      // Add transaction to day group (newest first)
      groupedDays[t.date].txns.unshift(t);
      groupedDays[t.date].endBal = currentBal;
    });
    
    // Convert to array and sort by date descending
    const daysArr = Object.values(groupedDays).sort((a, b) => 
      moment(b.date).diff(moment(a.date))
    );
    
    return {
      days: daysArr,
      openBal: openingBal,
      closeBal: currentBal,
      totalInc,
      totalExp
    };
  }

  exportData(format: 'csv' | 'json'): string {
    const appData = this.financeVar.getAppData();
    
    if (format === 'json') {
      return JSON.stringify(appData, null, 2);
    } else {
      // 簡單的 CSV 生成邏輯
      const header = ['Date', 'Type', 'Amount', 'Currency', 'Note'];
      const rows = appData.transactions.map(t => 
        [t.date, t.type, t.amount, t.currency, t.note].join(',')
      );
      return [header.join(','), ...rows].join('\n');
    }
  }
  executeAddTransaction(t: Transaction) {
    const appData = this.financeVar.getAppData();
    
    if (t.type === 'expense' && t.accountId) {
      const account = appData.accounts.find(a => a.id === t.accountId);
      
      if (account && account.type === 'transit') {
        const txAmount = t.amount * (t.exRate || 1); // 將支出轉換為交通卡的幣值
        
        // 【有開啟自動增值】
        if (account.autoTopUp) {
          let currentBal = this.getAccBalance(account.id);
          
          // 條件 2: 下次交易前轉帳 (如果上次買完已經變負數，先補足)
          if (account.topUpTrigger === 'before_next' && currentBal <= 0) {
            this.generateAutoTopUpTransaction(account, t.date);
            currentBal += (account.topUpAmount || 250); // 模擬餘額增加
          }
          
          // 定義計算「當前購買力 (Buying Power)」的邏輯
          const getPower = (bal: number) => {
            if (!account.allowNegative) return bal; // 不可負數，購買力 = 餘額
            if (account.negativeMode === 'once' && bal < 0) return 0; // 只能負1次且已負，購買力 = 0
            return bal + (account.negativeLimit || 0); // 購買力 = 餘額 + 下限額度
          };
          
          // 核心迴圈：如果購買力不夠買這筆東西，就自動增值，直到夠買為止！
          while (getPower(currentBal) < txAmount) {
            this.generateAutoTopUpTransaction(account, t.date);
            currentBal += (account.topUpAmount || 250); // 模擬餘額增加
          }
        }
        
        // 寫入本次的手動支出交易
        this.financeVar.addTransaction(t);
        
        // 條件 1: 寫入後，如果餘額變為 <= 0 且設定為「當下轉帳」，則補一次錢
        if (account.autoTopUp) {
          const postBal = this.getAccBalance(account.id);
          if (account.topUpTrigger === 'instant' && postBal <= 0) {
            this.generateAutoTopUpTransaction(account, t.date);
          }
        }
        return;
      }
    }
    
    // 一般常規交易，直接寫入
    this.financeVar.addTransaction(t);
  }

  private generateAutoTopUpTransaction(account: Account, dateStr: string) {
    const topUpAmt = account.topUpAmount || 250;
    const sourceAccId = account.topUpSourceAccountId;
    if (!sourceAccId) return;
    
    const appData = this.financeVar.getAppData();
    const sourceAcc = appData.accounts.find(a => a.id === sourceAccId);
    if (!sourceAcc) return;

    const currenciesObj = currencies as any;
    const fromRate = currenciesObj[account.currency].rate;   // 交通卡幣種匯率
    const toRate = currenciesObj[sourceAcc.currency].rate;   // 扣款來源帳戶幣種匯率

    // 建立一筆標準的「系統自動增值轉帳紀錄」
    const topUpTxn: Transaction = {
      id: `sys_topup_${Date.now()}_${Math.random()}`,
      type: 'transfer',
      amount: topUpAmt,
      currency: account.currency, // 以交通卡的幣別記帳
      exRate: fromRate / toRate,
      accDeduction: (topUpAmt * fromRate) / toRate, // 來源帳戶本幣扣款額
      toAccountId: account.id,                      // 轉入目的地：交通卡
      toAccDeduction: -topUpAmt,                    // 交通卡本幣實收增加額 (負數代表轉入)
      accountId: sourceAccId,                       // 轉出方：銀行或現金
      category: '轉帳',
      icon: '🔄',
      date: dateStr,
      note: `交通卡自動增值 (來自 ${sourceAcc.name})`
    };

    this.financeVar.addTransaction(topUpTxn);
  }
}