import { Injectable } from '@angular/core';
import { Storage } from '@ionic/storage-angular';
import { BehaviorSubject, Observable } from 'rxjs';
import { AppData, Account, Transaction, Fund, Plan, AIHistoryItem } from '../model/finance.model';
import { AlertController } from '@ionic/angular';
import { FileSyncService } from './file-sync.service';
import { EXPENSE_CATEGORIES, INCOME_CATEGORIES, CATEGORY_MAP } from '../.././../../environments/categories';

@Injectable({
  providedIn: 'root'
})
export class FinanceVarService {
  public appDataSubject = new BehaviorSubject<AppData>(null);
  public appData$ = this.appDataSubject.asObservable();

  constructor(private storage: Storage, private fileSyncService: FileSyncService, private alertController: AlertController) {
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
    const savedAppData = await this.storage.get('accApp_data_v6');
    console.log('💾 從 IndexedDB 讀取的資料:', savedAppData);
    // 讀取手機實體檔案
    const fileData = await this.fileSyncService.readFromFile();
    console.log('📂 從實體檔案讀取的資料:', fileData);
    if (!savedAppData && !fileData) {
      // 情況 A：全新安裝，且沒有存檔
      const defaultData = this.getDefaultAppData();
      defaultData.isInit = true;
      this.appDataSubject.next(defaultData);
      this.fileSyncService.saveToFile(defaultData); // 建立初始檔案
    } 
    else if (!savedAppData && fileData) {
      // 情況 B：重灌 App (或清空資料)，但手機內有有效存檔 -> 直接讀取存檔
      this.appDataSubject.next(fileData);
      this.storage.set('accApp_data_v6', fileData);
    }
    else if (savedAppData && !fileData) {
      // 情況 C：有 App 資料，但沒有實體檔案 (可能用戶誤刪檔案) -> 用 App 資料重建檔案
      this.appDataSubject.next(savedAppData);
      this.fileSyncService.saveToFile(savedAppData);
    }
    else if (savedAppData && fileData) {
      // 情況 D：兩邊都有資料，開始比對！
      // 簡單比較兩邊 JSON 結構是否完全一致 (轉字串比較最快，也可以用深度比對)
      const isSame = JSON.stringify(savedAppData) === JSON.stringify(fileData);

      if (isSame) {
        this.appDataSubject.next(savedAppData);
      } else {
        // 兩邊資料不同，先暫存 appData 並彈出選擇視窗
        this.appDataSubject.next(savedAppData);
        await this.showConflictResolution(savedAppData, fileData);
      }
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
    this.fileSyncService.saveToFile(updatedData);
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
    // 1. 移除基金本身
    const funds = this.getFunds().filter(f => f.id !== id);
    
    // 2. 更新交易紀錄：取消與該基金的連結，而不是刪除交易
    const transactions = this.getTransactions().map(t => {
      // 複製一份 transaction 物件
      const updatedTxn = { ...t };
      
      // 如果這筆交易的 fundId 是我們要刪除的基金，就取消連結
      if (updatedTxn.fundId === id) {
        delete updatedTxn.fundId; 
      }
      
      // 如果這筆交易的 toFundId 是我們要刪除的基金，就取消連結
      if (updatedTxn.toFundId === id) {
        delete updatedTxn.toFundId;
      }
      
      return updatedTxn;
    });

    // 3. 更新資料
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

  private async showConflictResolution(appData: AppData, fileData: AppData) {
    const diffs = this.fileSyncService.compareData(appData, fileData);
    
    // 將差異組合為 HTML 列表
    const diffHtml = diffs.map(d => `<li>${d}</li>`).join('');

    const alert = await this.alertController.create({
      header: '⚠️ 發現資料不一致',
      subHeader: 'App 內部資料與實體存檔檔案內容不同：',
      message: `<ul style="text-align: left; padding-left: 16px;">${diffHtml || '<li>資料細節不符</li>'}</ul><br>請問您要以哪邊的資料作準？`,
      backdropDismiss: false,
      buttons: [
        {
          text: '覆寫實體存檔 (以 App 為準)',
          cssClass: 'primary',
          handler: () => {
            this.fileSyncService.saveToFile(appData); // 用 App 蓋掉檔案
          }
        },
        {
          text: '讀取實體存檔 (以檔案為準)',
          cssClass: 'danger',
          handler: () => {
            this.appDataSubject.next(fileData); // 更新 subject
            this.storage.set('accApp_data_v6', fileData); // 覆寫 indexedDB
          }
        }
      ]
    });

    await alert.present();
  }

  // 🌟 動態獲取所有支出分類 (靜態 + 自訂)
  getAllExpenseCategories() {
    const custom = this.getAppData().customCategories?.filter(c => c.type === 'expense') || [];
    return [...EXPENSE_CATEGORIES, ...custom];
  }

  // 🌟 動態獲取所有收入分類 (靜態 + 自訂)
  getAllIncomeCategories() {
    const custom = this.getAppData().customCategories?.filter(c => c.type === 'income') || [];
    return [...INCOME_CATEGORIES, ...custom];
  }

  // 🌟 動態產生供 AI 與系統翻譯用的 Map 對照表
  getCategoryMap() {
    const map = { ...CATEGORY_MAP };
    const custom = this.getAppData().customCategories || [];
    custom.forEach(c => map[c.id] = c.name);
    return map;
  }

  // 🌟 儲存/刪除自訂分類 (會自動觸發實體檔案備份)
  updateCustomCategories(categories: any[]) {
    this.updateAppData({ customCategories: categories });
  }
  
}