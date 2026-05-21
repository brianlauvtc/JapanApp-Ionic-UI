import { Component, OnInit } from '@angular/core';
import { Router } from '@angular/router';
import { FinanceVarService } from '../../service/finance-var.service';
import { FinanceService } from '../../service/finance.service';
import { currencies } from '../../environment/environment';

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
    private router: Router
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

  openEditAccountModal() {
    // This will be implemented with Ionic modal later
    console.log('Open add account modal');
  }

  openEditFundModal() {
    // This will be implemented with Ionic modal later
    console.log('Open add fund modal');
  }

  getFunds() {
    return this.financeVar.getFunds();
  }

  getFundBalance(fundId: string) {
    return this.financeService.getFundBalanceUpTo(fundId);
  }
}