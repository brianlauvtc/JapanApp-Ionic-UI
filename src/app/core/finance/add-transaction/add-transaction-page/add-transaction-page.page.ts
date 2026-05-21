import { Component, OnInit, Optional } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { FormBuilder, FormGroup, Validators, FormArray } from '@angular/forms';
import { FinanceVarService } from '../../service/finance-var.service';
import { FinanceService } from '../../service/finance.service';
import { Transaction, Account, Fund } from '../../model/finance.model';
import { ModalController, NavParams } from '@ionic/angular';
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

  constructor(
    private route: ActivatedRoute,
    private router: Router,
    private fb: FormBuilder,
    private financeVar: FinanceVarService,
    private financeService: FinanceService,
    private modalCtrl: ModalController,
     private navParams: NavParams
  ) {
    this.isModal = !!this.navParams && !!this.navParams.data;
  }

  ngOnInit() {
    this.initForm();
    this.loadContextFromRoute();
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
      if (this.contextAccountId) {
        this.transactionForm.patchValue({ accountId: this.contextAccountId });
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
  }

  selectCategory(category: any) {
    this.selectedCategory = category;
    this.transactionForm.patchValue({ category: category.name });
  }

  getCategories() {
    return [
      { id: 'c1', name: '飲食', icon: '🍱' },
      { id: 't1', name: '交通', icon: '🚌' },
      { id: 's1', name: '購物', icon: '🛍️' },
      { id: 'e1', name: '娛樂', icon: '🎮' },
      { id: 'o1', name: '其他', icon: '📝' }
    ];
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
    
    return true;
  }

  async saveTransaction() {
    if (!this.validateForm()) {
      return;
    }
    
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
    
    if (this.isEditMode) {
      this.financeVar.updateTransaction(this.editTransactionId!, transaction);
    } else {
      this.financeVar.addTransaction(transaction);
    }
    
    // Handle income allocation if applicable
    if (this.txnType === 'income' && formValue.allocations?.length > 0) {
      // This would be implemented with allocation logic
    }
    
    this.goBack();
  }

  deleteTransaction() {
    if (this.editTransactionId) {
      this.financeVar.deleteTransaction(this.editTransactionId);
      this.goBack();
    }
  }

  goBack() {
    if (this.isModal && this.modalCtrl) {
      this.modalCtrl.dismiss();
      return;
    }
    
    if (this.contextType === 'account' && this.contextAccountId) {
      this.router.navigate(['/account-detail', this.contextAccountId]);
    } else if (this.contextType === 'fund' && this.contextFundId) {
      this.router.navigate(['/fund-detail', this.contextFundId]);
    } else {
      this.router.navigate(['/home']);
    }
  }

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
    
    this.calculateExchangeRate();
  }

  getAccountCurrency(accountId: string): string {
    const account = this.financeVar.getAccounts().find(a => a.id === accountId);
    return account?.currency || 'HKD';
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

  getCategoryIconName(icon: string): string {
    // Map custom icons to Ionicons
    const iconMap: { [key: string]: string } = {
      '🍱': 'fast-food',
      '🚌': 'bus',
      '🛍️': 'cart',
      '🎮': 'game-controller',
      '📝': 'document-text',
      '🔄': 'swap-horizontal'
    };
    return iconMap[icon] || 'cash';
  }
}