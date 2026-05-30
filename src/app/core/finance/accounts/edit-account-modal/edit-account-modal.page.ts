import { Component, OnInit } from '@angular/core';
import { FormBuilder, FormGroup, Validators } from '@angular/forms';
import { AlertController, ModalController, NavParams } from '@ionic/angular';
import { FinanceVarService } from '../../service/finance-var.service';
import { Account, Transaction } from '../../model/finance.model';
import { currencies } from '../../environment/environment';
import moment from 'moment';
import { FinanceService } from '../../service/finance.service';

@Component({
  selector: 'app-edit-account-modal',
  templateUrl: './edit-account-modal.page.html',
  styleUrls: ['./edit-account-modal.page.scss']
})
export class EditAccountModalPage implements OnInit {
  accountForm!: FormGroup;
  isEditMode = false;
  editAccountId: string | null = null;
  currencies = currencies;
  
  accountTypes = [
    { value: 'cash', label: '現金' },
    { value: 'bank', label: '銀行' },
    { value: 'credit', label: '信用卡' },
    { value: 'loan', label: '借出/借入' },
    { value: 'transit', label: '交通卡' }
  ];

  constructor(
    private fb: FormBuilder,
    private financeVar: FinanceVarService,
    private financeService: FinanceService,
    private alertController: AlertController,
    private modalCtrl: ModalController,
    private navParams: NavParams
  ) {}

  ngOnInit() {
    this.initForm();
    this.loadAccountForEdit();
  }

  initForm() {
    this.accountForm = this.fb.group({
      name: ['', [Validators.required, Validators.minLength(1), Validators.maxLength(20)]],
      type: ['cash', Validators.required],
      currency: ['HKD', Validators.required],
      initBalance: [0, [Validators.required]],
      allowNegative: [false],
      negativeLimit: [0],
      negativeMode: ['once'],
      autoTopUp: [false],
      topUpSourceAccountId: [''],
      topUpAmount: [250],
      topUpTrigger: ['instant']
    });

    this.accountForm.get('type')?.valueChanges.subscribe(type => {
      const balanceCtrl = this.accountForm.get('initBalance');
      if (type === 'loan' || type === 'transit') {
        // 借款帳戶：只要求必填，允許負數
        balanceCtrl?.setValidators([Validators.required]);
      } else {
        // 其他帳戶：必填且必須大於或等於 0
        balanceCtrl?.setValidators([Validators.required, Validators.min(0)]);
      }
      // 重新整理驗證狀態
      balanceCtrl?.updateValueAndValidity();
    });

    // 確保初始化時觸發一次驗證器設定
    setTimeout(() => {
      this.accountForm.get('type')?.updateValueAndValidity();
    }, 0);
  }

  getOtherAccounts() {
    return this.financeVar.getAccounts().filter(a => 
      a.id !== this.editAccountId && a.type !== 'transit' && a.type !== 'loan'
    );
  }


  loadAccountForEdit() {
    const accountId = this.navParams?.get('accountId');
    if (accountId) {
      this.isEditMode = true;
      this.editAccountId = accountId;
      const account = this.financeVar.getAccounts().find(a => a.id === accountId);
      if (account) {
        const currentActualBalance = this.financeService.getAccBalance(accountId);
        this.accountForm.patchValue({
          name: account.name,
          type: account.type,
          currency: account.currency,
          initBalance: currentActualBalance,
          allowNegative: account.allowNegative || false,
          negativeLimit: account.negativeLimit || 0,
          negativeMode: account.negativeMode || 'once',
          autoTopUp: account.autoTopUp || false,
          topUpSourceAccountId: account.topUpSourceAccountId || '',
          topUpAmount: account.topUpAmount || 250,
          topUpTrigger: account.topUpTrigger || 'instant'
        });

        this.accountForm.get('type')?.disable();
      }
    }
  } 

 async saveAccount() {
  if (this.accountForm.invalid) return;

  console.log('1')
  const formValue = this.accountForm.getRawValue();
  const newBalanceInput = parseFloat(formValue.initBalance); // 這是使用者在輸入框填的總額
  
  const oldAccount = this.financeVar.getAccounts().find(a => a.id === this.editAccountId);
  
  console.log('2', oldAccount)


  if (this.isEditMode && oldAccount) {
    // 1. 計算差額：目標餘額 - (舊開戶餘額 + 至今所有交易累計)
    // 但簡單做法是：直接算出 (新目標餘額 - 當前實際餘額) 的差值作為調整
    const currentActualBalance = this.financeService.getAccBalance(this.editAccountId!);
    const diff = newBalanceInput - currentActualBalance;
    
    console.log('3', Math.abs(diff))
    // 2. 如果有差額，才新增交易

    const updatedAccount: Account = {
      ...oldAccount, // 保留所有舊屬性
      name: formValue.name,
      type: formValue.type,
      currency: formValue.currency,
      initBalance: oldAccount.initBalance, // <--- 強制鎖定，確保不會改到 initBalance
      allowNegative: formValue.allowNegative,
      negativeLimit: formValue.negativeLimit,
      negativeMode: formValue.negativeMode,
      autoTopUp: formValue.autoTopUp,
      topUpSourceAccountId: formValue.topUpSourceAccountId,
      topUpAmount: formValue.topUpAmount,
      topUpTrigger: formValue.topUpTrigger
    };

    const adjustmentTxn: Transaction = {
      id: `adj_${Date.now()}`,
      type: diff > 0 ? 'income' : 'expense',
      amount: Math.abs(diff),
      currency: oldAccount.currency,
      exRate: 1,
      accDeduction: Math.abs(diff),
      accountId: this.editAccountId!,
      date: moment().format('YYYY-MM-DD'),
      note: '帳戶餘額手動調整'
    };

    
    console.log('4')
    // 3. 儲存時，關鍵在這：initBalance 保持不變
   
    console.log('5')
    setTimeout(() => {
      if (Math.abs(diff) > 0.01) {
        this.financeVar.addTransaction(adjustmentTxn);
      }
      this.financeVar.updateAccount(this.editAccountId!, updatedAccount);
  }, 0);
    console.log('6')
  } else {
    // 新增帳戶邏輯保持不變...
    const newAccount: Account = {
      id: `acc_${Date.now()}`,
      name: formValue.name,
      type: formValue.type,
      currency: formValue.currency,
      initBalance: newBalanceInput,
      allowNegative: formValue.allowNegative,
      negativeLimit: formValue.negativeLimit,
      negativeMode: formValue.negativeMode,
      autoTopUp: formValue.autoTopUp,
      topUpSourceAccountId: formValue.topUpSourceAccountId,
      topUpAmount: formValue.topUpAmount,
      topUpTrigger: formValue.topUpTrigge
    };

    this.financeVar.addAccount(newAccount);
  }

  await this.modalCtrl.dismiss({ success: true });
}

  async cancel() {
    await this.modalCtrl.dismiss({ success: false });
  }

  getCurrencySymbol(currency: string): string {
    return this.currencies[currency as keyof typeof this.currencies]?.symbol || '$';
  }

  async confirmDelete() {
    const alert = await this.alertController.create({
      header: '確認刪除',
      message: '此帳戶的所有交易紀錄將會被移除，確定嗎？',
      buttons: [
        { text: '取消', role: 'cancel' },
        { 
          text: '刪除', 
          role: 'destructive',
          handler: () => {
            this.financeVar.deleteAccount(this.editAccountId!);
            this.modalCtrl.dismiss({ success: true, deleted: true });
          }
        }
      ]
    });
    await alert.present();
  }
}