import { Component, OnInit } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { AlertController, ModalController, NavController } from '@ionic/angular';
import { FinanceVarService } from '../../service/finance-var.service';
import { FinanceService } from '../../service/finance.service';
import { currencies, CurrencyCode } from '../../environment/environment';
import { EditAccountModalPage } from '../edit-account-modal/edit-account-modal.page';
import { EditFundModalPage } from '../edit-fund-modal/edit-fund-modal.page';
import { ActionSheetController } from '@ionic/angular';
import { Transaction, Account } from '../../model/finance.model';

@Component({
  selector: 'app-accounts-list',
  templateUrl: './accounts-list.page.html',
  styleUrls: ['./accounts-list.page.scss']
})

export class AccountsListPage implements OnInit {
  currencies = currencies;
  baseCurrency: CurrencyCode = 'HKD';
  baseCurrencySymbol: string = '$';

  constructor(
    private financeVar: FinanceVarService,
    private financeService: FinanceService,
    private router: Router,
    private modalController: ModalController,
    private alertController: AlertController,
    private actionSheetCtrl: ActionSheetController,
    private modalCtrl: ModalController,
  ) {}

  ngOnInit() {
    const appData = this.financeVar.getAppData();
    this.baseCurrency = appData.settings.baseCurrency;
    this.baseCurrencySymbol = this.currencies[this.baseCurrency].symbol;
  }

  get netWorth() {
    // 呼叫 financeService 即時計算，若尚未載入完畢則回傳預設的 0
    return this.financeService.getNetWorth() || { net: 0, ast: 0, liab: 0 };
  }

  get accounts() {
    return this.financeVar.getAccounts();
  }

  getAccountsByType(type: string) {
    return this.accounts.filter(a => a.type === type);
  }

  hasAccountType(type: string): boolean {
    return this.accounts.some(acc => acc.type === type);
  }

  getAccBalance(accountId: string) {
    return this.financeService.getAccBalance(accountId);
  }

  viewAccountDetail(accountId: string) {
    this.router.navigate(['/tabs/accounts/account-detail', accountId]);
  }

  viewFundDetail(fundId: string) {
    this.router.navigate(['/tabs/accounts/fund-detail', fundId]);
  }

  async openEditAccountModal() {
    const modal = await this.modalController.create({
      component: EditAccountModalPage,
      componentProps: {}
    });
    await modal.present();
    const { data } = await modal.onWillDismiss();
    if (data?.success) {
      // Account created/updated successfully
    }
  }

  async openEditFundModal() {
    const modal = await this.modalController.create({
      component: EditFundModalPage,
      componentProps: {}
    });
    await modal.present();
    const { data } = await modal.onWillDismiss();
    if (data?.success) {
      // Fund created/updated successfully
    }
  }

  getFunds() {
    return this.financeVar.getFunds();
  }

  getFundBalance(fundId: string) {
    return this.financeService.getFundBalanceUpTo(fundId);
  }

  getCurrencySymbol(currency: string): string {
    const currenciesObj = {
      HKD: { symbol: '$', rate: 1, name: 'HKD' },
      JPY: { symbol: '¥', rate: 0.05, name: 'JPY' }
    };
    return currenciesObj[currency as keyof typeof currenciesObj]?.symbol || '$';
  }

  async deleteAccount(id: string) {
    const alert = await this.alertController.create({
      header: '警告',
      message: '確定要移除此帳戶嗎？此動作無法復原。',
      buttons: [
        { text: '取消', role: 'cancel' },
        { 
          text: '刪除', 
          handler: () => {
            this.financeVar.deleteAccount(id); 
          } 
        }
      ]
    });
    await alert.present();
  }
   
  async deleteFundPrompt(id: string) {
    const alert = await this.alertController.create({
      header: '警告',
      message: '確定要移除此基金嗎？\n移除後相關交易紀錄將會保留，但會解除與此基金的連結。此動作無法復原。',
      buttons: [
        { text: '取消', role: 'cancel' },
        { 
          text: '刪除', 
          handler: () => {
            // 呼叫 Service 的 deleteFund
            this.financeVar.deleteFund(id); 
          } 
        }
      ]
    });
    await alert.present();
  }
  getFundDailyLimit(fundId: string): number | null {
    const today = this.financeService.getToday();
    return this.financeService.getFundDailyLimitForDate(fundId, today);
  }

  getFundUnspentToday(fundId: string): number | null {
    const limit = this.getFundDailyLimit(fundId);
    if (limit === null) return null; // 沒有設定每日上限
    const today = this.financeService.getToday();
    const spent = this.financeService.getFundSpentOnDate(fundId, today);
    return limit - spent;
  }

  async presentAddActionSheet() {
    const actionSheet = await this.actionSheetCtrl.create({
      header: '新增項目',
      mode: 'ios', // Gives it that native premium feel
      buttons: [
        {
          text: '新增帳戶',
          icon: 'wallet-outline',
          handler: () => {
            this.openEditAccountModal(); // Your existing function
          }
        },
        {
          text: '新增基金',
          icon: 'pie-chart-outline',
          handler: () => {
            this.openEditFundModal(); // Your existing function
          }
        },
        {
          text: '取消',
          icon: 'close-outline',
          role: 'cancel'
        }
      ]
    });
    await actionSheet.present();
  }

  selectedTab: 'assets' | 'loans' = 'assets';
  selectedLoanFriendId: string = 'all';

  getLoanFriends(): Account[] {
    return this.financeVar.getAccounts().filter(a => a.type === 'loan');
  }

  getPrepayTransactions(): Transaction[] {
    const allTx = this.financeVar.getTransactions();
    const friendId = this.selectedLoanFriendId;
    return allTx.filter(t => {
      if (t.type !== 'expense' || !t.isSplitPay) return false;
      if (friendId === 'all') return true;
      if (t.splitLoanAccountId === friendId) return true;
      if (t.splitShares && t.splitShares.some(s => s.loanAccountId === friendId)) return true;
      return false;
    });
  }

  getRepaymentTransfers(): Transaction[] {
    const allTx = this.financeVar.getTransactions();
    const friendId = this.selectedLoanFriendId;
    return allTx.filter(t => {
      if (t.type !== 'transfer') return false;
      
      const allAccounts = this.financeVar.getAccounts();
      const fromAcc = allAccounts.find(a => a.id === t.accountId);
      const toAcc = allAccounts.find(a => a.id === t.toAccountId);
      
      const involvesLoan = (fromAcc && fromAcc.type === 'loan') || (toAcc && toAcc.type === 'loan');
      if (!involvesLoan) return false;
      
      if (friendId === 'all') return true;
      return t.accountId === friendId || t.toAccountId === friendId;
    });
  }

  getRemainingBalanceForFriend(tx: Transaction, friendId: string): number {
    if (friendId === 'all') {
      const friends = this.getLoanFriends();
      return friends.reduce((sum, f) => sum + this.getRemainingBalanceForFriend(tx, f.id), 0);
    }

    const originalAmount = this.getSplitAmountForFriend(tx, friendId);
    if (originalAmount <= 0) return 0;

    let totalRepaid = 0;
    const allTxns = this.financeVar.getTransactions();

    allTxns.forEach(t => {
      if (t.type === 'transfer' && t.referencedTransactionIds && t.referencedTransactionIds.includes(tx.id)) {
        // ONLY count transfers that involve this specific friend's loan account!
        if (t.accountId !== friendId && t.toAccountId !== friendId) {
          return;
        }

        const referencedTxns = allTxns.filter(refTx => t.referencedTransactionIds!.includes(refTx.id));
        const sumShares = referencedTxns.reduce((sum, refTx) => sum + this.getSplitAmountForFriend(refTx, friendId), 0);

        if (sumShares > 0) {
          const allocation = t.amount * (originalAmount / sumShares);
          totalRepaid += allocation;
        } else {
          totalRepaid += t.amount;
        }
      }
    });

    return Math.max(0, originalAmount - totalRepaid);
  }

  getSplitAmountForFriend(tx: Transaction, friendId: string): number {
    if (friendId === 'all') {
      if (tx.splitLoanAccountId) return tx.splitOthersShare || 0;
      if (tx.splitShares) return tx.splitShares.reduce((sum, s) => sum + s.amount, 0);
      return 0;
    }
    if (tx.splitLoanAccountId === friendId) {
      return tx.splitOthersShare || 0;
    }
    if (tx.splitShares) {
      const share = tx.splitShares.find(s => s.loanAccountId === friendId);
      return share ? share.amount : 0;
    }
    return 0;
  }

  getAlreadyRepaidAmountForFriend(tx: Transaction, friendId: string): number {
    const original = this.getSplitAmountForFriend(tx, friendId);
    const remaining = this.getRemainingBalanceForFriend(tx, friendId);
    return Math.max(0, original - remaining);
  }

  getFriendSummaryList(): { friend: Account; split: number; repaid: number; remaining: number }[] {
    const friends = this.getLoanFriends();
    const allTx = this.financeVar.getTransactions();
    
    return friends.map(friend => {
      let split = 0;
      let repaid = 0;
      
      const prepayBills = allTx.filter(t => {
        if (t.type !== 'expense' || !t.isSplitPay) return false;
        if (t.splitLoanAccountId === friend.id) return true;
        if (t.splitShares && t.splitShares.some(s => s.loanAccountId === friend.id)) return true;
        return false;
      });

      prepayBills.forEach(tx => {
        const share = this.getSplitAmountForFriend(tx, friend.id);
        split += share;
        const remainingForTx = this.getRemainingBalanceForFriend(tx, friend.id);
        repaid += (share - remainingForTx);
      });

      return {
        friend,
        split,
        repaid,
        remaining: Math.max(0, split - repaid)
      };
    });
  }

  getReferencedTransactionsText(tx: Transaction): string {
    if (!tx.referencedTransactionIds || tx.referencedTransactionIds.length === 0) return '無連結交易';
    const allTxns = this.financeVar.getTransactions();
    const linked = allTxns.filter(t => tx.referencedTransactionIds!.includes(t.id));
    if (linked.length === 0) return '關聯交易';
    return linked.map(t => `${t.icon || '💰'} ${t.category} (${this.getCurrencySymbol(t.currency)}${t.amount})`).join(', ');
  }

  expandedPrepayTxId: string | null = null;

  togglePrepayExpansion(txId: string) {
    if (this.expandedPrepayTxId === txId) {
      this.expandedPrepayTxId = null;
    } else {
      this.expandedPrepayTxId = txId;
    }
  }

  getRepaymentsForBill(txId: string): Transaction[] {
    const allTx = this.financeVar.getTransactions();
    return allTx.filter(t => {
      return t.type === 'transfer' && t.referencedTransactionIds && t.referencedTransactionIds.includes(txId);
    });
  }

  getRepaymentAllocationForBill(repayTx: Transaction, billTx: Transaction, friendId: string): number {
    const originalAmount = this.getSplitAmountForFriend(billTx, friendId);
    if (originalAmount <= 0) return 0;
    if (!repayTx.referencedTransactionIds) return 0;

    const allTxns = this.financeVar.getTransactions();
    const referencedTxns = allTxns.filter(refTx => repayTx.referencedTransactionIds!.includes(refTx.id));
    const sumShares = referencedTxns.reduce((sum, refTx) => sum + this.getSplitAmountForFriend(refTx, friendId), 0);

    if (sumShares > 0) {
      return repayTx.amount * (originalAmount / sumShares);
    }
    return repayTx.amount;
  }

  getSplitSharesForTx(tx: Transaction): { friend: Account; amount: number; repaid: number; remaining: number }[] {
    const allAccounts = this.financeVar.getAccounts();
    const shares: { friend: Account; amount: number; repaid: number; remaining: number }[] = [];

    if (tx.splitLoanAccountId) {
      const friend = allAccounts.find(a => a.id === tx.splitLoanAccountId);
      if (friend) {
        const amount = tx.splitOthersShare || 0;
        const remaining = this.getRemainingBalanceForFriend(tx, friend.id);
        shares.push({
          friend,
          amount,
          repaid: Math.max(0, amount - remaining),
          remaining
        });
      }
    }

    if (tx.splitShares) {
      tx.splitShares.forEach(s => {
        if (s.amount > 0) {
          const friend = allAccounts.find(a => a.id === s.loanAccountId);
          if (friend) {
            const amount = s.amount;
            const remaining = this.getRemainingBalanceForFriend(tx, friend.id);
            shares.push({
              friend,
              amount,
              repaid: Math.max(0, amount - remaining),
              remaining
            });
          }
        }
      });
    }

    return shares;
  }

  getTransferFriendName(repay: Transaction): string {
    const allAccounts = this.financeVar.getAccounts();
    const fromAcc = allAccounts.find(a => a.id === repay.accountId);
    const toAcc = allAccounts.find(a => a.id === repay.toAccountId);
    
    if (fromAcc && fromAcc.type === 'loan') return fromAcc.name;
    if (toAcc && toAcc.type === 'loan') return toAcc.name;
    return '朋友';
  }
}