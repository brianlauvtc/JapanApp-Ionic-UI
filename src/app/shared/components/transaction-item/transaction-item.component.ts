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
  @Output() copyTransaction = new EventEmitter<string>();

  
  constructor(private financeService: FinanceService) {}

  getTransactionDisplay(): { prefix: string; color: string; note: string; displayHtml: string; catName: string } {

    if (!this.transaction) {
      return { prefix: '', color: '', note: '', displayHtml: '', catName: '' };
    }

    let prefix = '';
    let color = 'text-gray-800';
    let note = this.transaction.note || '';
    let catName = this.transaction.category;
    let displayAmt = this.transaction.amount;
    const currenciesObj = currencies as any;
    let symbol = currenciesObj[this.transaction.currency]?.symbol || '$';
    let accSymbol = null;

    const appData = this.financeService['financeVar'].getAppData();
    const acc = appData.accounts.find(a => a.id === this.contextId);
    if (acc) {
      accSymbol = currenciesObj[acc.currency]?.symbol || '$';
    }

    // 判斷交易類型與正負號
    if (this.transaction.type.startsWith('sys_')) {
      catName = '系統調整';
      color = 'text-gray-500';
    } else if (this.transaction.type === 'expense') {
      prefix = '-'; // 支出加上負號
      color = 'text-danger';
      if (this.context === 'home') {
        const accountName = appData.accounts.find(a => a.id === this.transaction.accountId)?.name || '未知';
        note = `${accountName} · ${note}`;
      }
    } else if (this.transaction.type === 'income') {
      prefix = '+'; // 收入加上正號
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
          prefix = '-'; // 轉出加上負號
          color = 'text-danger';
          note = `轉出至 ${toAcc?.name}`;
          const baseVal = this.transaction.amount * currenciesObj[this.transaction.currency].rate;
          displayAmt = baseVal / currenciesObj[fromAcc!.currency].rate;
          symbol = currenciesObj[fromAcc!.currency].symbol;
        } else if (this.contextId === this.transaction.toAccountId) {
          prefix = '+'; // 轉入加上正號
          color = 'text-success';
          note = `由 ${fromAcc?.name} 轉入`;
          const baseVal = this.transaction.amount * currenciesObj[this.transaction.currency].rate;
          displayAmt = baseVal / currenciesObj[toAcc!.currency].rate;
          symbol = currenciesObj[toAcc!.currency].symbol;
        }
      }
    }

    // ✨ 修正：在這裡組合 displayHtml，確保 prefix (正負號) 被加入，且使用正確的 displayAmt
    let displayHtml = '';
    if (this.context === 'account' && acc && this.transaction.currency !== acc.currency) {
      // 跨幣種顯示
      displayHtml = `${prefix}${accSymbol}${Math.abs(this.transaction.accDeduction).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} <small class="text-small text-medium">(${symbol}${this.transaction.amount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })})</small>`;
    } else {
      // 一般顯示
      displayHtml = `${prefix}${symbol}${Number(displayAmt).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
    }

    // ✨ 修正：把 catName 也回傳，讓 HTML 畫面的 {{ getTransactionDisplay().catName }} 能夠正確讀取
    return { prefix, color, note, displayHtml, catName };
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

  onCopy(slidingItem?: IonItemSliding) {
    if (!this.transaction.type.startsWith('sys_')) {
      this.copyTransaction.emit(this.transaction.id);
      if (slidingItem) {
        slidingItem.close();
      }
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

  hasSplitShares(): boolean {
    return !!this.transaction.isSplitPay && !!this.transaction.splitShares && this.transaction.splitShares.length > 0;
  }

  getSplitSharesDetails(): { name: string; amount: number; symbol: string }[] {
    if (!this.transaction.splitShares) return [];
    const appData = this.financeService['financeVar'].getAppData();
    const currenciesObj = currencies as any;
    const symbol = currenciesObj[this.transaction.currency]?.symbol || '$';
    return this.transaction.splitShares.map(s => {
      const accName = appData.accounts.find(a => a.id === s.loanAccountId)?.name || '朋友';
      return { name: accName, amount: s.amount, symbol };
    });
  }

  hasReferences(): boolean {
    return !!this.transaction.referencedTransactionIds && this.transaction.referencedTransactionIds.length > 0;
  }

  getReferencedTxnsDetails(): { category: string; icon: string; note: string; date: string; amount: number; symbol: string }[] {
    if (!this.transaction.referencedTransactionIds) return [];
    const allTxns = this.financeService['financeVar'].getTransactions();
    const currenciesObj = currencies as any;
    
    return this.transaction.referencedTransactionIds.map(id => {
      const tx = allTxns.find(t => t.id === id);
      if (!tx) return null;
      const symbol = currenciesObj[tx.currency]?.symbol || '$';
      
      let loanAmt = tx.splitOthersShare || 0;
      const loanAccId = this.transaction.accountId || this.transaction.toAccountId || '';
      if (tx.splitShares && loanAccId) {
        const share = tx.splitShares.find(s => s.loanAccountId === loanAccId);
        if (share) loanAmt = share.amount;
      }
      
      return {
        category: tx.category || '分類',
        icon: tx.icon || '💰',
        note: tx.note || '無備忘錄',
        date: tx.date,
        amount: loanAmt,
        symbol
      };
    }).filter(Boolean) as any[];
  }
}