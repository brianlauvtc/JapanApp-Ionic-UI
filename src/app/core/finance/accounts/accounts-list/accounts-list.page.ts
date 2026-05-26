import { Component, OnInit } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { AlertController, ModalController, NavController } from '@ionic/angular';
import { FinanceVarService } from '../../service/finance-var.service';
import { FinanceService } from '../../service/finance.service';
import { currencies, CurrencyCode } from '../../environment/environment';
import { EditAccountModalPage } from '../edit-account-modal/edit-account-modal.page';
import { EditFundModalPage } from '../edit-fund-modal/edit-fund-modal.page';
import { ActionSheetController } from '@ionic/angular';

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
}