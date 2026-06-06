import { Component, OnInit, Optional } from '@angular/core';
import { ActivatedRoute, NavigationEnd, Router } from '@angular/router';
import { FormBuilder, FormGroup, Validators, FormArray } from '@angular/forms';
import { FinanceVarService } from '../../service/finance-var.service';
import { FinanceService } from '../../service/finance.service';
import { Transaction, Account, Fund, SplitShare } from '../../model/finance.model';
import { AlertController, ModalController, NavParams, ToastController, Platform } from '@ionic/angular';
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
  categories: any[] = [];

  // Calculator custom number pad state
  showNumPad = false;
  amountExpression = '';
  isMobile = false;
  isIos = false;

  // Performance caching and guard variables
  ignoreTypeChange = false;
  categoryCountsCache: { [type: string]: { [categoryName: string]: number } } = {};
  referencableTxnsRemainingBalances: { [txId: string]: number } = {};
  referencableTxnsAlreadyRepaidBalances: { [txId: string]: number } = {};
  
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

  // Custom Date Picker state variables
  isDatePickerOpen = false;
  pickerActiveMonth!: moment.Moment;
  calendarWeeks: any[][] = [];

  constructor(
    private route: ActivatedRoute,
    private router: Router,
    private fb: FormBuilder,
    private financeVar: FinanceVarService,
    private financeService: FinanceService,
    private modalCtrl: ModalController,
    private alertController: AlertController,
    private toastCtrl: ToastController,
    private platform: Platform,
    @Optional() private navParams: NavParams
  ) {
    this.isModal = !!this.navParams && !!this.navParams.data;
  }

  ngOnInit() {
    this.isMobile = this.platform.is('mobile') || this.platform.is('capacitor') || this.platform.is('cordova');
    this.isIos = this.platform.is('ios');
    this.initForm();
    this.fetchRealRates();
    this.initFriendSplits();
    this.setupTypeSubscription();
    this.loadContextFromRoute();      

    // Initialize custom date picker active month and calendar grid
    const currentDate = this.transactionForm?.get('date')?.value || this.getToday();
    this.pickerActiveMonth = moment(currentDate, 'YYYY-MM-DD');
    this.generateCalendar();

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
    if (this.financeVar.isRatesFresh()) {
      this.realExchangeRates = { ...this.financeVar.getExchangeRates() };
      if (!this.isEditMode) {
        this.calculateExchangeRate();
      }
      return;
    }

    try {
      const response = await fetch('https://open.er-api.com/v6/latest/HKD');
      const data = await response.json();
      if (data && data.rates) {
        const newRates = {
          HKD: 1,
          JPY: data.rates.JPY
        };
        this.financeVar.setExchangeRates(newRates);
        this.realExchangeRates = { ...this.financeVar.getExchangeRates() };
        
        // 如果是新增模式，且還沒填寫過資料，則刷新匯率
        if (!this.isEditMode) {
           this.calculateExchangeRate();
        }
      }
    } catch (e) {
      console.error('無法獲取即時匯率，將使用預設或快取值', e);
      this.realExchangeRates = { ...this.financeVar.getExchangeRates() };
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
      allocations: this.fb.array([]),
      isSplitPay: [false],
      splitOthersShare: [''],
      splitLoanAccountId: ['']
    });
  }

  loadContextFromRoute() {
    let id = null;
    let viewedMonth = null;
    let isCopyMode = false;
    
    if (this.isModal) {
      id = this.navParams?.get('id') || this.navParams?.get('transactionId');
      this.contextAccountId = this.navParams?.get('accountId');
      this.contextFundId = this.navParams?.get('fundId');
      this.contextType = this.navParams?.get('context');
      viewedMonth = this.navParams?.get('viewedMonth');
      isCopyMode = this.navParams?.get('isCopyMode') || false;
    }
    
    if (!id && this.route && this.route.snapshot) {
      id = this.route.snapshot.queryParamMap?.get('id');
      if (!this.contextAccountId) this.contextAccountId = this.route.snapshot.queryParamMap?.get('accountId');
      if (!this.contextFundId) this.contextFundId = this.route.snapshot.queryParamMap?.get('fundId');
      if (!this.contextType) this.contextType = this.route.snapshot.queryParamMap?.get('context');
      if (!viewedMonth) viewedMonth = this.route.snapshot.queryParamMap?.get('viewedMonth');
      isCopyMode = this.route.snapshot.queryParamMap?.get('isCopyMode') === 'true';
    }
    
    if (id) {
      if (isCopyMode) {
        this.isEditMode = false;
        this.editTransactionId = undefined;
        this.loadTransactionForEdit(id);
      } else {
        this.isEditMode = true;
        this.editTransactionId = id;
        this.loadTransactionForEdit(id);
      }
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

      // Default date parsing logic: if viewedMonth is not the current month, default date to the last day of that viewed month.
      let defaultDate = this.getToday();
      if (viewedMonth && viewedMonth !== moment().format('YYYY-MM')) {
        defaultDate = moment(viewedMonth, 'YYYY-MM').endOf('month').format('YYYY-MM-DD');
      }
      this.transactionForm.patchValue({ date: defaultDate });
    }
  }

  setupFormListeners() {
    this.transactionForm.get('currency')?.valueChanges.subscribe(() => {
      if (!this.ignoreRateCalc) this.calculateExchangeRate();
      this.checkFormDirty();
    });
    
    this.transactionForm.get('accountId')?.valueChanges.subscribe(() => {
      if (!this.ignoreRateCalc) this.calculateExchangeRate();
      this.loadReferencableTxns();
      this.checkFormDirty();
    });

    this.transactionForm.get('accountToId')?.valueChanges.subscribe(() => {
      if (!this.ignoreRateCalc) this.calculateExchangeRate();
      this.loadReferencableTxns();
      this.checkFormDirty();
    });
    
    this.transactionForm.get('amount')?.valueChanges.subscribe((val) => {
      this.updateCalculatedAmount();
      this.calculateSplitShares();
      this.checkFormDirty();

      // Sync to amountExpression if updated externally (like edit load or AI scans)
      if (val === '' || val === null || val === undefined) {
        if (this.amountExpression !== '') {
          this.amountExpression = '';
        }
        return;
      }
      const numVal = parseFloat(val);
      const currentEval = this.evaluateExpression(this.amountExpression);
      if (!isNaN(numVal) && numVal !== currentEval) {
        this.amountExpression = numVal.toString();
      }
    });

    this.transactionForm.get('isSplitPay')?.valueChanges.subscribe(() => {
      this.calculateSplitShares();
      this.checkFormDirty();
    });

    this.transactionForm.get('splitOthersShare')?.valueChanges.subscribe(() => {
      this.calculateSplitShares();
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
    if (!this.transactionForm) return;
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
    this.showNumPad = false;
    if (this.ignoreTypeChange) {
      return;
    }
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
    this.showNumPad = false;
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

  precomputeCategoryCounts() {
    const allTransactions = this.financeVar.getTransactions();
    this.categoryCountsCache = { expense: {}, income: {} };
    allTransactions.forEach(txn => {
      if (txn.category) {
        const type = txn.type;
        if (type === 'expense' || type === 'income') {
          if (!this.categoryCountsCache[type]) {
            this.categoryCountsCache[type] = {};
          }
          this.categoryCountsCache[type][txn.category] = (this.categoryCountsCache[type][txn.category] || 0) + 1;
        }
      }
    });
  }

  getCategories() {
    if (!this.categoryCountsCache || Object.keys(this.categoryCountsCache).length === 0) {
      this.precomputeCategoryCounts();
    }
    if (this.txnType === 'income') {
      return this.sortCategoriesByFrequency(this.financeVar.getAllIncomeCategories());
    } else if (this.txnType === 'expense') {
      return this.sortCategoriesByFrequency(this.financeVar.getAllExpenseCategories());
    } else {
      return [{ id: 'transfer', name: '轉帳', icon: '🔀' }];
    }
  }

  private sortCategoriesByFrequency(categories: any[]): any[] {
    const counts = this.categoryCountsCache[this.txnType] || {};
    return [...categories].sort((a, b) => {
      const countA = counts[a.name] || 0;
      const countB = counts[b.name] || 0;
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
    this.showNumPad = false;
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
  async goBack(savedData?: any) {
    if (savedData) {
      this.performGoBack(savedData);
      return;
    }

    // Handle AI scanning mode - show confirmation before going back
    if (this.isAIScanningMode) {
      const alert = await this.alertController.create({
        header: '取消全部掃描',
        message: '確定要取消並捨棄所有尚未儲存的收據紀錄嗎？已輸入的資料將會遺失。',
        buttons: [
          {
            text: '繼續檢視',
            role: 'cancel',
            cssClass: 'secondary'
          },
          {
            text: '捨棄全部',
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
  
  private async performGoBack(savedData?: any) {
    // Handle modal mode
    if (this.isModal && this.modalCtrl) {
      await this.modalCtrl.dismiss(savedData);
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

  evaluateExpression(expr: string): number {
    if (!expr) return 0;
    const cleanExpr = expr.replace(/\s+/g, '');
    if (!cleanExpr) return 0;

    try {
      // Standard mathematical expression tokenizer
      const tokens: string[] = [];
      let currentToken = '';
      
      for (let i = 0; i < cleanExpr.length; i++) {
        const char = cleanExpr[i];
        if (/[0-9.]/.test(char)) {
          currentToken += char;
        } else if (/[\+\-\*/]/.test(char)) {
          if (currentToken) {
            tokens.push(currentToken);
            currentToken = '';
          }
          tokens.push(char);
        }
      }
      if (currentToken) {
        tokens.push(currentToken);
      }

      if (tokens.length === 0) return 0;

      // Filter out trailing operators to prevent errors (e.g. "10 + " -> tokens is ["10", "+"])
      while (tokens.length > 0 && /[\+\-\*/]/.test(tokens[tokens.length - 1])) {
        tokens.pop();
      }

      if (tokens.length === 0) return 0;

      // First pass: handle multiplication and division
      const firstPassTokens: string[] = [];
      let i = 0;
      while (i < tokens.length) {
        const token = tokens[i];
        if (token === '*' || token === '/') {
          const prev = firstPassTokens.pop() || '0';
          const prevVal = parseFloat(prev);
          const nextVal = parseFloat(tokens[i + 1] || '1');
          if (token === '*') {
            firstPassTokens.push((prevVal * nextVal).toString());
          } else {
            firstPassTokens.push((nextVal !== 0 ? prevVal / nextVal : 0).toString());
          }
          i += 2;
        } else {
          firstPassTokens.push(token);
          i++;
        }
      }

      // Second pass: handle addition and subtraction
      if (firstPassTokens.length === 0) return 0;
      let result = parseFloat(firstPassTokens[0]) || 0;
      let j = 1;
      while (j < firstPassTokens.length) {
        const op = firstPassTokens[j];
        const nextVal = parseFloat(firstPassTokens[j + 1] || '0');
        if (op === '+') {
          result += nextVal;
        } else if (op === '-') {
          result -= nextVal;
        }
        j += 2;
      }

      return isNaN(result) ? 0 : parseFloat(result.toFixed(4));
    } catch (e) {
      console.error('Error evaluating expression:', e);
      return 0;
    }
  }

  onKeyPress(key: string) {
    if (key === 'C') {
      this.amountExpression = '';
    } else if (key === 'backspace' || key === '⌫') {
      if (this.amountExpression.length > 0) {
        this.amountExpression = this.amountExpression.substring(0, this.amountExpression.length - 1);
      }
    } else if (key === '=') {
      const result = this.evaluateExpression(this.amountExpression);
      this.amountExpression = result > 0 ? result.toString() : '';
    } else if (key === 'done' || key === 'Done') {
      const result = this.evaluateExpression(this.amountExpression);
      this.amountExpression = result > 0 ? result.toString() : '';
      this.showNumPad = false;
    } else {
      const isOperator = /[\+\-\*/]/.test(key);
      const lastChar = this.amountExpression.slice(-1);
      const isLastCharOperator = /[\+\-\*/]/.test(lastChar);
      
      // Prevent starting with operators other than minus
      if (this.amountExpression === '' && isOperator && key !== '-') {
        return;
      }

      // Prevent consecutive operators (replace old operator with new one)
      if (isOperator && isLastCharOperator) {
        this.amountExpression = this.amountExpression.slice(0, -1) + key;
        this.onExpressionChange();
        return;
      }

      // Prevent consecutive decimals (e.g. 10..5)
      if (key === '.') {
        const parts = this.amountExpression.split(/[\+\-\*/]/);
        const lastTerm = parts[parts.length - 1];
        if (lastTerm.includes('.')) {
          return;
        }
      }

      this.amountExpression += key;
    }

    this.onExpressionChange();
  }

  onExpressionChange() {
    const evaluated = this.evaluateExpression(this.amountExpression);
    if (evaluated > 0) {
      this.transactionForm.get('amount')?.setValue(evaluated, { emitEvent: true });
    } else {
      this.transactionForm.get('amount')?.setValue('', { emitEvent: true });
    }
  }

  hasOperators(expr: string): boolean {
    if (!expr) return false;
    return /[\+\-\*/]/.test(expr);
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
    this.ignoreTypeChange = true; // 避免切換 txnType 時清空已載入的 category

    this.txnType = transaction.type as any;
    this.categories = this.getCategories();
    
    const matchedCategory = this.categories.find(c => c.name === transaction.category);
    if (matchedCategory) {
      this.selectedCategory = matchedCategory;
    } else {
      this.selectedCategory = { id: transaction.category, name: transaction.category, icon: transaction.icon || '💰' };
    }
    
    const isSplit = !!transaction.isSplitPay;
    const totalAmount = isSplit ? (transaction.amount + (transaction.splitOthersShare || 0)) : transaction.amount;
    
    this.transactionForm.patchValue({
      amount: totalAmount,
      currency: transaction.currency,
      accountId: transaction.accountId,
      accountToId: transaction.toAccountId || '',
      fundId: transaction.fundId || '',
      date: transaction.date,
      note: transaction.note || '',
      category: transaction.category,
      exchangeRate: transaction.exRate || 1,
      isSplitPay: isSplit,
      splitOthersShare: transaction.splitOthersShare || '',
      splitLoanAccountId: transaction.splitLoanAccountId || ''
    });
    
    this.initFriendSplits();
    if (isSplit) {
      if (transaction.splitShares && transaction.splitShares.length > 0) {
        this.friendSplits.forEach(fs => {
          const found = transaction.splitShares!.find(s => s.loanAccountId === fs.accountId);
          if (found) {
            fs.selected = true;
            fs.amount = found.amount;
          } else {
            fs.selected = false;
            fs.amount = 0;
          }
        });
      } else if (transaction.splitLoanAccountId && transaction.splitOthersShare) {
        this.friendSplits.forEach(fs => {
          if (fs.accountId === transaction.splitLoanAccountId) {
            fs.selected = true;
            fs.amount = transaction.splitOthersShare!;
          } else {
            fs.selected = false;
            fs.amount = 0;
          }
        });
      }
      this.calculateSplitShares();
    }

    if (transaction.type === 'transfer' && transaction.referencedTransactionIds) {
      this.selectedReferenceTxIds = {};
      transaction.referencedTransactionIds.forEach(id => {
        this.selectedReferenceTxIds[id] = true;
      });
    } else {
      this.selectedReferenceTxIds = {};
    }
    this.loadReferencableTxns();
    
    if (transaction.items && transaction.items.length > 0) {
      this.items = [...transaction.items];
    }
    
    // (注意：把原本放在這裡的 this.calculateExchangeRate() 刪除！)

    setTimeout(() => {
      this.ignoreRateCalc = false; // 恢復自動算匯率
      this.ignoreTypeChange = false; // 恢復自動切換 txnType
      this.captureInitialFormValues();
    }, 100);
  }

  async copyTransaction() {
    this.editTransactionId = undefined;
    this.isEditMode = false;
    
    const toast = await this.toastCtrl.create({
      message: '✅ 已複製此交易至新增模式',
      duration: 2000,
      position: 'top',
      color: 'success'
    });
    await toast.present();
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
    const allExpCats = this.financeVar.getAllExpenseCategories();
    let selectedCategory = allExpCats.find(cat => cat.name === transaction.category);
    
    if (!selectedCategory) {
      for (const cat of allExpCats) {
        if (transaction.category?.includes(cat.name) || cat.name.includes(transaction.category)) {
          selectedCategory = cat;
          break;
        }
      }
      if (!selectedCategory) {
        selectedCategory = allExpCats.find(cat => cat.name === '其他') || allExpCats[0];
      }
    }
    
    this.selectedCategory = selectedCategory;
    
    const defaultAccountId = this.accounts.length > 0 ? this.accounts[0].id : '';
    const accountId = transaction.accountId || defaultAccountId;
    
    // 🔍 檢查 AI 辨識出的結果有沒有包含匯率欄位 (支援 exchangeRate 或 exRate 命名)
    const aiDetectedRate = transaction.exchangeRate || transaction.exRate;
    
    const isSplit = !!transaction.isSplitPay;
    
    // Patch 表單資料
    this.transactionForm.patchValue({
      amount: transaction.amount || 0,
      currency: transaction.currency || 'HKD',
      accountId: accountId,
      date: transaction.date || this.getToday(),
      note: transaction.note || '',
      category: selectedCategory.name,
      // ✔️ 如果截圖有匯率就直接填入四位小數，沒有的話先預設為 1
      exchangeRate: aiDetectedRate ? Number(Number(aiDetectedRate).toFixed(6)) : 1,
      isSplitPay: isSplit
    });
    
    if (transaction.items && transaction.items.length > 0) {
      this.items = [...transaction.items];
    }

    this.initFriendSplits();
    if (isSplit && transaction.splitShares && transaction.splitShares.length > 0) {
      transaction.splitShares.forEach((share: any) => {
        const name = share.name.trim();
        if (!name) return;

        const existing = this.friendSplits.find(fs => fs.accountName.toLowerCase() === name.toLowerCase());
        if (existing) {
          existing.selected = true;
          existing.amount = share.amount;
        } else {
          const tempId = `loan_${Date.now()}_${Math.floor(Math.random() * 1000)}`;
          this.friendSplits.push({
            accountId: tempId,
            accountName: name,
            amount: share.amount,
            selected: true,
            isNew: true
          });
        }
      });
      this.onFriendSplitChange();
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
    this.updateValidationErrors();
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
      this.updateValidationErrors();
    }
  }
  
  previousAITransaction() {
    if (this.currentTransactionIndex > 0) {
      this.syncFormToAITransaction(); 
      this.currentTransactionIndex--;
      this.prefillFormFromAITransaction(this.aiTransactions[this.currentTransactionIndex]);
      this.updateValidationErrors(); // 換頁後檢查新頁面有沒有錯
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
        

        const batchValidation = this.checkBatchValidation();
        if (batchValidation !== null) {
            // 如果驗證失敗，自動把畫面跳轉到有問題的那一張，並顯示錯誤
            this.currentTransactionIndex = batchValidation.index;
            this.prefillFormFromAITransaction(this.aiTransactions[this.currentTransactionIndex]);
            this.currentErrors = batchValidation.errors; 
            
            if (saveButton) saveButton.removeAttribute('disabled');
            
            const alert = await this.alertController.create({
                header: '資料有誤',
                message: `第 ${batchValidation.index + 1} 筆收據的資料不符合儲存條件 (如餘額不足)，請檢查畫面的紅字提示並修正。`,
                buttons: ['確定']
            });
            await alert.present();
            return; // 中止儲存程序，讓用戶自己修
        }

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
        await this.goBack({ success: true });

      } else {
        const formValue = this.transactionForm.value;
        const amount = parseFloat(formValue.amount);
        const manualRate = parseFloat(formValue.exchangeRate) || 1;
        let savedTransactionToReturn: any = null;
        
        if (this.txnType === 'expense' && formValue.isSplitPay) {
          const selectedSplits = this.friendSplits.filter(fs => fs.selected && (parseFloat(fs.amount as any) || 0) > 0);
          
          let finalOthersShare = 0;
          let finalMyShare = amount;
          const splitSharesToSave: SplitShare[] = [];
          const linkedTxIds: string[] = [];

          if (selectedSplits.length > 0) {
            // Create accounts for newly added friends before generating transactions
            selectedSplits.forEach(fs => {
              if (fs.isNew) {
                const newAccount: Account = {
                  id: fs.accountId,
                  name: fs.accountName,
                  type: 'loan',
                  currency: formValue.currency || 'HKD',
                  initBalance: 0
                };
                this.financeVar.addAccount(newAccount);
                delete fs.isNew;
              }
            });

            finalOthersShare = selectedSplits.reduce((sum, fs) => sum + (parseFloat(fs.amount as any) || 0), 0);
            finalMyShare = Math.max(0, amount - finalOthersShare);
            selectedSplits.forEach(fs => {
              splitSharesToSave.push({
                loanAccountId: fs.accountId,
                amount: parseFloat(fs.amount as any) || 0
              });
            });
          } else if (formValue.splitLoanAccountId && formValue.splitOthersShare) {
            // Single friend split fallback
            finalOthersShare = parseFloat(formValue.splitOthersShare) || 0;
            finalMyShare = Math.max(0, amount - finalOthersShare);
            splitSharesToSave.push({
              loanAccountId: formValue.splitLoanAccountId,
              amount: finalOthersShare
            });
          }

          if (this.isEditMode) {
            // Clean up previous associated transfers to avoid duplicates
            const oldTx = this.financeVar.getTransactions().find(t => t.id === this.editTransactionId);
            if (oldTx) {
              const idsToDelete = new Set<string>();
              if (oldTx.linkedTransactionId) idsToDelete.add(oldTx.linkedTransactionId);
              if (oldTx.linkedTransactionIds) oldTx.linkedTransactionIds.forEach(id => idsToDelete.add(id));
              if (idsToDelete.size > 0) {
                const cleanTxns = this.financeVar.getTransactions().filter(t => !idsToDelete.has(t.id));
                this.financeVar.updateAppData({ transactions: cleanTxns });
              }
            }
          }

          const baseId = Date.now();
          const expenseId = this.isEditMode ? this.editTransactionId! : `t_exp_${baseId}`;
          const account = this.financeVar.getAccounts().find(a => a.id === formValue.accountId);
          
          let expenseDeduction = finalMyShare;
          if (account && formValue.currency !== account.currency) {
            expenseDeduction = finalMyShare * manualRate;
          }

          // Create the multiple associated transfer transactions
          const transferTxns: Transaction[] = [];
          splitSharesToSave.forEach((share, idx) => {
            const transferId = `t_trf_${baseId}_${idx}`;
            linkedTxIds.push(transferId);

            let transDeduction = share.amount;
            let toTransDeduction = -share.amount;
            const toAccount = this.financeVar.getAccounts().find(a => a.id === share.loanAccountId);
            
            if (account && formValue.currency !== account.currency) {
              transDeduction = share.amount * manualRate;
            }
            if (toAccount && formValue.currency !== toAccount.currency) {
              toTransDeduction = -(share.amount * manualRate);
            }

            const transferTxn: Transaction = {
              id: transferId,
              type: 'transfer',
              amount: share.amount,
              currency: formValue.currency,
              exRate: manualRate,
              accDeduction: transDeduction,
              accountId: formValue.accountId,
              toAccountId: share.loanAccountId,
              toAccDeduction: toTransDeduction,
              note: `${formValue.note || ''} (他人代付/借款 - ${toAccount?.name || '朋友'})`,
              date: formValue.date,
              linkedTransactionId: expenseId,
              _warnLimit: false
            };
            transferTxns.push(transferTxn);
          });

          // Create the main expense transaction
          const expenseTxn: Transaction = {
            id: expenseId,
            type: 'expense',
            amount: finalMyShare,
            currency: formValue.currency,
            exRate: manualRate,
            accDeduction: expenseDeduction,
            accountId: formValue.accountId,
            category: this.selectedCategory?.name || formValue.category,
            icon: this.selectedCategory?.icon || '💰',
            note: formValue.note,
            date: formValue.date,
            fundId: formValue.fundId || undefined,
            isSplitPay: true,
            splitMyShare: finalMyShare,
            splitOthersShare: finalOthersShare,
            splitLoanAccountId: splitSharesToSave.length === 1 ? splitSharesToSave[0].loanAccountId : undefined,
            splitShares: splitSharesToSave,
            linkedTransactionId: transferTxns.length === 1 ? transferTxns[0].id : undefined,
            linkedTransactionIds: linkedTxIds,
            _warnLimit: false
          };
          if (this.items.length > 0) {
            expenseTxn.items = [...this.items];
          }

          if (this.isEditMode) {
            this.financeVar.updateTransaction(this.editTransactionId!, expenseTxn);
            transferTxns.forEach(tx => this.financeVar.addTransaction(tx));
          } else {
            this.financeService.executeAddTransaction(expenseTxn);
            transferTxns.forEach(tx => this.financeService.executeAddTransaction(tx));
          }
          savedTransactionToReturn = expenseTxn;

        } else {
          if (this.isEditMode) {
            // Delete old linked transfers if we toggled splitPay to false
            const oldTx = this.financeVar.getTransactions().find(t => t.id === this.editTransactionId);
            if (oldTx) {
              const idsToDelete = new Set<string>();
              if (oldTx.linkedTransactionId) idsToDelete.add(oldTx.linkedTransactionId);
              if (oldTx.linkedTransactionIds) oldTx.linkedTransactionIds.forEach(id => idsToDelete.add(id));
              if (idsToDelete.size > 0) {
                const cleanTxns = this.financeVar.getTransactions().filter(t => !idsToDelete.has(t.id));
                this.financeVar.updateAppData({ transactions: cleanTxns });
              }
            }
          }

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
          
          const referencedIds = Object.keys(this.selectedReferenceTxIds).filter(id => this.selectedReferenceTxIds[id]);

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
            referencedTransactionIds: this.txnType === 'transfer' && referencedIds.length > 0 ? referencedIds : undefined,
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
          savedTransactionToReturn = transaction;
        }
        
        this.saveLastAccount(formValue.accountId);
        this.transactionForm.markAsPristine();
        this.transactionForm.markAsUntouched();
        this.isFormDirty = false;
        this.initialFormValues = this.transactionForm.getRawValue();
        await this.goBack({ success: true, transaction: savedTransactionToReturn });
      }
    } catch (error) {
      console.error('Error saving transaction:', error);
      if (saveButton) saveButton.removeAttribute('disabled');
    }
  }

  mySplitShare = 0;
  friendSplits: { accountId: string; accountName: string; amount: number; selected: boolean; isNew?: boolean }[] = [];
  referencableTxns: Transaction[] = [];
  selectedReferenceTxIds: { [txId: string]: boolean } = {};
  newFriendName = '';

  addNewFriend() {
    this.showNumPad = false;
    const name = this.newFriendName.trim();
    if (!name) return;

    const existsInSplits = this.friendSplits.some(fs => fs.accountName.toLowerCase() === name.toLowerCase());
    const existsInAccounts = this.financeVar.getAccounts().some(a => a.name.toLowerCase() === name.toLowerCase() && a.type === 'loan');

    if (existsInSplits || existsInAccounts) {
      const found = this.friendSplits.find(fs => fs.accountName.toLowerCase() === name.toLowerCase());
      if (found) {
        found.selected = true;
        this.newFriendName = '';
        this.onFriendSplitChange();
      }
      return;
    }

    const tempId = `loan_${Date.now()}_${Math.floor(Math.random() * 1000)}`;
    this.friendSplits.push({
      accountId: tempId,
      accountName: name,
      amount: 0,
      selected: true,
      isNew: true
    });

    this.newFriendName = '';
    this.onFriendSplitChange();
  }

  initFriendSplits() {
    const loanAccounts = this.financeVar.getAccounts().filter(a => a.type === 'loan');
    this.friendSplits = loanAccounts.map(a => ({
      accountId: a.id,
      accountName: a.name,
      amount: 0,
      selected: false
    }));
  }

  onFriendSplitChange() {
    const othersShare = this.friendSplits
      .filter(fs => fs.selected)
      .reduce((sum, fs) => sum + (parseFloat(fs.amount as any) || 0), 0);
    
    this.transactionForm.patchValue({
      splitOthersShare: othersShare
    }, { emitEvent: false });

    this.calculateSplitShares();
    this.checkFormDirty();
  }

  getRemainingBalance(tx: Transaction, loanAccId: string | null): number {
    if (!loanAccId) return 0;
    if (this.referencableTxnsRemainingBalances[tx.id] !== undefined) {
      return this.referencableTxnsRemainingBalances[tx.id];
    }
    const originalAmount = this.getSplitAmountForAccount(tx, loanAccId);
    if (originalAmount <= 0) return 0;

    let totalRepaid = 0;
    const allTxns = this.financeVar.getTransactions();

    allTxns.forEach(t => {
      if (this.isEditMode && t.id === this.editTransactionId) return;

      if (t.type === 'transfer' && t.referencedTransactionIds && t.referencedTransactionIds.includes(tx.id)) {
        // ONLY count transfers that involve this specific friend's loan account!
        if (t.accountId !== loanAccId && t.toAccountId !== loanAccId) {
          return;
        }

        const referencedTxns = allTxns.filter(refTx => t.referencedTransactionIds!.includes(refTx.id));
        const sumShares = referencedTxns.reduce((sum, refTx) => sum + this.getSplitAmountForAccount(refTx, loanAccId), 0);

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

  getAlreadyRepaidAmount(tx: Transaction): number {
    const loanAccId = this.getSelectedLoanAccountId();
    if (!loanAccId) return 0;
    if (this.referencableTxnsAlreadyRepaidBalances[tx.id] !== undefined) {
      return this.referencableTxnsAlreadyRepaidBalances[tx.id];
    }
    const original = this.getSplitAmountForAccount(tx, loanAccId);
    const remaining = this.getRemainingBalance(tx, loanAccId);
    return Math.max(0, original - remaining);
  }

  loadReferencableTxns() {
    const loanAccId = this.getSelectedLoanAccountId();
    if (!loanAccId) {
      this.referencableTxns = [];
      this.referencableTxnsRemainingBalances = {};
      this.referencableTxnsAlreadyRepaidBalances = {};
      return;
    }

    const allTxns = this.financeVar.getTransactions();
    
    // First, map the original split amount for each transaction for the active loan account
    const originalAmounts: { [txId: string]: number } = {};
    const repaidAmounts: { [txId: string]: number } = {};
    
    allTxns.forEach(tx => {
      if (tx.type === 'expense' && tx.isSplitPay) {
        originalAmounts[tx.id] = this.getSplitAmountForAccount(tx, loanAccId);
        repaidAmounts[tx.id] = 0;
      }
    });

    // Now, let's find all repayments (type === 'transfer' with referencedTransactionIds) and aggregate them
    allTxns.forEach(t => {
      if (this.isEditMode && t.id === this.editTransactionId) return;

      if (t.type === 'transfer' && t.referencedTransactionIds && t.referencedTransactionIds.length > 0) {
        // ONLY count transfers that involve this specific friend's loan account!
        if (t.accountId !== loanAccId && t.toAccountId !== loanAccId) {
          return;
        }

        // We need the sum of original shares for the referenced transactions
        const referencedTxns = allTxns.filter(refTx => t.referencedTransactionIds!.includes(refTx.id));
        const sumShares = referencedTxns.reduce((sum, refTx) => {
          return sum + this.getSplitAmountForAccount(refTx, loanAccId);
        }, 0);

        t.referencedTransactionIds.forEach(refId => {
          const originalAmount = originalAmounts[refId] || 0;
          if (originalAmount <= 0) return;

          if (sumShares > 0) {
            const allocation = t.amount * (originalAmount / sumShares);
            repaidAmounts[refId] = (repaidAmounts[refId] || 0) + allocation;
          } else {
            repaidAmounts[refId] = (repaidAmounts[refId] || 0) + t.amount;
          }
        });
      }
    });

    // Write to cache maps
    this.referencableTxnsRemainingBalances = {};
    this.referencableTxnsAlreadyRepaidBalances = {};
    
    allTxns.forEach(tx => {
      if (tx.type === 'expense' && tx.isSplitPay) {
        const original = originalAmounts[tx.id] || 0;
        const repaid = repaidAmounts[tx.id] || 0;
        const remaining = Math.max(0, original - repaid);
        this.referencableTxnsRemainingBalances[tx.id] = remaining;
        this.referencableTxnsAlreadyRepaidBalances[tx.id] = Math.max(0, original - remaining);
      }
    });

    this.referencableTxns = allTxns.filter(t => {
      if (t.type !== 'expense' || !t.isSplitPay) return false;
      const isLinked = (t.splitLoanAccountId === loanAccId) || 
                       (t.splitShares && t.splitShares.some(s => s.loanAccountId === loanAccId));
      if (!isLinked) return false;

      const remaining = this.getRemainingBalance(t, loanAccId);
      const isCurrentlySelected = this.isEditMode && this.selectedReferenceTxIds[t.id];
      if (isCurrentlySelected) return true;

      return remaining > 0.01;
    });
  }

  getSelectedLoanAccountId(): string | null {
    const fromId = this.transactionForm?.get('accountId')?.value;
    const toId = this.transactionForm?.get('accountToId')?.value;
    const allAccs = this.financeVar.getAccounts();
    
    const fromAcc = allAccs.find(a => a.id === fromId);
    if (fromAcc && fromAcc.type === 'loan') return fromId;
    
    const toAcc = allAccs.find(a => a.id === toId);
    if (toAcc && toAcc.type === 'loan') return toId;
    
    return null;
  }

  getSplitAmountForAccount(tx: Transaction, accountId: string | null): number {
    if (!accountId) return 0;
    if (tx.splitLoanAccountId === accountId) {
      return tx.splitOthersShare || 0;
    }
    if (tx.splitShares) {
      const share = tx.splitShares.find(s => s.loanAccountId === accountId);
      return share ? share.amount : 0;
    }
    return 0;
  }

  suggestSettlementAmount() {
    let sum = 0;
    const loanAccId = this.getSelectedLoanAccountId();
    if (!loanAccId) return;

    this.referencableTxns.forEach(tx => {
      if (this.selectedReferenceTxIds[tx.id]) {
        sum += this.getRemainingBalance(tx, loanAccId);
      }
    });

    if (sum > 0) {
      this.transactionForm.patchValue({ amount: sum });
    }
  }

  getLoanAccounts(): Account[] {
    return this.financeVar.getAccounts().filter(a => a.type === 'loan');
  }

  calculateSplitShares() {
    const totalAmount = parseFloat(this.transactionForm.get('amount')?.value) || 0;
    const othersShare = parseFloat(this.transactionForm.get('splitOthersShare')?.value) || 0;
    this.mySplitShare = Math.max(0, totalAmount - othersShare);
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

  async removeCurrentAITransaction() {
    const alert = await this.alertController.create({
      header: '確認移除',
      message: `確定要捨棄第 ${this.currentTransactionIndex + 1} 筆收據的掃描紀錄嗎？`,
      buttons: [
        { text: '保留', role: 'cancel' },
        { 
          text: '捨棄', 
          role: 'destructive',
          handler: () => {
            this.aiTransactions.splice(this.currentTransactionIndex, 1);
            
            if (this.aiTransactions.length === 0) {
              // 如果全部被刪光了，自動關閉頁面
              this.isAIScanningMode = false;
              this.performGoBack();
            } else {
              // 防越界處理
              if (this.currentTransactionIndex >= this.aiTransactions.length) {
                this.currentTransactionIndex = this.aiTransactions.length - 1;
              }
              // 載入新的當前交易，並清空錯誤
              this.prefillFormFromAITransaction(this.aiTransactions[this.currentTransactionIndex]);
              this.currentErrors = [];
            }
          }
        }
      ]
    });
    await alert.present();
  }

  private checkBatchValidation(): { index: number, errors: string[] } | null {
    const simulatedBalances = new Map<string, number>(); // 用來記錄每一筆扣完後的累加餘額
    
    for (let i = 0; i < this.aiTransactions.length; i++) {
        const txn = this.aiTransactions[i];
        const errors: string[] = [];
        
        const amount = parseFloat(txn.amount) || 0;
        const accountId = txn.accountId;
        
        let rate = txn.exchangeRate || txn.exRate;
        let account = null;
        
        if (accountId) {
            account = this.financeVar.getAccounts().find(a => a.id === accountId);
            // 初始化虛擬餘額
            if (!simulatedBalances.has(accountId)) {
                simulatedBalances.set(accountId, this.getAccBalance(accountId));
            }
        }
        
        // 匯率計算同步
        if (!rate) {
            rate = 1;
            if (account && txn.currency !== account.currency) {
                const fromRate = this.realExchangeRates[txn.currency] || 1;
                const toRate = this.realExchangeRates[account.currency] || 1;
                rate = toRate / fromRate;
            }
        }
        rate = Number(Number(rate).toFixed(4));
        
        // 基本檢查
        if (isNaN(amount) || amount <= 0) errors.push('請輸入大於 0 的金額');
        if (!accountId) errors.push('請選擇付款帳戶');
        if (!txn.category) errors.push('請選擇交易分類');
        
        // 累積餘額檢查
        if (amount > 0 && accountId && account) {
            const txAmount = amount * rate;
            let currentBal = simulatedBalances.get(accountId)!;
            
            if (account.type === 'transit') {
                if (!account.autoTopUp) {
                    let actualLimit = currentBal;
                    if (account.allowNegative) {
                        actualLimit = (account.negativeMode === 'once' && currentBal < 0) ? 0 : currentBal + (account.negativeLimit || 0);
                    }
                    if (txAmount > actualLimit) {
                        errors.push(`【${account.name}】連續扣除後餘額將不足`);
                    }
                }
            } else if (account.type !== 'credit') {
                if (currentBal - txAmount < 0) {
                    errors.push(`【${account.name}】連續扣除後餘額將不足`);
                }
            }
            // 寫入扣除後的虛擬餘額，供下一筆收據檢查
            simulatedBalances.set(accountId, currentBal - txAmount);
        }
        
        if (errors.length > 0) return { index: i, errors }; // 只要有一張錯，馬上回傳錯在哪一張
    }
    return null; // 全數通過
  }

  // ==========================================
  // Premium Custom Date Picker Methods
  // ==========================================

  openCustomDatePicker() {
    this.showNumPad = false;
    const currentVal = this.transactionForm.get('date')?.value || this.getToday();
    this.pickerActiveMonth = moment(currentVal, 'YYYY-MM-DD');
    this.generateCalendar();
    this.isDatePickerOpen = true;
  }

  closeCustomDatePicker() {
    this.isDatePickerOpen = false;
  }

  changePickerMonth(offset: number) {
    this.pickerActiveMonth.add(offset, 'months');
    this.generateCalendar();
  }

  selectPickerDate(dateStr: string) {
    const selectedDate = moment(dateStr, 'YYYY-MM-DD');
    const today = moment().startOf('day');
    if (selectedDate.isAfter(today)) {
      return;
    }
    
    this.transactionForm.patchValue({ date: dateStr });
    this.isDatePickerOpen = false;
  }

  setTodayDate() {
    // Aligned with today's calendar range picker actions
    this.transactionForm.patchValue({ date: this.getToday() });
    this.pickerActiveMonth = moment();
    this.generateCalendar();
  }

  generateCalendar() {
    const startOfMonth = this.pickerActiveMonth.clone().startOf('month');
    const endOfMonth = this.pickerActiveMonth.clone().endOf('month');
    const todayStr = this.getToday();
    const selectedDateStr = this.transactionForm.get('date')?.value || todayStr;
    const currentYearMonth = this.pickerActiveMonth.format('YYYY-MM');

    const startDayOfWeek = startOfMonth.day(); // 0 is Sunday, 1 is Monday, etc.
    const startDate = startOfMonth.clone().subtract(startDayOfWeek, 'days');

    const weeks: any[][] = [];
    let currentDay = startDate.clone();

    for (let w = 0; w < 6; w++) {
      const weekDays: any[] = [];
      for (let d = 0; d < 7; d++) {
        const dateStr = currentDay.format('YYYY-MM-DD');
        const dayNum = currentDay.date();
        const isCurrentMonth = currentDay.format('YYYY-MM') === currentYearMonth;
        const isSelected = dateStr === selectedDateStr;
        const isToday = dateStr === todayStr;
        const isDisabled = currentDay.isAfter(moment().endOf('day'));

        weekDays.push({
          dateStr,
          dayNum,
          isCurrentMonth,
          isSelected,
          isToday,
          isDisabled
        });

        currentDay.add(1, 'day');
      }
      weeks.push(weekDays);
    }

    this.calendarWeeks = weeks;
  }
}