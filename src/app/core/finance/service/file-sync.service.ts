import { Injectable } from '@angular/core';
import { Filesystem, Directory, Encoding } from '@capacitor/filesystem';
import { AppData } from '../model/finance.model';
import { Platform } from '@ionic/angular';

@Injectable({
  providedIn: 'root'
})
export class FileSyncService {
  // 存在手機的 Documents 資料夾，這個資料夾通常能在檔案管理員看到，且 Android 上有機會在解除安裝後保留
  private readonly FILE_NAME = 'JapanApp_Finance_Save.json';
  private readonly DIR = Directory.Documents;

  constructor(private platform: Platform) {}

  // 1. 將資料寫入實體檔案
  async saveToFile(data: AppData): Promise<void> {
    if (!this.platform.is('capacitor')) return; // 網頁版不執行
    
    try {
      await Filesystem.writeFile({
        path: this.FILE_NAME,
        data: JSON.stringify(data, null, 2), // 排版好看一點，方便用戶閱讀
        directory: this.DIR,
        encoding: Encoding.UTF8,
      });
      console.log('✅ 成功同步至實體檔案存檔');
    } catch (error) {
      console.error('❌ 寫入實體檔案失敗:', error);
    }
  }

  // 2. 從實體檔案讀取並驗證資料
  async readFromFile(): Promise<AppData | null> {
    if (!this.platform.is('capacitor')) return null;

    try {
      const result = await Filesystem.readFile({
        path: this.FILE_NAME,
        directory: this.DIR,
        encoding: Encoding.UTF8,
      });

      const parsedData = JSON.parse(result.data as string);
      
      // 基本驗證：確保有這些陣列且格式沒壞
      if (this.isValidAppData(parsedData)) {
        return parsedData as AppData;
      } else {
        console.warn('⚠️ 存檔格式異常，拒絕讀取');
        return null;
      }
    } catch (error) {
      console.log('找不到存檔或讀取失敗 (可能是首次執行)');
      return null;
    }
  }

  // 3. 驗證格式是否為有效的 AppData
  private isValidAppData(data: any): boolean {
    return (
      data &&
      Array.isArray(data.accounts) &&
      Array.isArray(data.transactions) &&
      Array.isArray(data.funds) &&
      data.settings !== undefined
    );
  }

  // 4. 比對 AppData 與 FileData 的差異
  // 4. 比對 AppData 與 FileData 的差異
  compareData(appData: AppData, fileData: AppData): string[] {
    const differences: string[] = [];

    // 比對帳戶數量
    if (appData.accounts.length !== fileData.accounts.length) {
      differences.push(`🏦 帳戶數量不同 (App: ${appData.accounts.length}, 存檔: ${fileData.accounts.length})`);
    }
    
    // 比對交易數量 (交易數量不同，就代表目前的實際餘額一定不同)
    if (appData.transactions.length !== fileData.transactions.length) {
      differences.push(`💰 交易紀錄數量不同 (App: ${appData.transactions.length}, 存檔: ${fileData.transactions.length})`);
    }

    // 比對帳戶的基礎設定 (改為比對 initBalance 而不是 balance)
    appData.accounts.forEach(appAcc => {
      const fileAcc = fileData.accounts.find(f => f.id === appAcc.id);
      if (!fileAcc) {
        differences.push(`➕ App 內有新增帳戶 [${appAcc.name}]，但實體存檔沒有`);
      } else if (appAcc.initBalance !== fileAcc.initBalance) {
        differences.push(`⚖️ 帳戶 [${appAcc.name}] 初始餘額不同 (App: ${appAcc.initBalance}, 存檔: ${fileAcc.initBalance})`);
      } else if (appAcc.name !== fileAcc.name) {
        differences.push(`🏷️ 帳戶名稱不同 (App: ${appAcc.name}, 存檔: ${fileAcc.name})`);
      }
    });

    // 檢查是否有存檔存在，但 App 內已經刪除的帳戶
    fileData.accounts.forEach(fileAcc => {
      const appAcc = appData.accounts.find(a => a.id === fileAcc.id);
      if (!appAcc) differences.push(`➖ 存檔內有帳戶 [${fileAcc.name}]，但 App 沒有`);
    });

    // 比對 Fund 數量 (可選)
    if (appData.funds.length !== fileData.funds.length) {
      differences.push(`🎯 基金數量不同 (App: ${appData.funds.length}, 存檔: ${fileData.funds.length})`);
    }

    return differences;
  }
}