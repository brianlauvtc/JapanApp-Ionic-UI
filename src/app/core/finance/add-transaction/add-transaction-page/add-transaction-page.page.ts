import { Component, OnInit, Optional } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { FormBuilder, FormGroup, Validators, FormArray } from '@angular/forms';
import { FinanceVarService } from '../../service/finance-var.service';
import { FinanceService } from '../../service/finance.service';
import { Transaction, Account, Fund } from '../../model/finance.model';
import { AlertController, ModalController, NavParams } from '@ionic/angular';
import  moment from 'moment';

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
  itemForm = { name: '', quantity: 1, price: 0 };
  editingIndex: number | null = null;
  
  // Category display state
  showAllCategories = false;

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
    this.loadContextFromRoute();
    
    // 新增這段邏輯來處理編輯模式
    const transactionId = this.navParams.get('transactionId');
    if (transactionId) {
      const transaction = this.financeVar.getTransactions().find(t => t.id === transactionId);
      if (transaction) {
        this.transactionForm.patchValue(transaction); // 將資料填入表單
      }
    }

    this.categories = this.getCategories();
    this.setupFormListeners();
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
      id = this.navParams?.get('id');
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
    });
    
    this.transactionForm.get('accountId')?.valueChanges.subscribe(() => {
      this.calculateExchangeRate();
    });
    
    this.transactionForm.get('amount')?.valueChanges.subscribe(() => {
      this.updateCalculatedAmount();
    });
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

  getAccounts() {
    return this.financeVar.getAccounts();
  }

  getFunds() {
    return this.financeVar.getFunds();
  }

  validateForm(): boolean {
    const amount = this.transactionForm.get('amount')?.value;
    const accountId = this.transactionForm.get('accountId')?.value;
    
    if (!amount || amount <= 0) return false;
    if (!accountId) return false;
    if (this.txnType !== 'transfer' && !this.selectedCategory) return false;
    if (this.txnType === 'transfer' && !this.transactionForm.get('accountToId')?.value) return false;
    
    // For expense with items, warn but don't block if items total exceeds amount
    // The user can still save, but they'll see a warning
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
    if (this.isModal && this.modalCtrl) {
      await this.modalCtrl.dismiss();
      return;
    }
    
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

  // Override loadTransactionForEdit to handle items
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
  async saveTransaction() {
    if (!this.validateForm()) {
      return;
    }
    
    // Disable the save button to prevent multiple clicks
    const saveButton = document.querySelector('.save-transaction-btn');
    if (saveButton) {
      saveButton.setAttribute('disabled', 'true');
    }
    
    try {
      const formValue = this.transactionForm.value;
      const amount = parseFloat(formValue.amount);
      const exchangeRate = parseFloat(formValue.exchangeRate) || 1;
      const accDeduction = this.txnType === 'income' ? -(amount * exchangeRate) : (amount * exchangeRate);
      
      const transaction: Transaction = {
        id: this.isEditMode ? this.editTransactionId! : `t_${Date.now()}`,
        type: this.txnType,
        amount: amount,
        currency: formValue.currency,
        exRate: exchangeRate,
        accDeduction: accDeduction,
        accountId: formValue.accountId,
        toAccountId: this.txnType === 'transfer' ? formValue.accountToId : undefined,
        toAccDeduction: this.txnType === 'transfer' ? -accDeduction : undefined,
        category: this.selectedCategory?.name || formValue.category,
        icon: this.selectedCategory?.icon || '💰',
        note: formValue.note,
        date: formValue.date,
        fundId: this.txnType === 'expense' ? formValue.fundId || undefined : undefined,
        _warnLimit: false
      };
      
      // Add items if they exist and it's an expense
      if (this.txnType === 'expense' && this.items.length > 0) {
        transaction.items = [...this.items];
      }
      
      if (this.isEditMode) {
        this.financeVar.updateTransaction(this.editTransactionId!, transaction);
      } else {
        this.financeVar.addTransaction(transaction);
      }
      
      // Save last used account for this transaction type
      this.saveLastAccount(formValue.accountId);
      
      // Handle income allocation if applicable
      if (this.txnType === 'income' && formValue.allocations?.length > 0) {
        // This would be implemented with allocation logic
      }
      
      await this.goBack();
    } catch (error) {
      console.error('Error saving transaction:', error);
      // Re-enable the save button on error
      if (saveButton) {
        saveButton.removeAttribute('disabled');
      }
    }
  }

  
}