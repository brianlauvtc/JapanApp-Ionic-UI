import { Component, OnInit, Optional } from '@angular/core';
import { ActivatedRoute, NavigationEnd, Router } from '@angular/router';
import { FormBuilder, FormGroup, Validators, FormArray } from '@angular/forms';
import { FinanceVarService } from '../../service/finance-var.service';
import { FinanceService } from '../../service/finance.service';
import { Transaction, Account, Fund } from '../../model/finance.model';
import { AlertController, ModalController, NavParams } from '@ionic/angular';
import  moment from 'moment';
import { filter } from 'rxjs';
import { EXPENSE_CATEGORIES, INCOME_CATEGORIES } from '../../../../../environments/categories';

@Component({
  selector: 'app-add-transaction-page',
  templateUrl: './add-transaction-page.page.html',
  styleUrls: ['./add-transaction-page.page.scss']
})

export class AddTransactionPagePage implements OnInit {
  transactionForm!: FormGroup;
  txnType: 'expense' | 'income' | 'transfer' = 'expense';
  selectedCategory: any = null;
  isEditMode = false;
  editTransactionId: string | null = null;
  categories = this.getCategories();
  
  // Context from navigation
  contextAccountId: string | null = null;
  contextFundId: string | null = null;
  contextType: string | null = null;
  
  isModal: boolean = false;
  ignoreRateCalc = false;
  realExchangeRates: { [key: string]: number } = { HKD: 1, JPY: 20 }; // 預設值，避免網路不通
  
  // Items form and data
  items: { name: string; quantity: number; price: number }[] = [];
  itemForm = { name: '', quantity: null, price: null };
  editingIndex: number | null = null;
  
  // Category display state
  showAllCategories = false;
  
  // Auto upload feature
  hasApiKey = false;
  
  // AI auto-fill feature
  aiTransactions: any[] = [];
  currentTransactionIndex: number = 0;
  isAIScanningMode: boolean = false;
  hasViewedLastReceipt: boolean = false;

  // Dirty state tracking
  private initialFormValues: any = null;
  private isFormDirty: boolean = false;

  currentErrors: string[] = [];

  constructor(
    private route: ActivatedRoute,
    private router: Router,
    private fb: FormBuilder,
    private financeVar: FinanceVarService,
    private financeService: FinanceService,
    private modalCtrl: ModalController,
    private alertController: AlertController,
    private navParams: NavParams
  ) {
    this.isModal = !!this.navParams && !!this.navParams.data;
  }

  ngOnInit() {
    this.fetchRealRates();
    this.initForm();
    this.setupTypeSubscription();
    this.loadContextFromRoute();      

    this.categories = this.getCategories();
    this.setupFormListeners();
    
    // Capture initial form values for dirty checking
    this.captureInitialFormValues();
    
    // Check if Gemini API key is available for auto-upload feature
    this.hasApiKey = !!this.financeVar.getAppData().settings.apiKey;
    
    // Check if we have AI pre-filled data
    this.checkForAiData(history.state);

  // 2. Listen to router events for when the view is returned to from the cache
    this.router.events.pipe(
      filter(event => event instanceof NavigationEnd)
    ).subscribe(() => {
      const state = this.router.getCurrentNavigation()?.extras?.state || history.state;
      this.checkForAiData(state);
    });
  }

  async fetchRealRates() {
    try {
      const response = await fetch('https://open.er-api.com/v6/latest/HKD');
      const data = await response.json();
      if (data && data.rates) {
        this.realExchangeRates['HKD'] = 1;
        this.realExchangeRates['JPY'] = data.rates.JPY; // 抓取真實匯率
        
        // 如果是新增模式，且還沒填寫過資料，則刷新匯率
        if (!this.isEditMode) {
           this.calculateExchangeRate();
        }
      }
    } catch (e) {
      console.error('無法獲取即時匯率，將使用預設值', e);
    }
  }

  private checkForAiData(state: any) {
    if (state && state.aiTransactions && state.aiTransactions.length > 0) {
      this.isAIScanningMode = true;
      this.aiTransactions = state.aiTransactions;
      this.currentTransactionIndex = state.currentTransactionIndex || 0;
      
      // LOGIC: If there is only 1 transaction, allow saving immediately. 
      // Otherwise, require them to reach the end.
      this.hasViewedLastReceipt = this.aiTransactions.length <= 1;
      
      this.txnType = 'expense';
      this.categories = this.getCategories();
      this.prefillFormFromAITransaction(this.aiTransactions[this.currentTransactionIndex]);
      this.isModal = false;
  
      history.replaceState(null, '');
    }
  }

  private syncFormToAITransaction() {
    if (!this.isAIScanningMode || !this.aiTransactions[this.currentTransactionIndex]) return;
    
    const formValue = this.transactionForm.value;
    this.aiTransactions[this.currentTransactionIndex].amount = parseFloat(formValue.amount) || 0;
    this.aiTransactions[this.currentTransactionIndex].currency = formValue.currency;
    this.aiTransactions[this.currentTransactionIndex].accountId = formValue.accountId;
    this.aiTransactions[this.currentTransactionIndex].date = formValue.date;
    this.aiTransactions[this.currentTransactionIndex].note = formValue.note;
    this.aiTransactions[this.currentTransactionIndex].category = this.selectedCategory?.name || formValue.category;
    this.aiTransactions[this.currentTransactionIndex].items = [...this.items];
  }
  fillFormWithAiData(data: any) {
    if (!data) return;
  
    // Find category object matching the name string from your system list
    const matchedCat = this.categories.find(c => c.name === data.category) || 
                       this.categories.find(c => c.id === 'other_expense') || { name: data.category, icon: '💰' };
  
    this.selectedCategory = matchedCat;
  
    // Patch standard field forms 
    this.transactionForm.patchValue({
      amount: data.amount || '',
      currency: data.currency || 'HKD',
      date: data.date || this.getToday(),
      note: data.note || '',
      category: matchedCat.name
    });
  
    // Map individual receipt lines cleanly into your application items display array
    if (data.items && data.items.length > 0) {
      this.items = data.items.map((item: any) => ({
        name: item.name || '',
        quantity: item.quantity || 1,
        price: item.price || 0
      }));
    } else {
      this.items = [];
    }
  
    // Fire calculations for active rate profiles
    this.calculateExchangeRate();
  }
  getToday(offset: number = 0): string {
    return this.financeService.getToday(offset);
  }
  
  initForm() {
    this.transactionForm = this.fb.group({
      amount: ['', [Validators.required, Validators.min(0.01)]],
      currency: ['HKD', Validators.required],
      accountId: ['', Validators.required],
      accountToId: [''],
      fundId: [''],
      date: [this.getToday(), Validators.required],
      note: [''],
      category: [''],
      exchangeRate: [1],
      allocations: this.fb.array([])
    });
  }

  loadContextFromRoute() {
    let id = null;
    
    if (this.isModal) {
      id = this.navParams?.get('id') || this.navParams?.get('transactionId');
      this.contextAccountId = this.navParams?.get('accountId');
      this.contextFundId = this.navParams?.get('fundId');
      this.contextType = this.navParams?.get('context');
    }
    
    if (!id && this.route && this.route.snapshot) {
      id = this.route.snapshot.queryParamMap?.get('id');
      if (!this.contextAccountId) this.contextAccountId = this.route.snapshot.queryParamMap?.get('accountId');
      if (!this.contextFundId) this.contextFundId = this.route.snapshot.queryParamMap?.get('fundId');
      if (!this.contextType) this.contextType = this.route.snapshot.queryParamMap?.get('context');
    }
    
    if (id) {
      this.isEditMode = true;
      this.editTransactionId = id;
      this.loadTransactionForEdit(id);
    } else {
      // Set default values based on context
      let defaultAccountId = this.contextAccountId;
      
      // If no context account, try to use last used account for this transaction type
      if (!defaultAccountId) {
        const lastAccount = this.loadLastAccount();
        if (lastAccount) {
          defaultAccountId = lastAccount;
        }
      }
      
      if (defaultAccountId) {
        this.transactionForm.patchValue({ accountId: defaultAccountId });
      }
      
      if (this.contextFundId && this.contextType === 'fund') {
        this.transactionForm.patchValue({ fundId: this.contextFundId });
        this.txnType = 'expense';
      }
    }
  }

  setupFormListeners() {
    this.transactionForm.get('currency')?.valueChanges.subscribe(() => {
      if (!this.ignoreRateCalc) this.calculateExchangeRate();
      this.checkFormDirty();
    });
    
    this.transactionForm.get('accountId')?.valueChanges.subscribe(() => {
      if (!this.ignoreRateCalc) this.calculateExchangeRate();
      this.checkFormDirty();
    });

    this.transactionForm.get('accountToId')?.valueChanges.subscribe(() => {
      if (!this.ignoreRateCalc) this.calculateExchangeRate();
      this.checkFormDirty();
    });
    
    this.transactionForm.get('amount')?.valueChanges.subscribe(() => {
      this.updateCalculatedAmount();
      this.checkFormDirty();
    });

    this.transactionForm.valueChanges.subscribe(() => {
      this.checkFormDirty();
      //this.updateValidationErrors();
    });
  }

  private captureInitialFormValues() {
    setTimeout(() => {
      this.initialFormValues = this.transactionForm.getRawValue();
      this.isFormDirty = false;
    }, 0);
  }

  private checkFormDirty() {
    if (!this.initialFormValues) return;
    
    const currentValues = this.transactionForm.getRawValue();
    this.isFormDirty = JSON.stringify(currentValues) !== JSON.stringify(this.initialFormValues);
  }

  calculateExchangeRate() {
    const currency = this.transactionForm.get('currency')?.value;
    const accountId = this.transactionForm.get('accountId')?.value;
    const accountToId = this.transactionForm.get('accountToId')?.value;
    
    if (!currency) return;
    
    // 決定要比較匯率的目標帳戶 (轉帳時看轉入或轉出，一般看扣款帳戶)
    let targetAccId = accountId;
    if (this.txnType === 'transfer') {
       const fromAcc = this.financeVar.getAccounts().find(a => a.id === accountId);
       const toAcc = this.financeVar.getAccounts().find(a => a.id === accountToId);
       if (toAcc && currency !== toAcc.currency && currency === fromAcc?.currency) {
           targetAccId = accountToId;
       }
    }

    if (!targetAccId) {
      this.transactionForm.patchValue({ exchangeRate: 1 }, { emitEvent: false });
      return;
    }

    const targetAccount = this.financeVar.getAccounts().find(a => a.id === targetAccId);
    if (!targetAccount) return;

    if (currency === targetAccount.currency) {
      this.transactionForm.patchValue({ exchangeRate: 1 }, { emitEvent: false });
    } else {
      // 動態換算：例如用 JPY 扣 HKD 帳戶 -> rate = 1 / 19.5 = 0.05128
      const fromRate = this.realExchangeRates[currency] || 1;
      const toRate = this.realExchangeRates[targetAccount.currency] || 1;
      const rate = toRate / fromRate;
      
      this.transactionForm.patchValue({ exchangeRate: Number(rate.toFixed(6)) }, { emitEvent: false });
    }
  }

  updateCalculatedAmount() {
    // This will be used for display purposes
  }

  setTxnType(type: 'expense' | 'income' | 'transfer') {
    this.txnType = type;
    this.selectedCategory = null;
    this.transactionForm.patchValue({ category: '' });
    
    if (type === 'transfer') {
      this.selectedCategory = { name: '轉帳', icon: '🔄' };
      this.transactionForm.patchValue({ category: '轉帳' });
    }
    
    // Refresh categories based on new transaction type
    this.categories = this.getCategories();
    //this.updateValidationErrors();
  }

  selectCategory(category: any) {
    this.selectedCategory = category;
    this.transactionForm.patchValue({ category: category.name });
  }

  getVisibleCategories() {
    if (this.showAllCategories || this.categories.length <= 8) {
      return this.categories;
    }
    return this.categories.slice(0, 8);
  }

  toggleShowAllCategories() {
    this.showAllCategories = !this.showAllCategories;
  }

  getCategories() {
    const allTransactions = this.financeVar.getTransactions();
    
    if (this.txnType === 'income') {
      return this.sortCategoriesByFrequency(INCOME_CATEGORIES, allTransactions);
    } else if (this.txnType === 'expense') {
      return this.sortCategoriesByFrequency(EXPENSE_CATEGORIES, allTransactions);
    } else {
      // Transfer - only show transfer category
      return [
        { id: 'transfer', name: '轉帳', icon: '🔀' }
      ];
    }
  }

  private sortCategoriesByFrequency(categories: any[], transactions: any[]): any[] {
    // Count transactions for each category
    const categoryCounts: { [key: string]: number } = {};
    transactions.forEach(txn => {
      if (txn.type === this.txnType && txn.category) {
        categoryCounts[txn.category] = (categoryCounts[txn.category] || 0) + 1;
      }
    });
    
    // Sort categories by count (descending)
    return [...categories].sort((a, b) => {
      const countA = categoryCounts[a.name] || 0;
      const countB = categoryCounts[b.name] || 0;
      return countB - countA; // Descending order
    });
  }

  get accounts() {
    return this.financeVar.getAccounts();
  }
  
  getAccounts() {
    return this.financeVar.getAccounts();
  }

  getFunds() {
    return this.financeVar.getFunds();
  }

  // 更新：表單校驗邏輯 (新增全面防止負數的檢查)

  /*validateForm(): boolean {
    const amount = parseFloat(this.transactionForm.get('amount')?.value);
    const accountId = this.transactionForm.get('accountId')?.value;
    
    if (!amount || amount <= 0) return false;
    if (!accountId) return false;
    if (this.txnType !== 'transfer' && !this.selectedCategory) return false;
    
    // 轉帳模式下，如果未選轉入帳戶，或者轉出與轉入帳戶相同，則不允許儲存
    if (this.txnType === 'transfer') {
      const accountToId = this.transactionForm.get('accountToId')?.value;
      if (!accountToId || accountId === accountToId) {
        return false;
      }
    }
    
    // ===== 全面餘額防呆校驗 (防止變負數) =====
    if (this.txnType === 'expense' || this.txnType === 'transfer') {
      const account = this.financeVar.getAccounts().find(a => a.id === accountId);
      
      if (account) {
        const exchangeRate = parseFloat(this.transactionForm.get('exchangeRate')?.value) || 1;
        const txAmount = amount * exchangeRate; // 本次交易實際要從帳戶扣除的基礎貨幣金額
        let currentBal = this.getAccBalance(account.id);
        
        // 💡 關鍵細節：如果是編輯模式，我們需要先「補回」原本這筆交易扣除的金額，才能算出真正的可用餘額
        if (this.isEditMode && this.editTransactionId) {
           const oldTx = this.financeVar.getTransactions().find(t => t.id === this.editTransactionId);
           // 確保舊交易確實是從同一個帳戶扣款的
           if (oldTx && oldTx.accountId === account.id) {
              currentBal += (oldTx.accDeduction || 0);
           }
        }
        
        if (account.type === 'transit') {
          // 交通卡專屬邏輯 (如未開啟自動增值，則判斷負數上限)
          if (!account.autoTopUp) {
            let actualLimit = currentBal;
            if (account.allowNegative) {
              actualLimit = (account.negativeMode === 'once' && currentBal < 0) ? 0 : currentBal + (account.negativeLimit || 0);
            }
            if (txAmount > actualLimit) {
              this.showBalanceError('交通卡餘額不足，且已超出設定的負數限制。');
              return false;
            }
          }
        } else if (account.type !== 'credit') {
          // 除了信用卡 (與上述的交通卡)，其他所有帳戶 (cash, bank, loan 等) 嚴格不允許低於 0
          if (currentBal - txAmount < 0) {
            // 使用 toFixed(2) 讓顯示金額比較好看
            this.showBalanceError(`【${account.name}】餘額不足 (剩餘 ${currentBal.toFixed(2)})，不允許扣至負數。`);
            return false;
          }
        }
      }
    }
    
    return true;
  }*/

  validateForm(): boolean {
    return this.currentErrors.length === 0;
  }

  async showBalanceError(message: string) {
    const alert = await this.alertController.create({
      header: '⚠️ 儲存失敗',
      message: message,
      buttons: ['確定']
    });
    await alert.present();
  }

  swapTransferAccounts() {
    const fromId = this.transactionForm.get('accountId')?.value;
    const toId = this.transactionForm.get('accountToId')?.value;

    this.transactionForm.patchValue({
      accountId: toId,
      accountToId: fromId
    }, { emitEvent: false }); // 避免重複觸發多次計算

    // 交換後重新依據新組合計算預設匯率
    this.calculateExchangeRate();
    this.checkFormDirty();
    //this.updateValidationErrors();
  }

  updateValidationErrors() {
    const errors: string[] = [];
    const formValue = this.transactionForm.value;
    const amount = parseFloat(formValue.amount);
    const accountId = formValue.accountId;
    const exchangeRate = parseFloat(formValue.exchangeRate) || 1;

    // 1. 基本校驗
    if (isNaN(amount) || amount <= 0) {
      errors.push('請輸入大於 0 的金額');
    }
    if (!accountId) {
      errors.push('請選擇轉出/付款帳戶');
    }
    if (this.txnType !== 'transfer' && !this.selectedCategory) {
      errors.push('請選擇交易分類');
    }

    // 2. 轉帳專屬校驗
    if (this.txnType === 'transfer') {
      const accountToId = formValue.accountToId;
      if (!accountToId) {
        errors.push('請選擇轉入帳戶');
      } else if (accountId === accountToId) {
        errors.push('轉出與轉入帳戶不能相同');
      }
    }

    // 3. 餘額防呆校驗 (防止變負數，僅在有輸入金額且選擇帳戶時才檢查)
    if (amount > 0 && accountId && (this.txnType === 'expense' || this.txnType === 'transfer')) {
      const account = this.financeVar.getAccounts().find(a => a.id === accountId);
      
      if (account) {
        const txAmount = amount * exchangeRate;
        let currentBal = this.getAccBalance(account.id);
        
        // 如果是編輯模式，需要先補回舊交易的扣款，算出真實可用餘額
        if (this.isEditMode && this.editTransactionId) {
           const oldTx = this.financeVar.getTransactions().find(t => t.id === this.editTransactionId);
           if (oldTx && oldTx.accountId === account.id) {
              currentBal += (oldTx.accDeduction || 0);
           }
        }
        
        if (account.type === 'transit') {
          if (!account.autoTopUp) {
            let actualLimit = currentBal;
            if (account.allowNegative) {
              actualLimit = (account.negativeMode === 'once' && currentBal < 0) ? 0 : currentBal + (account.negativeLimit || 0);
            }
            if (txAmount > actualLimit) {
              errors.push(`【${account.name}】餘額不足，且已超出負數限制`);
            }
          }
        } else if (account.type !== 'credit') {
          // 一般帳戶嚴格不可為負
          if (currentBal - txAmount < 0) {
            errors.push(`【${account.name}】餘額不足 (剩餘 ${currentBal.toFixed(2)})`);
          }
        }
      }
    }

    // 更新給 HTML 渲染的錯誤陣列
    this.currentErrors = errors;
  }

  async deleteTransaction() {
    const alert = await this.alertController.create({
        header: '確認刪除',
        message: '確定要移除這筆交易嗎？',
        buttons: [
            { text: '取消', role: 'cancel' },
            { text: '刪除', role: 'destructive', handler: () => {
                this.financeVar.deleteTransaction(this.editTransactionId!);
                this.modalCtrl.dismiss({ success: true, deleted: true });
            }}
        ]
    });
    await alert.present();
  }
  async goBack() {
    // Handle AI scanning mode - show confirmation before going back
    if (this.isAIScanningMode) {
      const alert = await this.alertController.create({
        header: '取消新增交易',
        message: '確定要取消新增這筆交易嗎？已輸入的資料將會遺失。',
        buttons: [
          {
            text: '繼續掃描',
            role: 'cancel',
            cssClass: 'secondary'
          },
          {
            text: '取消全部',
            role: 'destructive',
            handler: () => {
              // Navigate back based on context
              if (this.contextType === 'account' && this.contextAccountId) {
                this.router.navigate(['/account-detail', this.contextAccountId]);
              } else if (this.contextType === 'fund' && this.contextFundId) {
                this.router.navigate(['/fund-detail', this.contextFundId]);
              } else {
                this.router.navigate(['/tabs/home']);
              }
            }
          }
        ]
      });
      await alert.present();
      return;
    }
    
    // Handle regular mode with dirty form confirmation
    if (this.isFormDirty && !this.isEditMode) {
      const alert = await this.alertController.create({
        header: '取消新增交易',
        message: '確定要取消新增這筆交易嗎？已輸入的資料將會遺失。',
        buttons: [
          {
            text: '繼續編輯',
            role: 'cancel',
            cssClass: 'secondary'
          },
          {
            text: '取消',
            role: 'destructive',
            handler: () => {
              this.performGoBack();
            }
          }
        ]
      });
      await alert.present();
      return;
    }
    
    // Handle edit mode or clean form - go back directly
    this.performGoBack();
  }
  
  private async performGoBack() {
    // Handle modal mode
    if (this.isModal && this.modalCtrl) {
      await this.modalCtrl.dismiss();
      return;
    }
    
    // Handle regular navigation
    if (this.contextType === 'account' && this.contextAccountId) {
      this.router.navigate(['/account-detail', this.contextAccountId]);
    } else if (this.contextType === 'fund' && this.contextFundId) {
      this.router.navigate(['/fund-detail', this.contextFundId]);
    } else {
      this.router.navigate(['/tabs/home']);
    }
  }

  getAccountCurrency(accountId: string): string {
    const account = this.financeVar.getAccounts().find(a => a.id === accountId);
    return account?.currency || 'HKD';
  }

  getAccBalance(accountId: string): number {
    return this.financeService.getAccBalance(accountId);
  }

  getCurrencySymbol(currency: string): string {
    const currencies = {
      HKD: { symbol: '$', rate: 1, name: 'HKD' },
      JPY: { symbol: '¥', rate: 0.05, name: 'JPY' }
    };
    return currencies[currency as keyof typeof currencies]?.symbol || '$';
  }

  showExchangeRate(): boolean {
    const currency = this.transactionForm.get('currency')?.value;
    const accountId = this.transactionForm.get('accountId')?.value;
    const accountToId = this.transactionForm.get('accountToId')?.value;
    
    if (!currency) return false;
    const fromAcc = this.financeVar.getAccounts().find(a => a.id === accountId);
    
    if (this.txnType === 'transfer') {
       const toAcc = this.financeVar.getAccounts().find(a => a.id === accountToId);
       return (fromAcc && currency !== fromAcc.currency) || (toAcc && currency !== toAcc.currency) || false;
    } else {
       return !!fromAcc && currency !== fromAcc.currency;
    }
  }

  calculatedAmount(): string {
    const amount = parseFloat(this.transactionForm.get('amount')?.value) || 0;
    const exchangeRate = parseFloat(this.transactionForm.get('exchangeRate')?.value) || 1;
    
    const accountId = this.transactionForm.get('accountId')?.value;
    const account = this.financeVar.getAccounts().find(a => a.id === accountId);
    const accountCurrency = account?.currency || 'HKD';
    
    return `${this.getCurrencySymbol(accountCurrency)} ${(amount * exchangeRate).toFixed(2)}`;
  }

  getAccountLabel(): string {
    if (this.txnType === 'transfer') {
      return '轉出帳戶';
    } else if (this.txnType === 'income') {
      return '收款帳戶';
    } else {
      return '付款帳戶';
    }
  }

  isEmoji(str: string): boolean {
    return /[^\x00-\x7F]/.test(str);
  }

  getCategoryIconName(icon: string): string {
    // Check if icon is already an emoji (contains non-ASCII characters)
    if (/[^\x00-\x7F]/.test(icon)) {
      return ''; // Return empty string to use emoji directly
    }
    
    // Map custom icons to Ionicons
    const iconMap: { [key: string]: string } = {
      'fast-food': 'fast-food',
      'bus': 'bus',
      'cart': 'cart',
      'game-controller': 'game-controller',
      'document-text': 'document-text',
      'swap-horizontal': 'swap-horizontal',
      'cash': 'cash'
    };
    return iconMap[icon] || 'cash';
  }

  // Items management methods
  canAddItem(): boolean {
    return this.itemForm.name.trim() !== '' && 
           this.itemForm.quantity > 0 && 
           this.itemForm.price >= 0;
  }

  addItem() {
    if (!this.canAddItem()) return;
    
    const newItem = {
      name: this.itemForm.name.trim(),
      quantity: this.itemForm.quantity,
      price: this.itemForm.price
    };
    
    if (this.editingIndex !== null) {
      this.items[this.editingIndex] = newItem;
      this.editingIndex = null;
    } else {
      this.items.push(newItem);
    }
    
    this.resetItemForm();
  }

  editItem(index: number) {
    const item = this.items[index];
    this.itemForm = { ...item };
    this.editingIndex = index;
  }

  removeItem(index: number) {
    this.items.splice(index, 1);
    if (this.editingIndex === index) {
      this.resetItemForm();
    } else if (this.editingIndex !== null && this.editingIndex > index) {
      this.editingIndex--;
    }
  }

  resetItemForm() {
    this.itemForm = { name: '', quantity: 1, price: 0 };
    this.editingIndex = null;
  }

  getItemsTotal(): number {
    return this.items.reduce((total, item) => total + (item.quantity * item.price), 0);
  }

  // Override loadTransactionForEdit to handle items and capture initial state
  loadTransactionForEdit(id: string) {
    const transaction = this.financeVar.getTransactions().find(t => t.id === id);
    if (!transaction) {
      this.goBack();
      return;
    }
    
    this.ignoreRateCalc = true; // 暫停自動算匯率

    this.txnType = transaction.type as any;
    this.selectedCategory = { name: transaction.category, icon: transaction.icon || '💰' };
    
    this.transactionForm.patchValue({
      amount: transaction.amount,
      currency: transaction.currency,
      accountId: transaction.accountId,
      accountToId: transaction.toAccountId || '',
      fundId: transaction.fundId || '',
      date: transaction.date,
      note: transaction.note || '',
      category: transaction.category,
      exchangeRate: transaction.exRate || 1
    });
    
    if (transaction.items && transaction.items.length > 0) {
      this.items = [...transaction.items];
    }
    this.categories = this.getCategories();
    
    // (注意：把原本放在這裡的 this.calculateExchangeRate() 刪除！)

    setTimeout(() => {
      this.ignoreRateCalc = false; // 恢復自動算匯率
      this.captureInitialFormValues();
    }, 100);
  }

  // Save last used account for this transaction type
  private saveLastAccount(accountId: string) {
    if (accountId) {
      localStorage.setItem(`lastAccount_${this.txnType}`, accountId);
    }
  }

  // Load last used account for this transaction type
  private loadLastAccount(): string | null {
    return localStorage.getItem(`lastAccount_${this.txnType}`);
  }

  // Override saveTransaction to include items and save last account
  async goToAutoUpload() {
    if (!this.hasApiKey) {
      // Show alert that API key is required
      const alert = await this.alertController.create({
        header: 'Gemini API Key Required',
        message: 'Please set your Gemini API key in Settings to use this feature.',
        buttons: ['OK']
      });
      await alert.present();
      return;
    }
    
    if (this.isModal && this.modalCtrl) {
      // If we're in modal mode, dismiss the modal first, then navigate
      await this.modalCtrl.dismiss({ navigateToAutoUpload: true });
      // The parent component should handle the navigation
    } else {
      // Regular navigation
      this.router.navigate(['/auto-upload-receipt']);
    }
  }
  
  prefillFormFromAITransaction(transaction: any) {
    if (!transaction) return;
    
    this.txnType = 'expense';
    
    // 直接使用共用的 EXPENSE_CATEGORIES 進行比對
    let selectedCategory = EXPENSE_CATEGORIES.find(cat => cat.name === transaction.category);
    if (!selectedCategory) {
      for (const cat of EXPENSE_CATEGORIES) {
        if (transaction.category?.includes(cat.name) || cat.name.includes(transaction.category)) {
          selectedCategory = cat;
          break;
        }
      }
      if (!selectedCategory) {
        selectedCategory = EXPENSE_CATEGORIES.find(cat => cat.name === '其他') || EXPENSE_CATEGORIES[0];
      }
    }
    
    this.selectedCategory = selectedCategory;
    
    const defaultAccountId = this.accounts.length > 0 ? this.accounts[0].id : '';
    const accountId = transaction.accountId || defaultAccountId;
    
    // 🔍 檢查 AI 辨識出的結果有沒有包含匯率欄位 (支援 exchangeRate 或 exRate 命名)
    const aiDetectedRate = transaction.exchangeRate || transaction.exRate;
    
    // Patch 表單資料
    this.transactionForm.patchValue({
      amount: transaction.amount || 0,
      currency: transaction.currency || 'HKD',
      accountId: accountId,
      date: transaction.date || this.getToday(),
      note: transaction.note || '',
      category: selectedCategory.name,
      // ✔️ 如果截圖有匯率就直接填入四位小數，沒有的話先預設為 1
      exchangeRate: aiDetectedRate ? Number(Number(aiDetectedRate).toFixed(6)) : 1 
    });
    
    if (transaction.items && transaction.items.length > 0) {
      this.items = [...transaction.items];
    }
    
    // ✔️ 防禦關鍵：如果 AI 從截圖中有辨識到實際匯率，就直接沿用，不再執行市場預設匯率計算
    if (!aiDetectedRate) {
      this.calculateExchangeRate();
    }
    
    setTimeout(() => {
      this.initialFormValues = this.transactionForm.getRawValue();
      this.isFormDirty = false;
    }, 0);
  }
  
  // Navigation methods for multiple AI transactions
  nextAITransaction() {
    if (!this.validateForm()) {
      this.alertController.create({ header: '資料不完整', message: '請填寫所有必填欄位後再進入下一張', buttons: ['確定'] }).then(a => a.present());
      return;
    }
  
    if (this.currentTransactionIndex < this.aiTransactions.length - 1) {
      this.syncFormToAITransaction(); // Save their current edits to the array
      this.currentTransactionIndex++;
      
      // Unlock the Save button if they reached the last receipt
      if (this.currentTransactionIndex === this.aiTransactions.length - 1) {
        this.hasViewedLastReceipt = true;
      }
      
      this.prefillFormFromAITransaction(this.aiTransactions[this.currentTransactionIndex]);
    }
  }
  
  previousAITransaction() {
    if (this.currentTransactionIndex > 0) {
      this.syncFormToAITransaction(); // Save their current edits to the array
      this.currentTransactionIndex--;
      this.prefillFormFromAITransaction(this.aiTransactions[this.currentTransactionIndex]);
    }
  }
  
  async saveTransaction() {
    this.updateValidationErrors();
    if (!this.validateForm()) {
      return;
    }
    
    const saveButton = document.querySelector('.save-transaction-btn');
    if (saveButton) {
      saveButton.setAttribute('disabled', 'true');
    }
    
    try {
      if (this.isAIScanningMode) {
        this.syncFormToAITransaction();
        
        for (let i = 0; i < this.aiTransactions.length; i++) {
          const aiTxn = this.aiTransactions[i];
          const amount = parseFloat(aiTxn.amount) || 0;
          
          // 🔍 批次寫入時同樣優先檢查該張收據/截圖有沒有 AI 辨識到的獨立匯率
          let finalExchangeRate = aiTxn.exchangeRate || aiTxn.exRate;
          
          if (!finalExchangeRate) {
            // 如果 AI 沒提供，才走市場真實匯率計算
            finalExchangeRate = 1;
            const account = this.financeVar.getAppData().accounts.find(a => a.id === aiTxn.accountId);
            if (account && aiTxn.currency !== account.currency) {
              const fromRate = this.realExchangeRates[aiTxn.currency] || 1;
              const toRate = this.realExchangeRates[account.currency] || 1;
              finalExchangeRate = toRate / fromRate;
            }
          }
          
          // 確保精準度四位小數
          finalExchangeRate = Number(Number(finalExchangeRate).toFixed(4));
          
          const transaction: Transaction = {
            id: `t_${Date.now()}_${i}`,
            type: 'expense',
            amount: amount,
            currency: aiTxn.currency,
            exRate: finalExchangeRate,
            accDeduction: amount * finalExchangeRate, // 正確扣除本幣金額
            accountId: aiTxn.accountId,
            category: aiTxn.category,
            icon: this.categories.find(c => c.name === aiTxn.category)?.icon || '💰',
            note: aiTxn.note,
            date: aiTxn.date,
            items: aiTxn.items ? [...aiTxn.items] : [],
            _warnLimit: false
          };
          
          this.financeService.executeAddTransaction(transaction);
        }
        
        this.transactionForm.markAsPristine();
        this.transactionForm.markAsUntouched();
        this.isFormDirty = false;
        this.initialFormValues = this.transactionForm.getRawValue();
        this.aiTransactions = [];
        this.isAIScanningMode = false;
        this.currentTransactionIndex = 0;
        
        const alert = await this.alertController.create({
          header: '全部儲存成功',
          message: '已成功儲存所有辨識收據與帳單！',
          buttons: ['確定']
        });
        await alert.present();
        await this.goBack();

      } else {
        // ... (手動儲存邏輯保持上一次更新完的內容，不需變動) ...
        const formValue = this.transactionForm.value;
        const amount = parseFloat(formValue.amount);
        const manualRate = parseFloat(formValue.exchangeRate) || 1;
        
        let accDeduction = 0;
        let toAccDeduction = undefined;
        
        if (this.txnType === 'transfer' && formValue.accountToId) {
            const fromAccount = this.financeVar.getAccounts().find(a => a.id === formValue.accountId);
            const toAccount = this.financeVar.getAccounts().find(a => a.id === formValue.accountToId);
            
            if (fromAccount && toAccount) {
                if (formValue.currency !== fromAccount.currency) {
                   accDeduction = amount * manualRate;
                } else {
                   accDeduction = amount;
                }
                if (formValue.currency !== toAccount.currency) {
                   toAccDeduction = -(amount * manualRate);
                } else {
                   toAccDeduction = -amount;
                }
            }
        } else {
            const account = this.financeVar.getAccounts().find(a => a.id === formValue.accountId);
            if (account && formValue.currency !== account.currency) {
                accDeduction = this.txnType === 'income' ? -(amount * manualRate) : (amount * manualRate);
            } else {
                accDeduction = this.txnType === 'income' ? -amount : amount;
            }
        }
        
        const transaction: Transaction = {
          id: this.isEditMode ? this.editTransactionId! : `t_${Date.now()}`,
          type: this.txnType,
          amount: amount,
          currency: formValue.currency,
          exRate: manualRate,
          accDeduction: accDeduction,
          toAccountId: this.txnType === 'transfer' ? formValue.accountToId : undefined,
          toAccDeduction: toAccDeduction, 
          accountId: formValue.accountId,
          category: this.selectedCategory?.name || formValue.category,
          icon: this.selectedCategory?.icon || '💰',
          note: formValue.note,
          date: formValue.date,
          fundId: this.txnType === 'expense' ? formValue.fundId || undefined : undefined,
          _warnLimit: false
        };
        
        if (this.txnType === 'expense' && this.items.length > 0) {
          transaction.items = [...this.items];
        }
        
        if (this.isEditMode) {
          this.financeVar.updateTransaction(this.editTransactionId!, transaction);
        } else {
          this.financeService.executeAddTransaction(transaction);
        }
        
        this.saveLastAccount(formValue.accountId);
        this.transactionForm.markAsPristine();
        this.transactionForm.markAsUntouched();
        this.isFormDirty = false;
        this.initialFormValues = this.transactionForm.getRawValue();
        await this.goBack();
      }
    } catch (error) {
      console.error('Error saving transaction:', error);
      if (saveButton) saveButton.removeAttribute('disabled');
    }
  }

  get availableAccounts() {
    const allAccounts = this.financeVar.getAccounts();
    
    if (this.txnType === 'expense') {
      return allAccounts.filter(acc => {
        if (acc.type === 'loan') return false;
        if (acc.type === 'transit' && !acc.autoTopUp) {
          const currentBal = this.getAccBalance(acc.id);
          let buyingPower = currentBal;
          if (acc.allowNegative) {
            // 如果只能負1次且已是負數，購買力就是 0
            buyingPower = (acc.negativeMode === 'once' && currentBal < 0) ? 0 : currentBal + (acc.negativeLimit || 0);
          }
          // 如果購買力已經沒了 (<=0)，連選都不給選
          if (buyingPower <= 0) return false;
        }
        return true;
      });
    }
    
    if (this.txnType === 'income') {
      return allAccounts.filter(acc => acc.type !== 'loan');
    }
    
    return allAccounts;
  }

  setupTypeSubscription() {
    this.transactionForm.get('type')?.valueChanges.subscribe(type => {
      if (type === 'expense' || type === 'income') {
        const currentAccId = this.transactionForm.get('accountId')?.value;
        const currentAcc = this.financeVar.getAccounts().find(a => a.id === currentAccId);
        
        // 如果切換到收入/支出時，發現主帳戶選的是借款帳戶，則清空選擇
        if (currentAcc && currentAcc.type === 'loan') {
          this.transactionForm.get('accountId')?.setValue('');
        }
      }
    });
  }
}