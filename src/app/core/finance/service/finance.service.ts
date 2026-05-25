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
      
      if (t.fundId === fundId && t.type !== 'transfer') {
        const baseVal = t.amount * currenciesObj[t.currency].rate;
        const fundVal = baseVal / currenciesObj[appData.settings.baseCurrency].rate;
        bal -= (t.type === 'expense') ? fundVal : -fundVal;
      }
      
      if (t.type === 'sys_fund_cancel' && t.fundId === fundId) bal -= t.amount;
      if (t.type === 'sys_fund_transfer_out' && t.fundId === fundId) bal -= t.amount;
      if (t.type === 'sys_fund_transfer_in' && t.toFundId === fundId) bal += t.amount;
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

  getEndOfMonth(yyyyMM: string): string {
    const today = moment();
    const monthDate = moment(yyyyMM, 'YYYY-MM');
    
    if (monthDate.isSame(today, 'month')) {
      return this.getToday();
    } else {
      return monthDate.endOf('month').format('YYYY-MM-DD');
    }
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
            newTransactions.push({
              id: `sys_${Date.now()}${Math.random()}`,
              type: 'sys_fund_transfer_out',
              amount: unspent,
              currency: appData.settings.baseCurrency,
              exRate: 1,
              accDeduction: 0,
              accountId: '',
              fundId: fund.id,
              toFundId: fund.transferTargetId,
              date: dateStr,
              note: '自動轉出未用額度'
            });
            newTransactions.push({
              id: `sys_${Date.now()}${Math.random()}`,
              type: 'sys_fund_transfer_in',
              amount: unspent,
              currency: appData.settings.baseCurrency,
              exRate: 1,
              accDeduction: 0,
              accountId: '',
              fundId: fund.id,
              toFundId: fund.transferTargetId,
              date: dateStr,
              note: '來自其他基金未用額度'
            });
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
      txns = txns.filter(t => t.fundId === contextId || t.toFundId === contextId);
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
        if (t.type === 'expense' && t.fundId === contextId) impact = -(t.amount * this.getRateToBase(t.currency));
        if (t.type === 'income' && t.fundId === contextId) impact = t.amount * this.getRateToBase(t.currency);
        if (t.type === 'sys_fund_cancel' && t.fundId === contextId) impact = -t.amount;
        if (t.type === 'sys_fund_transfer_out' && t.fundId === contextId) impact = -t.amount;
        if (t.type === 'sys_fund_transfer_in' && t.toFundId === contextId) impact = t.amount;
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
}