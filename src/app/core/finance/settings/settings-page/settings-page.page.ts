import { Component, OnInit } from '@angular/core';
import { FormBuilder, FormGroup, Validators } from '@angular/forms';
import { FinanceVarService } from '../../service/finance-var.service';
import { Filesystem, Directory, Encoding } from '@capacitor/filesystem';
import { AlertController, ToastController } from '@ionic/angular';
import { FinanceService } from '../../service/finance.service';
import { Platform } from '@ionic/angular';

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
  exportFormat = 'json';
  constructor(
    private fb: FormBuilder,
    private financeVar: FinanceVarService,
    private alertCtrl: AlertController,
    private toastCtrl: ToastController,
    private financeService: FinanceService,
    private platform: Platform
  ) {}

  ngOnInit() {
    this.initForm();
    this.fetchRealExchangeRate();
  }

  initForm() {
    const settings = this.financeVar.getAppData().settings;
    this.settingsForm = this.fb.group({
      apiKey: [settings.apiKey],
      baseCurrency: [settings.baseCurrency, Validators.required]
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

  async onExport() {
    const data = this.financeService.exportData(this.exportFormat as any);
    const fileName = `export_${new Date().getTime()}.${this.exportFormat}`;

    if (this.platform.is('capacitor')) {
      // 原生 App 環境：使用 Filesystem
      try {
        await Filesystem.writeFile({
          path: fileName,
          data: data,
          directory: Directory.Documents,
          encoding: Encoding.UTF8,
        });
        this.showToast('✅ 檔案已儲存至 Documents');
      } catch (e) {
        this.showToast('❌ 匯出失敗');
      }
    } else {
      // 瀏覽器環境：使用 Blob 下載
      const blob = new Blob([data], { type: this.exportFormat === 'csv' ? 'text/csv' : 'application/json' });
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = fileName;
      a.click();
      window.URL.revokeObjectURL(url);
      this.showToast('📥 瀏覽器已觸發下載');
    }
  }

  async showToast(msg: string) {
    const toast = await this.toastCtrl.create({ message: msg, duration: 2000 });
    toast.present();
  }
}