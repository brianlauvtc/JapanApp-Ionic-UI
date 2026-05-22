import { Component, OnInit } from '@angular/core';
import { FormBuilder, FormGroup, Validators } from '@angular/forms';
import { ModalController, NavParams } from '@ionic/angular';
import { FinanceVarService } from '../../service/finance-var.service';
import { Account } from '../../model/finance.model';
import { currencies } from '../../environment/environment';

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
    { value: 'credit', label: '信用卡' }
  ];

  constructor(
    private fb: FormBuilder,
    private financeVar: FinanceVarService,
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
      initBalance: [0, [Validators.required, Validators.min(0)]]
    });
  }

  loadAccountForEdit() {
    const accountId = this.navParams?.get('accountId');
    if (accountId) {
      this.isEditMode = true;
      this.editAccountId = accountId;
      const account = this.financeVar.getAccounts().find(a => a.id === accountId);
      if (account) {
        this.accountForm.patchValue({
          name: account.name,
          type: account.type,
          currency: account.currency,
          initBalance: account.initBalance
        });
      }
    }
  }

  async saveAccount() {
    if (this.accountForm.invalid) {
      return;
    }

    const formValue = this.accountForm.value;
    const account: Account = {
      id: this.isEditMode ? this.editAccountId! : `acc_${Date.now()}`,
      name: formValue.name,
      type: formValue.type,
      currency: formValue.currency,
      initBalance: parseFloat(formValue.initBalance)
    };

    if (this.isEditMode) {
      this.financeVar.updateAccount(this.editAccountId!, account);
    } else {
      this.financeVar.addAccount(account);
    }

    await this.modalCtrl.dismiss({ success: true });
  }

  async cancel() {
    await this.modalCtrl.dismiss({ success: false });
  }

  getCurrencySymbol(currency: string): string {
    return this.currencies[currency as keyof typeof this.currencies]?.symbol || '$';
  }
}