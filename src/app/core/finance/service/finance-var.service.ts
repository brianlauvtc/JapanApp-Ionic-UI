import { Injectable } from '@angular/core';
import { Storage } from '@ionic/storage-angular';
import { BehaviorSubject, Observable } from 'rxjs';
import { AppData, Account, Transaction, Fund, Plan, AIHistoryItem } from '../model/finance.model';

@Injectable({
  providedIn: 'root'
})
export class FinanceVarService {
  public appDataSubject = new BehaviorSubject<AppData>(null);
  public appData$ = this.appDataSubject.asObservable();

  constructor(private storage: Storage) {
    this.initStorage();
  }

  private getDefaultAppData(): AppData {
    return {
      isInit: false,
      settings: {
        baseCurrency: 'HKD',
        apiKey: '',
        enableAIHistory: true,
        aiFrequency: '1_day'
      },
      accounts: [],
      transactions: [],
      funds: [],
      plans: [],
      aiHistory: [],
      lastAITime: null,
      lastRolloverDate: null
    };
  }

  public async initStorage() {
    await this.storage.create();
    const savedData = await this.storage.get('accApp_data_v6');
    console.log('Loaded app data from storage:', savedData);
    if (savedData) {
      this.appDataSubject.next(savedData);
    } else {
      const defaultData = this.getDefaultAppData();
      defaultData.isInit = true;
      this.appDataSubject.next(defaultData);
    }
  }

  getAppData(): AppData {
    return this.appDataSubject.getValue();
  }

  updateAppData(newData: Partial<AppData>) {
    const currentData = this.getAppData();
    const updatedData = { ...currentData, ...newData };
    this.appDataSubject.next(updatedData);
    this.storage.set('accApp_data_v6', updatedData);
  }

  // Account methods
  getAccounts(): Account[] {
    return this.getAppData().accounts;
  }

  addAccount(account: Account) {
    const accounts = [...this.getAccounts(), account];
    this.updateAppData({ accounts });
  }

  updateAccount(id: string, updatedAccount: Partial<Account>) {
    const accounts = this.getAccounts().map(acc => 
      acc.id === id ? { ...acc, ...updatedAccount } : acc
    );
    this.updateAppData({ accounts });
  }

  deleteAccount(id: string) {
    const accounts = this.getAccounts().filter(acc => acc.id !== id);
    const transactions = this.getTransactions().filter(t => 
      t.accountId !== id && t.toAccountId !== id
    );
    this.updateAppData({ accounts, transactions });
  }

  // Transaction methods
  getTransactions(): Transaction[] {
    return this.getAppData().transactions;
  }

  addTransaction(transaction: Transaction) {
    const transactions = [...this.getTransactions(), transaction];
    this.updateAppData({ transactions });
  }

  updateTransaction(id: string, updatedTransaction: Partial<Transaction>) {
    const transactions = this.getTransactions().map(txn => 
      txn.id === id ? { ...txn, ...updatedTransaction } : txn
    );
    this.updateAppData({ transactions });
  }

  deleteTransaction(id: string) {
    const transactions = this.getTransactions().filter(txn => txn.id !== id);
    this.updateAppData({ transactions });
  }

  // Fund methods
  getFunds(): Fund[] {
    return this.getAppData().funds;
  }

  addFund(fund: Fund) {
    const funds = [...this.getFunds(), fund];
    this.updateAppData({ funds });
  }

  updateFund(id: string, updatedFund: Partial<Fund>) {
    const funds = this.getFunds().map(f => 
      f.id === id ? { ...f, ...updatedFund } : f
    );
    this.updateAppData({ funds });
  }

  deleteFund(id: string) {
    const funds = this.getFunds().filter(f => f.id !== id);
    const transactions = this.getTransactions().filter(t => 
      t.fundId !== id && t.toFundId !== id
    );
    this.updateAppData({ funds, transactions });
  }

  // Settings methods
  updateSettings(settings: Partial<AppData['settings']>) {
    const currentSettings = this.getAppData().settings;
    const updatedSettings = { ...currentSettings, ...settings };
    this.updateAppData({ settings: updatedSettings });
  }

  // AI History methods
  addAIHistory(item: AIHistoryItem) {
    const aiHistory = [item, ...this.getAppData().aiHistory];
    this.updateAppData({ aiHistory });
  }

  // Plan methods
  getPlans(): Plan[] {
    return this.getAppData().plans;
  }

  addPlan(plan: Plan) {
    const plans = [...this.getPlans(), plan];
    this.updateAppData({ plans });
  }

  updatePlan(id: string, updatedPlan: Partial<Plan>) {
    const plans = this.getPlans().map(p => 
      p.id === id ? { ...p, ...updatedPlan } : p
    );
    this.updateAppData({ plans });
  }

  deletePlan(id: string) {
    const plans = this.getPlans().filter(p => p.id !== id);
    this.updateAppData({ plans });
  }

  // Clear all data
  clearAllData() {
    const defaultData = this.getDefaultAppData();
    defaultData.isInit = true;
    defaultData.settings = this.getAppData().settings; // Keep settings
    this.updateAppData(defaultData);
  }
}