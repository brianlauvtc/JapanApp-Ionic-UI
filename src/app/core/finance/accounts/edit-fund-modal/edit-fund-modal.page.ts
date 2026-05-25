import { Component, OnInit } from '@angular/core';
import { FormBuilder, FormGroup, Validators } from '@angular/forms';
import { AlertController, ModalController, NavParams } from '@ionic/angular';
import { FinanceVarService } from '../../service/finance-var.service';
import { Fund } from '../../model/finance.model';
import { currencies } from '../../environment/environment';

@Component({
  selector: 'app-edit-fund-modal',
  templateUrl: './edit-fund-modal.page.html',
  styleUrls: ['./edit-fund-modal.page.scss']
})
export class EditFundModalPage implements OnInit {
  fundForm!: FormGroup;
  isEditMode = false;
  editFundId: string | null = null;
  currencies = currencies;
  
  unspentActions = [
    { value: 'none', label: '無操作' },
    { value: 'carry', label: '結轉至明日' },
    { value: 'cancel', label: '取消未用額度' },
    { value: 'transfer', label: '轉移至其他基金' }
  ];

  constructor(
    private fb: FormBuilder,
    private financeVar: FinanceVarService,
    private modalCtrl: ModalController,
    private alertController: AlertController,
    private navParams: NavParams
  ) {}

  ngOnInit() {
    this.initForm();
    this.loadFundForEdit();
  }

  initForm() {
    this.fundForm = this.fb.group({
      name: ['', [Validators.required, Validators.minLength(1), Validators.maxLength(20)]],
      initAmount: [0, [Validators.required, Validators.min(0)]],
      hasDaily: [false],
      dailyLimit: [0],
      unspentAction: ['none'],
      transferTargetId: [''],
      currency: ['HKD']
    });
  }

  loadFundForEdit() {
    const fundId = this.navParams?.get('fundId');
    if (fundId) {
      this.isEditMode = true;
      this.editFundId = fundId;
      const fund = this.financeVar.getFunds().find(f => f.id === fundId);
      if (fund) {
        this.fundForm.patchValue({
          name: fund.name,
          initAmount: fund.initAmount,
          hasDaily: fund.hasDaily || false,
          dailyLimit: fund.dailyLimit || 0,
          unspentAction: fund.unspentAction || 'none',
          transferTargetId: fund.transferTargetId || '',
          currency: fund.currency || 'HKD'
        });
      }
    }
  }

  onHasDailyChange() {
    const hasDaily = this.fundForm.get('hasDaily')?.value;
    if (!hasDaily) {
      this.fundForm.patchValue({
        dailyLimit: 0,
        unspentAction: 'none',
        transferTargetId: ''
      });
    }
  }

  onUnspentActionChange() {
    const action = this.fundForm.get('unspentAction')?.value;
    if (action !== 'transfer') {
      this.fundForm.patchValue({ transferTargetId: '' });
    }
  }

  async saveFund() {
    if (this.fundForm.invalid) {
      return;
    }

    const formValue = this.fundForm.value;
    const fund: Fund = {
      id: this.isEditMode ? this.editFundId! : `fund_${Date.now()}`,
      name: formValue.name,
      initAmount: parseFloat(formValue.initAmount),
      hasDaily: formValue.hasDaily,
      dailyLimit: formValue.hasDaily ? parseFloat(formValue.dailyLimit) : undefined,
      unspentAction: formValue.hasDaily ? formValue.unspentAction : undefined,
      transferTargetId: formValue.hasDaily && formValue.unspentAction === 'transfer' ? formValue.transferTargetId : undefined,
      currency: formValue.currency
    };

    if (this.isEditMode) {
      this.financeVar.updateFund(this.editFundId!, fund);
    } else {
      this.financeVar.addFund(fund);
    }

    await this.modalCtrl.dismiss({ success: true });
  }

  async cancel() {
    await this.modalCtrl.dismiss({ success: false });
  }

  getCurrencySymbol(currency: string): string {
    return this.currencies[currency as keyof typeof this.currencies]?.symbol || '$';
  }

  getTransferTargetFunds() {
    return this.financeVar.getFunds().filter(f => f.id !== this.editFundId);
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
            this.financeVar.deleteFund(this.editFundId!);
            this.modalCtrl.dismiss({ success: true, deleted: true });
          }
        }
      ]
    });
    await alert.present();
  }
}