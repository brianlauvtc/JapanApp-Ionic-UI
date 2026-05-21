import { Component, OnInit } from '@angular/core';
import { FormBuilder, FormGroup, Validators } from '@angular/forms';
import { FinanceVarService } from '../../service/finance-var.service';

@Component({
  selector: 'app-settings-page',
  templateUrl: './settings-page.page.html',
  styleUrls: ['./settings-page.page.scss']
})
export class SettingsPagePage implements OnInit {
  settingsForm!: FormGroup;

  aiFrequencyOptions = [
    { value: 'manual', label: '⏸️ 關閉自動 (僅手動點擊)' },
    { value: '1_day', label: '📅 每天 1 次' },
    { value: '7_days', label: '🗓️ 每 7 天 1 次' },
    { value: '30_days', label: '📆 每個月 1 次' }
  ];

  constructor(
    private fb: FormBuilder,
    private financeVar: FinanceVarService
  ) {}

  ngOnInit() {
    this.initForm();
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

  saveSettings() {
    const formValue = this.settingsForm.value;
    this.financeVar.updateSettings({
      apiKey: formValue.apiKey,
      baseCurrency: formValue.baseCurrency,
      aiFrequency: formValue.aiFrequency,
      enableAIHistory: formValue.enableAIHistory
    });
    
    // Show success message
    console.log('Settings saved');
  }

  clearAllData() {
    if (confirm('清空所有資料無法復原！')) {
      this.financeVar.clearAllData();
    }
  }
}