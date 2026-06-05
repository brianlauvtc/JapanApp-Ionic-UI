import { Component, OnInit } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { AlertController, ModalController } from '@ionic/angular';
import { FinanceVarService } from '../../service/finance-var.service';
import { FinanceService } from '../../service/finance.service';
import { ApexOptions } from 'ng-apexcharts';
import moment from 'moment';
import { currencies } from '../../environment/environment';
import { AddTransactionPagePage } from '../../add-transaction/add-transaction-page/add-transaction-page.page';
import { EditAccountModalPage } from '../edit-account-modal/edit-account-modal.page';
import { Subscription } from 'rxjs';

@Component({
  selector: 'app-account-detail',
  templateUrl: './account-detail.page.html',
  styleUrls: ['./account-detail.page.scss']
})
export class AccountDetailPage implements OnInit {
  currencies = currencies;
  accountId!: string;
  viewedMonth: string = '';
  chartOptions: ApexOptions = {};
  chartSeries: any[] = [];
  today: string = '';
  private appDataSubscription!: Subscription;
  groupedData: any = { days: [] };

  // Progressive loading variables
  visibleDays: any[] = [];
  totalDays: any[] = [];
  currentLoadedIndex = 0;

  constructor(
    private route: ActivatedRoute,
    private router: Router,
    private modalController: ModalController,
    private alertController: AlertController,
    private modalCtrl: ModalController,
    private financeVar: FinanceVarService,
    private financeService: FinanceService
  ) {}

  ngOnInit() {
    this.accountId = this.route.snapshot.paramMap.get('id')!;
    this.viewedMonth = moment().format('YYYY-MM');
    this.today = this.financeService.getToday();
    this.renderAccountDetail();
    this.appDataSubscription = this.financeVar.appData$.subscribe(() => {
      // 收到通知後，僅執行讀取與渲染，不執行任何修改
    this.renderAccountDetail();
    });
  }

  ngOnDestroy() {
    // 記得銷毀，否則頁面切換後會出現記憶體洩漏或重複觸發的問題
    if (this.appDataSubscription) {
      this.appDataSubscription.unsubscribe();
    }
  }
  renderAccountDetail(preventReset: boolean = false) {
    this.groupedData = this.financeService.calculateDailyGroupedData(this.viewedMonth, 'account', this.accountId);
    const data = this.groupedData;
    const account = this.financeVar.getAppData().accounts.find(a => a.id === this.accountId);
    
    if (!account) {
      this.router.navigate(['/accounts']);
      return;
    }
    
    // Update chart data
    const chartData = [{ date: `${this.viewedMonth}-01`, val: data.openBal }];
    data.days.forEach(dayGrp => {
      chartData.push({ date: dayGrp.date, val: dayGrp.endBal });
    });
    
    const sortedChartData = chartData.sort((a, b) => moment(a.date).diff(moment(b.date)));
    const labels = sortedChartData.map(d => moment(d.date).format('D'));
    const values = sortedChartData.map(d => d.val);
    
    if (preventReset && this.chartOptions && this.chartOptions.xaxis && this.chartOptions.yaxis) {
      this.chartSeries = [{
        name: '餘額',
        data: values
      }];
      this.chartOptions.xaxis = {
        ...this.chartOptions.xaxis,
        categories: labels
      };
      this.chartOptions.yaxis = {
        ...this.chartOptions.yaxis,
        min: Math.min(...values) * 0.9,
        max: Math.max(...values) * 1.1
      };
    } else {
      this.chartOptions = {
        chart: {
          type: 'line',
          height: 64,
          animations: {
            enabled: false
          },
          toolbar: {
            show: false
          }
        },
        stroke: {
          curve: 'smooth',
          width: 2
        },
        fill: {
          type: 'gradient',
          gradient: {
            shade: 'light',
            type: 'vertical',
            shadeIntensity: 0.4,
            gradientToColors: undefined,
            inverseColors: false,
            opacityFrom: 0.2,
            opacityTo: 0.1,
            stops: [0, 100]
          }
        },
        dataLabels: {
          enabled: false
        },
        markers: {
          size: 0
        },
        xaxis: {
          categories: labels,
          labels: {
            show: false
          },
          axisTicks: {
            show: false
          },
          axisBorder: {
            show: false
          }
        },
        yaxis: {
          show: false,
          min: Math.min(...values) * 0.9,
          max: Math.max(...values) * 1.1
        },
        grid: {
          show: false
        },
        colors: ['#4f46e5']
      };
      
      this.chartSeries = [{
        name: '餘額',
        data: values
      }];
    }
    
    console.log(values);

    // Reset or preserve progressive chunk loader
    this.totalDays = this.groupedData.days || [];
    if (preventReset) {
      this.currentLoadedIndex = Math.max(this.currentLoadedIndex, 5);
      this.visibleDays = this.totalDays.slice(0, this.currentLoadedIndex);
    } else {
      this.visibleDays = [];
      this.currentLoadedIndex = 0;
      this.loadNextChunk(5); // Load first 5 days immediately
    }
  }

  loadNextChunk(chunkSize: number = 5) {
    if (this.currentLoadedIndex >= this.totalDays.length) {
      return;
    }
    const nextIndex = Math.min(this.currentLoadedIndex + chunkSize, this.totalDays.length);
    const chunk = this.totalDays.slice(this.currentLoadedIndex, nextIndex);
    this.visibleDays = [...this.visibleDays, ...chunk];
    this.currentLoadedIndex = nextIndex;
  }

  onLoadMore(event: any) {
    setTimeout(() => {
      this.loadNextChunk(10);
      event.target.complete();
    }, 100);
  }


 changeMonth(offset: number) {
  const newDate = moment(this.viewedMonth + '-01').add(offset, 'months');
  const today = moment();

  // 1. 如果是往後切換（下一月），必須檢查是否超過今天
  if (offset > 0 && newDate.isAfter(today, 'month')) {
    return;
  }

  // 2. 如果是往前切換（上一月），則不限制（或者你可以設定一個起始年份限制）
  this.viewedMonth = newDate.format('YYYY-MM');
  this.renderAccountDetail(); // 或 renderHome()
}

  onMonthPickerChange(event: any) {
    const val = event.detail.value;
    if (val) {
      this.viewedMonth = val.substring(0, 7);
      this.renderAccountDetail();
    }
  }

  getAccount() {
    return this.financeVar.getAppData().accounts.find(a => a.id === this.accountId);
  }

  calculateDailyGroupedData() {
    return this.financeService.calculateDailyGroupedData(this.viewedMonth, 'account', this.accountId);
  }

  formatMonthView() {
    return this.financeService.formatMonthView(this.viewedMonth);
  }

  getAccBalance() {
    return this.financeService.getAccBalance(this.accountId);
  }

  getToday() {
    return this.financeService.getToday();
  }

  async openAddForm() {
    try {
      const modal = await this.modalController.create({
        component: AddTransactionPagePage,
        componentProps: {
          accountId: this.accountId,
          context: 'account',
          viewedMonth: this.viewedMonth
        },
        cssClass: 'add-transaction-modal'
      });
      
      await modal.present();
      
      const { data } = await modal.onWillDismiss();
      if (data) {
        if (data.navigateToAutoUpload) {
          // Navigate to auto upload page
          this.router.navigate(['/auto-upload-receipt']);
        } else {
          console.log('Transaction saved:', data);
          const isSameMonth = data.transaction && data.transaction.date.substring(0, 7) === this.viewedMonth;
          const shouldPreventReset = data.success && (isSameMonth || data.deleted);
          this.renderAccountDetail(shouldPreventReset);
        }
      }
    } catch (error) {
      console.error('Error opening add transaction modal:', error);
    }
  }

  async editAccount() {
    const modal = await this.modalController.create({
      component: EditAccountModalPage,
      componentProps: {
        accountId: this.accountId,
        isEditMode: true
      }
    });
    await modal.present();
    const { data } = await modal.onWillDismiss();
    if (data?.success) {
      // Account updated successfully
      this.renderAccountDetail();
    }
  }

  goBack() {
    this.router.navigate(['/accounts']);
  }

  async editTransaction(transactionId: string) {
    try {
      const modal = await this.modalController.create({
        component: AddTransactionPagePage,
        componentProps: {
          transactionId: transactionId,
          accountId: this.accountId,
          context: 'account'
        },
        cssClass: 'add-transaction-modal'
      });
      
      await modal.present();
      
      const { data } = await modal.onWillDismiss();
      if (data) {
        if (data.navigateToAutoUpload) {
          // Navigate to auto upload page
          this.router.navigate(['/auto-upload-receipt']);
        } else {
          console.log('Transaction updated:', data);
          const isSameMonth = data.transaction && data.transaction.date.substring(0, 7) === this.viewedMonth;
          const shouldPreventReset = data.success && (isSameMonth || data.deleted);
          this.renderAccountDetail(shouldPreventReset);
        }
      }
    } catch (error) {
      console.error('Error opening edit transaction modal:', error);
    }
  }

  async copyTransaction(transactionId: string) {
    try {
      const modal = await this.modalController.create({
        component: AddTransactionPagePage,
        componentProps: {
          transactionId: transactionId,
          accountId: this.accountId,
          context: 'account',
          isCopyMode: true
        },
        cssClass: 'add-transaction-modal'
      });
      
      await modal.present();
      
      const { data } = await modal.onWillDismiss();
      if (data) {
        if (data.navigateToAutoUpload) {
          this.router.navigate(['/auto-upload-receipt']);
        } else {
          console.log('Transaction copied and saved:', data);
          const isSameMonth = data.transaction && data.transaction.date.substring(0, 7) === this.viewedMonth;
          const shouldPreventReset = data.success && (isSameMonth || data.deleted);
          this.renderAccountDetail(shouldPreventReset);
        }
      }
    } catch (error) {
      console.error('Error opening add transaction modal in copy mode:', error);
    }
  }

  formatDate(dateStr: string): string {
    return dateStr.replace(/-/g, '/');
  }
 

  async confirmDelete(id: string) {
    console.log('Request to delete transaction with id:', id);
    const alert = await this.alertController.create({
      header: '確認刪除',
      message: '此交易紀錄將會被移除，確定嗎？',
      buttons: [
        { text: '取消', role: 'cancel' },
        { 
          text: '刪除', 
          role: 'destructive',
          handler: () => {
            this.financeVar.deleteTransaction(id);
            this.renderAccountDetail(true);
          }
        }
      ]
    });
    await alert.present();
  }
}