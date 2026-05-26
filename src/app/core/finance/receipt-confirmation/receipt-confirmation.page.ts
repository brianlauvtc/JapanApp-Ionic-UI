import { Component, OnInit } from '@angular/core';
import { Router } from '@angular/router';
import { AlertController, ToastController } from '@ionic/angular';
import { FormBuilder, FormGroup, Validators } from '@angular/forms';
import { FinanceVarService } from '../service/finance-var.service';
import { Transaction } from '../model/finance.model';

interface ExtractedTransaction {
  amount: number;
  currency: string;
  category: string;
  date: string;
  note: string;
  items?: Array<{ name: string; quantity: number; price: number }>;
}

@Component({
  selector: 'app-receipt-confirmation',
  templateUrl: './receipt-confirmation.page.html',
  styleUrls: ['./receipt-confirmation.page.scss']
})
export class ReceiptConfirmationPage implements OnInit {
  transactions: ExtractedTransaction[] = [];
  currentTransactionIndex: number = 0;
  transactionForms: FormGroup[] = [];
  accounts = this.financeVar.getAccounts();
  categories = [
    'Food', 'Transport', 'Shopping', 'Entertainment', 'Housing', 'Medical', 
    'Education', 'Gift', 'Travel', 'Other'
  ];

  constructor(
    private router: Router,
    private alertController: AlertController,
    private toastController: ToastController,
    private fb: FormBuilder,
    private financeVar: FinanceVarService
  ) {}

  ngOnInit() {
    const navigation = this.router.getCurrentNavigation();
    const state = navigation?.extras?.state as { transactions: ExtractedTransaction[] };
    
    if (state && state.transactions) {
      this.transactions = state.transactions;
      this.initializeForms();
    } else {
      this.showError('No Data', 'No transaction data was provided for confirmation.');
    }
  }

  initializeForms() {
    this.transactionForms = this.transactions.map(transaction => 
      this.fb.group({
        amount: [transaction.amount, [Validators.required, Validators.min(0.01)]],
        currency: [transaction.currency, Validators.required],
        accountId: [this.accounts.length > 0 ? this.accounts[0].id : '', Validators.required],
        category: [transaction.category, Validators.required],
        date: [transaction.date, Validators.required],
        note: [transaction.note]
      })
    );
  }

  getCurrentForm(): FormGroup {
    return this.transactionForms[this.currentTransactionIndex];
  }

  nextTransaction() {
    if (this.currentTransactionIndex < this.transactions.length - 1) {
      this.currentTransactionIndex++;
    }
  }

  previousTransaction() {
    if (this.currentTransactionIndex > 0) {
      this.currentTransactionIndex--;
    }
  }

  async saveCurrentTransaction() {
    const form = this.getCurrentForm();
    if (!form.valid) {
      const alert = await this.alertController.create({
        header: 'Invalid Data',
        message: 'Please fill in all required fields correctly.',
        buttons: ['OK']
      });
      await alert.present();
      return;
    }

    const formData = form.value;
    const transaction: Transaction = {
      id: `t_${Date.now()}_${this.currentTransactionIndex}`,
      type: 'expense',
      amount: formData.amount,
      currency: formData.currency,
      exRate: 1, // Will be calculated based on account currency
      accDeduction: -formData.amount, // Expense deduction
      accountId: formData.accountId,
      category: formData.category,
      icon: 'receipt',
      note: formData.note,
      date: formData.date,
      _warnLimit: false
    };

    this.financeVar.addTransaction(transaction);
    
    // Move to next transaction or finish
    if (this.currentTransactionIndex < this.transactions.length - 1) {
      this.currentTransactionIndex++;
      const toast = await this.toastController.create({
        message: 'Transaction saved! Moving to next receipt...',
        duration: 2000,
        color: 'success'
      });
      await toast.present();
    } else {
      await this.finishAllTransactions();
    }
  }

  async saveAllTransactions() {
    let allValid = true;
    this.transactionForms.forEach(form => {
      if (!form.valid) {
        allValid = false;
      }
    });

    if (!allValid) {
      const alert = await this.alertController.create({
        header: 'Invalid Data',
        message: 'Please fill in all required fields correctly for all transactions.',
        buttons: ['OK']
      });
      await alert.present();
      return;
    }

    // Save all transactions
    this.transactionForms.forEach((form, index) => {
      const formData = form.value;
      const transaction: Transaction = {
        id: `t_${Date.now()}_${index}`,
        type: 'expense',
        amount: formData.amount,
        currency: formData.currency,
        exRate: 1,
        accDeduction: -formData.amount,
        accountId: formData.accountId,
        category: formData.category,
        icon: 'receipt',
        note: formData.note,
        date: formData.date,
        _warnLimit: false
      };
      this.financeVar.addTransaction(transaction);
    });

    await this.finishAllTransactions();
  }

  async finishAllTransactions() {
    const toast = await this.toastController.create({
      message: `All ${this.transactions.length} transactions saved successfully!`,
      duration: 3000,
      color: 'success'
    });
    await toast.present();
    
    // Navigate back to home or add transaction page
    this.router.navigate(['/tabs/home']);
  }

  async showError(header: string, message: string) {
    const alert = await this.alertController.create({
      header: header,
      message: message,
      buttons: [{
        text: 'OK',
        handler: () => {
          this.router.navigate(['/add-transaction']);
        }
      }]
    });
    await alert.present();
  }

  goBack() {
    this.router.navigate(['/ai-processing']);
  }
}