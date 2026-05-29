import { Component, OnInit, Optional } from '@angular/core';
import { ActivatedRoute, NavigationEnd, Router } from '@angular/router';
import { FormBuilder, FormGroup, Validators, FormArray } from '@angular/forms';
import { FinanceVarService } from '../../service/finance-var.service';
import { FinanceService } from '../../service/finance.service';
import { Transaction, Account, Fund } from '../../model/finance.model';
import { AlertController, ModalController, NavParams } from '@ionic/angular';
import  moment from 'moment';
import { filter } from 'rxjs';

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
      this.calculateExchangeRate();
      this.checkFormDirty();
    });
    
    this.transactionForm.get('accountId')?.valueChanges.subscribe(() => {
      this.calculateExchangeRate();
      this.checkFormDirty();
    });
    
    this.transactionForm.get('amount')?.valueChanges.subscribe(() => {
      this.updateCalculatedAmount();
      this.checkFormDirty();
    });
    
    // Add listeners for other form controls
    this.transactionForm.valueChanges.subscribe(() => {
      this.checkFormDirty();
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
    
    if (!currency || !accountId) {
      this.transactionForm.patchValue({ exchangeRate: 1 }, { emitEvent: false });
      return;
    }
    
    const account = this.financeVar.getAppData().accounts.find(a => a.id === accountId);
    if (!account) {
      this.transactionForm.patchValue({ exchangeRate: 1 }, { emitEvent: false });
      return;
    }
    
    if (currency === account.currency) {
      this.transactionForm.patchValue({ exchangeRate: 1 }, { emitEvent: false });
    } else {
      // Calculate exchange rate based on configured rates
      const currencies = {
        HKD: { symbol: '$', rate: 1, name: 'HKD' },
        JPY: { symbol: '¥', rate: 0.05, name: 'JPY' }
      };
      const rate = currencies[currency as keyof typeof currencies].rate / currencies[account.currency as keyof typeof currencies].rate;
      this.transactionForm.patchValue({ exchangeRate: rate }, { emitEvent: false });
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
      const incomeCategories = [
        { id: 'bonus', name: '獎金', icon: '🏆' },
        { id: 'salary', name: '工資', icon: '💼' },
        { id: 'investment', name: '理財投資', icon: '📈' },
        { id: 'parttime', name: '兼職', icon: '🕒' },
        { id: 'debt_collection', name: '欠債收款', icon: '📥' },
        { id: 'transport_subsidy', name: '交通補貼', icon: '🚇' },
        { id: 'other_income', name: '其他', icon: '✨' },
        { id: 'credit_repayment', name: '信用卡還款', icon: '💳' },
        { id: 'interest', name: '利息', icon: '📊' },
        { id: 'insurance', name: '保險', icon: '🛡️' }
      ];
      
      return this.sortCategoriesByFrequency(incomeCategories, allTransactions);
    } else if (this.txnType === 'expense') {
      const expenseCategories = [
        { id: 'food', name: '飲食', icon: '🍜' },
        { id: 'daily', name: '日用', icon: '🧼' },
        { id: 'transport', name: '交通', icon: '🚗' },
        { id: 'social', name: '社交', icon: '🎉' },
        { id: 'housing', name: '住房物業', icon: '🏢' },
        { id: 'gift', name: '禮物', icon: '🎁' },
        { id: 'clothing', name: '服飾', icon: '👗' },
        { id: 'communication', name: '通信', icon: '📞' },
        { id: 'entertainment', name: '娛樂', icon: '🎬' },
        { id: 'beauty', name: '美容', icon: '💅' },
        { id: 'medical', name: '醫療', icon: '💊' },
        { id: 'tax', name: '稅金', icon: '🏛️' },
        { id: 'education', name: '教育', icon: '🎓' },
        { id: 'baby', name: '寶寶', icon: '🍼' },
        { id: 'pet', name: '寵物', icon: '🐱' },
        { id: 'travel', name: '旅行', icon: '🌴' },
        { id: 'household', name: '家用', icon: '🧹' },
        { id: 'savings_insurance', name: '儲蓄保險', icon: '🏦' },
        { id: 'credit_payment', name: '信用卡還款', icon: '💳' },
        { id: 'shopping_dining', name: '買野飲', icon: '🛍️' },
        { id: 'snacks', name: '零食', icon: '🍬' },
        { id: 'gaming', name: '遊戲', icon: '🕹️' },
        { id: 'other_expense', name: '其他', icon: '⭐' },
        { id: 'on9_stuff', name: 'on9野', icon: '🤪' },
        { id: 'debt_repayment', name: '欠債還款', icon: '📤' }
      ];
      
      return this.sortCategoriesByFrequency(expenseCategories, allTransactions);
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

  validateForm(): boolean {
    const amount = parseFloat(this.transactionForm.get('amount')?.value);
    const accountId = this.transactionForm.get('accountId')?.value;
    
    if (!amount || amount <= 0) return false;
    if (!accountId) return false;
    if (this.txnType !== 'transfer' && !this.selectedCategory) return false;
    if (this.txnType === 'transfer' && !this.transactionForm.get('accountToId')?.value) return false;
    
    // ===== 交通卡付款安全線校驗 =====
    if (this.txnType === 'expense') {
      const account = this.financeVar.getAccounts().find(a => a.id === accountId);
      if (account && account.type === 'transit') {
        const exchangeRate = parseFloat(this.transactionForm.get('exchangeRate')?.value) || 1;
        const txAmount = amount * exchangeRate; // 轉換為交通卡的幣別金額
        
        // 【沒有自動轉帳時】必須嚴格檢驗總購買力
        if (!account.autoTopUp) {
          const currentBal = this.getAccBalance(account.id);
          let buyingPower = currentBal;
          
          if (account.allowNegative) {
            if (account.negativeMode === 'once' && currentBal < 0) {
               buyingPower = 0; // 只能負一次且已負，無法再扣
            } else {
               buyingPower = currentBal + (account.negativeLimit || 0); // 餘額 + 可負數額
            }
          }
          
          // 如果想買的金額 大於 目前剩餘總購買力 => 阻擋儲存 (按鈕反灰)
          if (txAmount > buyingPower) {
            return false;
          }
        }
      }
    }
    return true;
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
    if (!currency || !accountId) return false;
    
    const account = this.financeVar.getAccounts().find(a => a.id === accountId);
    return !!account && currency !== account.currency;
  }

  calculatedAmount(): string {
    const amount = parseFloat(this.transactionForm.get('amount')?.value) || 0;
    const exchangeRate = parseFloat(this.transactionForm.get('exchangeRate')?.value) || 1;
    const accountCurrency = this.getAccountCurrency(this.transactionForm.get('accountId')?.value);
    return `${this.getCurrencySymbol(accountCurrency)}${(amount * exchangeRate).toFixed(2)}`;
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
    
    // Load items if they exist
    if (transaction.items && transaction.items.length > 0) {
      this.items = [...transaction.items];
    }
    
    // Refresh categories for the loaded transaction type
    this.categories = this.getCategories();
    
    this.calculateExchangeRate();
    
    // Capture initial form values after loading edit data
    this.captureInitialFormValues();
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
    
    // AI mode only supports expense transactions
    this.txnType = 'expense';
    
    // Get expense categories for proper matching
    const expenseCategories = [
      { id: 'food', name: '飲食', icon: '🍜' },
      { id: 'daily', name: '日用', icon: '🧼' },
      { id: 'transport', name: '交通', icon: '🚗' },
      { id: 'social', name: '社交', icon: '🎉' },
      { id: 'housing', name: '住房物業', icon: '🏢' },
      { id: 'gift', name: '禮物', icon: '🎁' },
      { id: 'clothing', name: '服飾', icon: '👗' },
      { id: 'communication', name: '通信', icon: '📞' },
      { id: 'entertainment', name: '娛樂', icon: '🎬' },
      { id: 'beauty', name: '美容', icon: '💅' },
      { id: 'medical', name: '醫療', icon: '💊' },
      { id: 'tax', name: '稅金', icon: '🏛️' },
      { id: 'education', name: '教育', icon: '🎓' },
      { id: 'baby', name: '寶寶', icon: '🍼' },
      { id: 'pet', name: '寵物', icon: '🐱' },
      { id: 'travel', name: '旅行', icon: '🌴' },
      { id: 'household', name: '家用', icon: '🧹' },
      { id: 'savings_insurance', name: '儲蓄保險', icon: '🏦' },
      { id: 'credit_payment', name: '信用卡還款', icon: '💳' },
      { id: 'shopping_dining', name: '買野飲', icon: '🛍️' },
      { id: 'snacks', name: '零食', icon: '🍬' },
      { id: 'gaming', name: '遊戲', icon: '🕹️' },
      { id: 'other_expense', name: '其他', icon: '⭐' },
      { id: 'on9_stuff', name: 'on9野', icon: '🤪' },
      { id: 'debt_repayment', name: '欠債還款', icon: '📤' }
    ];
    
    // Find exact matching category or default to '其他'
    let selectedCategory = expenseCategories.find(cat => cat.name === transaction.category);
    if (!selectedCategory) {
      // Try to find a close match by checking if AI category contains any expense category name
      for (const cat of expenseCategories) {
        if (transaction.category.includes(cat.name) || cat.name.includes(transaction.category)) {
          selectedCategory = cat;
          break;
        }
      }
      // If still no match, use '其他'
      if (!selectedCategory) {
        selectedCategory = expenseCategories.find(cat => cat.name === '其他') || expenseCategories[0];
      }
    }
    
    this.selectedCategory = selectedCategory;
    
    // Get default account if none specified
    const defaultAccountId = this.accounts.length > 0 ? this.accounts[0].id : '';
    const accountId = transaction.accountId || defaultAccountId;
    
    // Patch form values
    this.transactionForm.patchValue({
      amount: transaction.amount || 0,
      currency: transaction.currency || 'HKD',
      accountId: accountId,
      date: transaction.date || this.getToday(),
      note: transaction.note || '',
      category: selectedCategory.name
    });
    
    // Handle items if present
    if (transaction.items && transaction.items.length > 0) {
      this.items = [...transaction.items];
    }
    
    // Recalculate exchange rate after setting currency and account
    this.calculateExchangeRate();
    
    // Mark form as dirty since AI has populated it with user data
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
    if (!this.validateForm()) {
      return;
    }
    
    const saveButton = document.querySelector('.save-transaction-btn');
    if (saveButton) {
      saveButton.setAttribute('disabled', 'true');
    }
    
    try {
      if (this.isAIScanningMode) {
        // ==========================================
        // AI BATCH SAVE LOGIC ("SAVE ALL")
        // ==========================================
        
        // 1. Sync the form state of the receipt they are currently looking at to the array
        this.syncFormToAITransaction();
        
        // 2. Loop through and save ALL transactions in the queue at once
        for (let i = 0; i < this.aiTransactions.length; i++) {
          const aiTxn = this.aiTransactions[i];
          const amount = parseFloat(aiTxn.amount) || 0;
          
          // Calculate exchange rate for each individual transaction
          let exchangeRate = 1;
          const account = this.financeVar.getAccounts().find(a => a.id === aiTxn.accountId);
          if (account && aiTxn.currency !== account.currency) {
            const currencies = { HKD: { rate: 1 }, JPY: { rate: 0.05 } };
            const fromRate = currencies[aiTxn.currency as keyof typeof currencies]?.rate || 1;
            const toRate = currencies[account.currency as keyof typeof currencies]?.rate || 1;
            exchangeRate = fromRate / toRate;
          }
          
          const transaction: Transaction = {
            id: `t_${Date.now()}_${i}`, // Ensure unique IDs for the batch
            type: 'expense',
            amount: amount,
            currency: aiTxn.currency,
            exRate: exchangeRate,
            accDeduction: amount * exchangeRate,
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
        
        // 3. Force form to clean state to avoid "Cancel" alerts
        this.transactionForm.markAsPristine();
        this.transactionForm.markAsUntouched();
        this.isFormDirty = false;
        this.initialFormValues = this.transactionForm.getRawValue();
        
        // 4. Clear out the AI states completely
        this.aiTransactions = [];
        this.isAIScanningMode = false;
        this.currentTransactionIndex = 0;
        
        // 5. Alert user of success and go back
        const alert = await this.alertController.create({
          header: '全部儲存成功',
          message: '已成功儲存所有掃描收據！',
          buttons: ['確定']
        });
        await alert.present();
        await this.goBack();

      } else {
        // ==========================================
        // NORMAL MANUAL / EDIT SAVE LOGIC
        // ==========================================
        
        const formValue = this.transactionForm.value;
        const amount = parseFloat(formValue.amount);
        const exchangeRate = parseFloat(formValue.exchangeRate) || 1;
        
        const accDeduction = this.txnType === 'income' ? -(amount * exchangeRate) : (amount * exchangeRate);
        
        let toAccDeduction = undefined;
        if (this.txnType === 'transfer' && formValue.accountToId) {
          const toAccount = this.financeVar.getAccounts().find(a => a.id === formValue.accountToId);
          if (toAccount) {
            const currenciesObj = {
              HKD: { symbol: '$', rate: 1, name: 'HKD' },
              JPY: { symbol: '¥', rate: 0.05, name: 'JPY' }
            };
            const fromRate = currenciesObj[formValue.currency as keyof typeof currenciesObj].rate;
            const toRate = currenciesObj[toAccount.currency as keyof typeof currenciesObj].rate;
            toAccDeduction = -((amount * fromRate) / toRate);
          }
        }
        
        const transaction: Transaction = {
          id: this.isEditMode ? this.editTransactionId! : `t_${Date.now()}`,
          type: this.txnType,
          amount: amount,
          currency: formValue.currency,
          exRate: exchangeRate,
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

        // Force form to clean state to avoid "Cancel" alerts
        this.transactionForm.markAsPristine();
        this.transactionForm.markAsUntouched();
        this.isFormDirty = false;
        this.initialFormValues = this.transactionForm.getRawValue();

        await this.goBack();
      }
      
    } catch (error) {
      console.error('Error saving transaction:', error);
      if (saveButton) {
        saveButton.removeAttribute('disabled');
      }
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