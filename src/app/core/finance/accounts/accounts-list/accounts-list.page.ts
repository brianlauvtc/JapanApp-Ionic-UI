import { Component, OnInit } from '@angular/core';
import { Router } from '@angular/router';
import { ModalController } from '@ionic/angular';
import { FinanceVarService } from '../../service/finance-var.service';
import { FinanceService } from '../../service/finance.service';
import { currencies } from '../../environment/environment';
import { EditAccountModalPage } from '../edit-account-modal/edit-account-modal.page';
import { EditFundModalPage } from '../edit-fund-modal/edit-fund-modal.page';

@Component({
  selector: 'app-accounts-list',
  templateUrl: './accounts-list.page.html',
  styleUrls: ['./accounts-list.page.scss']
})
export class AccountsListPage implements OnInit {
  currencies = currencies;
  baseCurrency: string = 'HKD';
  baseCurrencySymbol: string = '$';
  
  constructor(
    private financeVar: FinanceVarService,
    private financeService: FinanceService,
    private router: Router,
    private modalController: ModalController
  ) {}

  ngOnInit() {
    const appData = this.financeVar.getAppData();
    this.baseCurrency = appData.settings.baseCurrency;
    const currenciesObj = this.currencies as any;
    this.baseCurrencySymbol = currenciesObj[this.baseCurrency]?.symbol || '$';
  }

  getAccountsByType(type: string) {
    return this.financeVar.getAccounts().filter(a => a.type === type);
  }

  getAccBalance(accountId: string) {
    return this.financeService.getAccBalance(accountId);
  }

  viewAccountDetail(accountId: string) {
    this.router.navigate(['/account-detail', accountId]);
  }

  viewFundDetail(fundId: string) {
    this.router.navigate(['/fund-detail', fundId]);
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
}