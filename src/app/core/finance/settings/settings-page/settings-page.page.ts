import { Component, OnInit } from '@angular/core';
import { FormBuilder, FormGroup, Validators } from '@angular/forms';
import { FinanceVarService } from '../../service/finance-var.service';
import { AlertController, ToastController } from '@ionic/angular';
@Component({
  selector: 'app-settings-page',
  templateUrl: './settings-page.page.html',
  styleUrls: ['./settings-page.page.scss']
})
export class SettingsPagePage implements OnInit {
  settingsForm!: FormGroup;
  hkdToJpy: number | null = null;
  jpyToHkd: number | null = null;
  isRateLoading = false;

  aiFrequencyOptions = [
    { value: 'manual', label: '⏸️ 關閉自動 (僅手動點擊)' },
    { value: '1_day', label: '📅 每天 1 次' },
    { value: '7_days', label: '🗓️ 每 7 天 1 次' },
    { value: '30_days', label: '📆 每個月 1 次' }
  ];

  constructor(
    private fb: FormBuilder,
    private financeVar: FinanceVarService,
    private alertCtrl: AlertController,
    private toastCtrl: ToastController
  ) {}

  ngOnInit() {
    this.initForm();
    this.fetchRealExchangeRate();
  }

  initForm() {
    const settings = this.financeVar.getAppData().settings;
    this.settingsForm = this.fb.group({
      apiKey: [settings.apiKey],
      baseCurrency: [settings.baseCurrency, Validators.required],
      aiFrequency: [settings.aiFrequency, Validators.required],
      enableAIHistory: [settings.enableAIHistory]
    });
  }

  async fetchRealExchangeRate() {
    this.isRateLoading = true;
    try {
      const response = await fetch('https://open.er-api.com/v6/latest/HKD');
      const data = await response.json();
      if (data && data.rates && data.rates.JPY) {
        this.hkdToJpy = data.rates.JPY;
        this.jpyToHkd = 1 / data.rates.JPY;
      }
    } catch (error) {
      console.error('無法取得即時匯率:', error);
    } finally {
      this.isRateLoading = false;
    }
  }

  async saveSettings() {
    const formValue = this.settingsForm.value;
    this.financeVar.updateSettings({
      apiKey: formValue.apiKey,
      baseCurrency: formValue.baseCurrency,
      aiFrequency: formValue.aiFrequency,
      enableAIHistory: formValue.enableAIHistory
    });
    
    // 改用 Toast 提供友善的儲存成功提示
    const toast = await this.toastCtrl.create({
      message: '✅ 設定已成功儲存',
      duration: 2000,
      position: 'top',
      color: 'success',
      cssClass: 'custom-toast'
    });
    await toast.present();
  }

  async clearAllData() {
    // 改用 Ionic 原生的警告彈窗
    const alert = await this.alertCtrl.create({
      header: '危險操作',
      message: '確定要清空所有紀錄與帳戶嗎？此操作【無法復原】！',
      buttons: [
        {
          text: '取消',
          role: 'cancel',
          cssClass: 'secondary'
        },
        {
          text: '確認清空',
          role: 'destructive',
          handler: async () => {
            this.financeVar.clearAllData();
            
            const toast = await this.toastCtrl.create({
              message: '🗑️ 所有資料已清空',
              duration: 2000,
              position: 'top',
              color: 'dark'
            });
            await toast.present();
          }
        }
      ]
    });

    await alert.present();
  }
}