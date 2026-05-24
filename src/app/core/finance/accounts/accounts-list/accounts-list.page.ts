import { Component, OnInit } from '@angular/core';
import { Router } from '@angular/router';
import { ModalController, NavController } from '@ionic/angular';
import { FinanceVarService } from '../../service/finance-var.service';
import { FinanceService } from '../../service/finance.service';
import { currencies, CurrencyCode } from '../../environment/environment';
import { EditAccountModalPage } from '../edit-account-modal/edit-account-modal.page';
import { EditFundModalPage } from '../edit-fund-modal/edit-fund-modal.page';

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
    private navCtrl: NavController
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
    this.navCtrl.navigateForward(`/tabs/accounts/account-detail/${accountId}`);
  }

  viewFundDetail(fundId: string) {
    this.navCtrl.navigateForward(`/tabs/accounts/fund-detail/${fundId}`);
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
    return this.currencies[currency as keyof typeof this.currencies]?.symbol || '$';
  }
}