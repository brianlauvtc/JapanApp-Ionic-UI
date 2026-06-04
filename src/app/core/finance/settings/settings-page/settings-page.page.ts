import { Component, OnInit } from '@angular/core';
import { FormBuilder, FormGroup, Validators } from '@angular/forms';
import { FinanceVarService } from '../../service/finance-var.service';
import { Filesystem, Directory, Encoding } from '@capacitor/filesystem';
import { AlertController, ToastController, LoadingController } from '@ionic/angular';
import { FinanceService } from '../../service/finance.service';
import { Platform } from '@ionic/angular';
import { AIService } from '../../service/ai.service';
import { Transaction } from '../../model/finance.model';

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
  showCategoryModal = false;
  catType: 'expense' | 'income' = 'expense';
  newCat = { name: '', id: '', icon: '' };
  isEditCatMode = false;
  editOriginalId = '';

  constructor(
    private fb: FormBuilder,
    private financeVar: FinanceVarService,
    private alertCtrl: AlertController,
    private toastCtrl: ToastController,
    private loadingCtrl: LoadingController,
    private aiService: AIService,
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

  get customCategories() {
    return this.financeVar.getAppData().customCategories?.filter(c => c.type === this.catType) || [];
  }

  openCategoryManager() {
    this.showCategoryModal = true;
  }

  closeCategoryManager() {
    this.showCategoryModal = false;
    this.resetCatForm();
  }

  resetCatForm() {
    this.newCat = { name: '', id: '', icon: '' };
    this.isEditCatMode = false;
    this.editOriginalId = '';
  }

  editCustomCategory(cat: any) {
    this.isEditCatMode = true;
    this.editOriginalId = cat.id;
    // 將選中項目的資料複製到表單中 (解構賦值避免直接改動原資料)
    this.newCat = { name: cat.name, id: cat.id, icon: cat.icon };
  }

  cancelCatEdit() {
    this.resetCatForm();
  }
  // 🌟 呼叫 AI 神奇生成
  async generateCatWithAI() {
    if (!this.newCat.name) return;
    
    const loading = await this.loadingCtrl.create({ message: 'AI 生成中...', spinner: 'crescent' });
    await loading.present();

    const result = await this.aiService.generateCategoryDetails(this.newCat.name);
    await loading.dismiss();

    if (result) {
      this.newCat.id = result.id;
      this.newCat.icon = result.icon;
    } else {
      const alert = await this.alertCtrl.create({ header: '生成失敗', message: '請檢查 API 或是手動輸入', buttons: ['確定'] });
      await alert.present();
    }
  }

  async addCustomCategory() {
    if (!this.newCat.name || !this.newCat.id || !this.newCat.icon) return;

    const currentList = this.financeVar.getAppData().customCategories || [];

    if (this.isEditCatMode) {
      // 編輯模式：檢查是否改了 ID，且新 ID 是否與「其他」現有分類重複
      if (this.newCat.id !== this.editOriginalId) {
        const isExist = Object.keys(this.financeVar.getCategoryMap()).includes(this.newCat.id);
        if (isExist) {
          const alert = await this.alertCtrl.create({ header: 'ID 重複', message: '此英文 ID 已被其他分類使用，請修改。', buttons: ['確定'] });
          await alert.present();
          return;
        }
      }

      // 找出原本那筆資料並更新
      const index = currentList.findIndex(c => c.id === this.editOriginalId);
      if (index > -1) {
        currentList[index] = { ...this.newCat, type: this.catType };
      }
    } else {
      // 新增模式：檢查 ID 是否重複
      const isExist = Object.keys(this.financeVar.getCategoryMap()).includes(this.newCat.id);
      if (isExist) {
        const alert = await this.alertCtrl.create({ header: 'ID 重複', message: '此英文 ID 已存在，請修改。', buttons: ['確定'] });
        await alert.present();
        return;
      }
      
      currentList.push({ ...this.newCat, type: this.catType });
    }

    this.financeVar.updateCustomCategories(currentList);
    this.resetCatForm(); // 儲存完畢後清空表單
  }

  deleteCustomCategory(id: string) {
    let currentList = this.financeVar.getAppData().customCategories || [];
    currentList = currentList.filter(c => c.id !== id);
    this.financeVar.updateCustomCategories(currentList);
  }

  triggerCsvUpload() {
    document.getElementById('moneyPlusCsvUpload')?.click();
  }

  async onCsvFileSelected(event: any) {
    const file = event.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async (e) => {
      const csvText = e.target?.result as string;
      await this.processMoneyPlusCsv(csvText);
    };
    reader.readAsText(file);
    
    // 清空 input，允許重複上傳同一個檔案
    event.target.value = null;
  }

  async processMoneyPlusCsv(csvText: string) {
    const lines = csvText.split('\n');
    const appData = this.financeVar.getAppData();
    const accounts = appData.accounts;
    const newTransactions: Transaction[] = [];
    
    let importCount = 0;
    let skipCount = 0;

    // 從第 1 行開始，跳過標題列
    for (let i = 1; i < lines.length; i++) {
      const line = lines[i].trim();
      
      // 跳過空行或無效行
      if (!line || line.startsWith(',,,,')) continue; 
      
      // 使用正則表達式分割逗號，避免備註內的逗號破壞欄位
      const cols = line.split(/,(?=(?:(?:[^"]*"){2})*[^"]*$)/).map(col => col.replace(/^"|"$/g, ''));
      if (cols.length < 6) continue;

      const dateStr = cols[0];      
      const categoryCol = cols[1];  // 非轉帳:分類名稱 / 轉帳: 目標帳戶
      const amountStr = cols[2];
      const typeStr = cols[3];      
      const accName = cols[5];      // 來源帳戶
      const note = cols[7] || '';

      const amount = parseFloat(amountStr);
      if (isNaN(amount)) continue;

      // 匹配來源帳戶 (From)
      const fromAcc = accounts.find(a => a.name === accName);
      if (!fromAcc) {
        console.warn(`找不到帳戶: ${accName}，跳過此筆: ${line}`);
        skipCount++;
        continue;
      }

      let txType: Transaction['type'];
      let toAccId: string | undefined = undefined;

      // 判斷交易類型與轉帳邏輯
      if (typeStr === '支出') {
        txType = 'expense';
      } else if (typeStr === '收入') {
        txType = 'income';
      } else if (typeStr === '轉帳') {
        txType = 'transfer';
        // 🚨 這裡處理你提到的轉帳邏輯：帳單欄位 (categoryCol) 是 To
        const toAcc = accounts.find(a => a.name === categoryCol);
        if (!toAcc) {
          console.warn(`找不到轉入帳戶: ${categoryCol}，跳過此筆: ${line}`);
          skipCount++;
          continue;
        }
        toAccId = toAcc.id;
      } else {
        continue; 
      }

      // 建立 Transaction 物件
      const txn: Transaction = {
        id: `import_${Date.now()}_${Math.random().toString(36).substring(2,9)}`,
        type: txType,
        amount: amount,
        currency: fromAcc.currency, 
        exRate: 1, 
        // ✨ 重要修正：如果是收入，必須存為負數，這樣系統計算餘額時才會增加！
        accDeduction: txType === 'income' ? -amount : amount, 
        accountId: fromAcc.id,
        date: dateStr,
        note: note !== '' ? note : undefined,
        // 🚨 這裡處理非轉帳邏輯：把帳單欄位 (categoryCol) 存入 category
        category: txType !== 'transfer' ? categoryCol : '轉帳', 
        icon: txType === 'transfer' ? '🔄' : '📝' 
      };

      // 處理轉帳的目的地扣款設定
      if (txType === 'transfer' && toAccId) {
        txn.toAccountId = toAccId;
        txn.toAccDeduction = -amount; // 負數代表目標帳戶增加餘額
      }

      newTransactions.push(txn);
      importCount++;
    }

    // 處理完成，彈出結果視窗
    if (newTransactions.length > 0) {
      const allTxns = [...appData.transactions, ...newTransactions];
      
      this.financeVar.updateAppData({ transactions: allTxns });
      
      const alert = await this.alertCtrl.create({
        header: '匯入成功',
        message: `成功匯入 ${importCount} 筆交易！<br>(跳過了 ${skipCount} 筆帳戶名稱不符的交易)`,
        buttons: ['確定']
      });
      await alert.present();
    } else {
      const alert = await this.alertCtrl.create({
        header: '匯入失敗',
        message: '沒有找到可以匯入的資料，請確認 CSV 格式與帳戶名稱是否正確。',
        buttons: ['確定']
      });
      await alert.present();
    }
  }
}