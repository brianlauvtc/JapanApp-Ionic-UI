import { Component, Input, Output, EventEmitter } from '@angular/core';
import { Transaction } from '../../../core/finance/model/finance.model';
import { FinanceService } from '../../../core/finance/service/finance.service';
import { currencies } from '../../../core/finance/environment/environment';
import { IonItemSliding } from '@ionic/angular';

@Component({
  selector: 'app-transaction-item',
  templateUrl: './transaction-item.component.html',
  styleUrls: ['./transaction-item.component.scss']
})
export class TransactionItemComponent {
  @Input() transaction!: Transaction;
  @Input() context: 'home' | 'account' | 'fund' = 'home';
  @Input() contextId?: string;
  @Output() editTransaction = new EventEmitter<string>();
  @Output() deleteTransaction = new EventEmitter<string>();

  
  constructor(private financeService: FinanceService) {}

  getTransactionDisplay(): { prefix: string; color: string; note: string; displayHtml: string } {

    if (!this.transaction) {
      return { prefix: '', color: '', note: '', displayHtml: '' };
    }

    let prefix = '', color = 'text-gray-800', note = this.transaction.note || '', catName = this.transaction.category;
    let displayAmt = this.transaction.amount;
    const currenciesObj = currencies as any;
    let symbol = currenciesObj[this.transaction.currency]?.symbol || '$';
    let displayHtml = `${symbol}${Number(this.transaction.amount).toLocaleString()}`;
    let accSymbol = null;

    const appData = this.financeService['financeVar'].getAppData();
    const acc = appData.accounts.find(a => a.id === this.contextId);
    if (acc) {
      accSymbol = currenciesObj[acc.currency]?.symbol || '$';
    }

    // Handle different transaction types
    if (this.transaction.type.startsWith('sys_')) {
      catName = '系統調整';
      color = 'text-gray-500';
    } else if (this.transaction.type === 'expense') {
      prefix = '-';
      color = 'text-danger';
      if (this.context === 'home') {
        const accountName = appData.accounts.find(a => a.id === this.transaction.accountId)?.name || '未知';
        note = `${accountName} · ${note}`;
      }
    } else if (this.transaction.type === 'income') {
      prefix = '+';
      color = 'text-success';
      if (this.context === 'home') {
        const accountName = appData.accounts.find(a => a.id === this.transaction.accountId)?.name || '未知';
        note = `${accountName} · ${note}`;
      }
    } else if (this.transaction.type === 'transfer') {
      catName = '轉帳';
      this.transaction.icon = '🔄';
      const fromAcc = appData.accounts.find(a => a.id === this.transaction.accountId);
      const toAcc = appData.accounts.find(a => a.id === this.transaction.toAccountId);

      if (this.context === 'home') {
        note = `${fromAcc?.name || '?'} ➡️ ${toAcc?.name || '?'}`;
        color = 'text-medium';
      } else if (this.context === 'account') {
        if (this.contextId === this.transaction.accountId) {
          prefix = '-';
          color = 'text-danger';
          note = `轉出至 ${toAcc?.name}`;
          const baseVal = this.transaction.amount * currenciesObj[this.transaction.currency].rate;
          displayAmt = baseVal / currenciesObj[fromAcc!.currency].rate;
          symbol = currenciesObj[fromAcc!.currency].symbol;
        } else if (this.contextId === this.transaction.toAccountId) {
          prefix = '+';
          color = 'text-success';
          note = `由 ${fromAcc?.name} 轉入`;
          const baseVal = this.transaction.amount * currenciesObj[this.transaction.currency].rate;
          displayAmt = baseVal / currenciesObj[toAcc!.currency].rate;
          symbol = currenciesObj[toAcc!.currency].symbol;
        }
      }
    }

    // Handle currency conversion display
    if (this.context === 'account' && acc && this.transaction.currency !== acc.currency) {
      displayHtml = `${accSymbol}${Math.abs(this.transaction.accDeduction).toLocaleString()} <small class="text-small text-medium">(${symbol}${this.transaction.amount.toLocaleString()})</small>`;
    }

    return { prefix, color, note, displayHtml };
  }

  getCurrencySymbol(): string {
    const appData = this.financeService['financeVar'].getAppData();
    let currencyCode: string;
    
    if (this.context === 'home' || this.context === 'fund') {
      currencyCode = appData.settings.baseCurrency;
    } else {
      // context is 'account'
      const account = appData.accounts.find(a => a.id === this.contextId);
      currencyCode = account?.currency || 'HKD';
    }
    
    const currenciesObj = currencies as any;
    return currenciesObj[currencyCode]?.symbol || '$';
  }

  onEdit() {
    if (!this.transaction.type.startsWith('sys_')) {
      this.editTransaction.emit(this.transaction.id);
    }
  }

  onDelete(slidingItem?: IonItemSliding) {
    if (!this.transaction.type.startsWith('sys_')) {
      // 觸發事件，將交易 ID 傳給父組件
      this.deleteTransaction.emit(this.transaction.id);
      
      // (可選) 如果有傳入 slidingItem，在點擊後自動收起滑動選單
      if (slidingItem) {
        slidingItem.close();
      }
    }
  }
}