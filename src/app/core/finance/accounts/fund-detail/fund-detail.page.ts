import { Component, OnInit, OnDestroy } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { AlertController, ModalController } from '@ionic/angular';
import { FinanceVarService } from '../../service/finance-var.service';
import { FinanceService } from '../../service/finance.service';
import { ApexOptions } from 'ng-apexcharts';
import moment from 'moment';
import { currencies } from '../../environment/environment';
import { AddTransactionPagePage } from '../../add-transaction/add-transaction-page/add-transaction-page.page';
import { EditFundModalPage } from '../edit-fund-modal/edit-fund-modal.page';
import { Subscription } from 'rxjs';

@Component({
  selector: 'app-fund-detail',
  templateUrl: './fund-detail.page.html',
  styleUrls: ['./fund-detail.page.scss']
})
export class FundDetailPage implements OnInit, OnDestroy {
  currencies = currencies;
  fundId!: string;
  viewedMonth: string = '';
  chartOptions: ApexOptions = {};
  chartSeries: any[] = [];
  today: string = '';
  baseCurrency: string = 'HKD';
  baseCurrencySymbol: string = '$';
  groupedData: any = { days: [] };
  fund: any = null;

  // Progressive loading variables
  visibleDays: any[] = [];
  totalDays: any[] = [];
  currentLoadedIndex = 0;
  private appDataSubscription!: Subscription;

  constructor(
    private route: ActivatedRoute,
    private router: Router,
    private modalController: ModalController,
    private alertController: AlertController,
    private financeVar: FinanceVarService,
    private financeService: FinanceService
  ) {}

  ngOnInit() {
    this.fundId = this.route.snapshot.paramMap.get('id')!;
    this.viewedMonth = moment().format('YYYY-MM');
    this.today = this.financeService.getToday();
    this.updateCurrencyInfo();
    this.renderFundDetail();

    this.appDataSubscription = this.financeVar.appData$.subscribe(() => {
      this.updateCurrencyInfo();
      this.renderFundDetail();
    });
  }

  ngOnDestroy() {
    if (this.appDataSubscription) {
      this.appDataSubscription.unsubscribe();
    }
  }

  private updateCurrencyInfo() {
    const appData = this.financeVar.getAppData();
    this.baseCurrency = appData.settings.baseCurrency;
    const currenciesObj = this.currencies as any;
    this.baseCurrencySymbol = currenciesObj[this.baseCurrency]?.symbol || '$';
  }

  renderFundDetail() {
    this.groupedData = this.financeService.calculateDailyGroupedData(this.viewedMonth, 'fund', this.fundId);
    const data = this.groupedData;
    const fund = this.financeVar.getAppData().funds.find(f => f.id === this.fundId);
    
    if (!fund) {
      this.router.navigate(['/accounts']);
      return;
    }
    this.fund = fund;
    
    // Update chart data
    const chartData = [{ date: `${this.viewedMonth}-01`, val: data.openBal }];
    data.days.forEach(dayGrp => {
      chartData.push({ date: dayGrp.date, val: dayGrp.endBal });
    });
    
    const sortedChartData = chartData.sort((a, b) => moment(a.date).diff(moment(b.date)));
    const labels = sortedChartData.map(d => moment(d.date).format('D'));
    const values = sortedChartData.map(d => d.val);
    
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
      colors: ['#10b981']
    };
    
    this.chartSeries = [{
      name: '基金餘額',
      data: values
    }];

    // Reset progressive chunk loader
    this.totalDays = this.groupedData.days || [];
    this.visibleDays = [];
    this.currentLoadedIndex = 0;
    this.loadNextChunk(5); // Load first 5 days immediately
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
    this.renderFundDetail(); // 或 renderHome()
  }

  onMonthPickerChange(event: any) {
    const val = event.detail.value;
    if (val) {
      this.viewedMonth = val.substring(0, 7);
      this.renderFundDetail();
    }
  }

  getFund() {
    return this.financeVar.getAppData().funds.find(f => f.id === this.fundId);
  }

  calculateDailyGroupedData() {
    return this.financeService.calculateDailyGroupedData(this.viewedMonth, 'fund', this.fundId);
  }

  formatMonthView() {
    return this.financeService.formatMonthView(this.viewedMonth);
  }

  getFundBalance() {
    return this.financeService.getFundBalanceUpTo(this.fundId);
  }

  getToday() {
    return this.financeService.getToday();
  }

  async openAddForm() {
    try {
      const modal = await this.modalController.create({
        component: AddTransactionPagePage,
        componentProps: {
          fundId: this.fundId,
          context: 'fund',
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
          this.renderFundDetail();
        }
      }
    } catch (error) {
      console.error('Error opening add transaction modal:', error);
    }
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
            this.renderFundDetail();
          }
        }
      ]
    });
    await alert.present();
  }

  async editFund() {
    const modal = await this.modalController.create({
      component: EditFundModalPage,
      componentProps: {
        fundId: this.fundId,
        isEditMode: true
      }
    });
    await modal.present();
    const { data } = await modal.onWillDismiss();
    if (data?.success) {
      // Fund updated successfully
      this.renderFundDetail();
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
          fundId: this.fundId,
          context: 'fund'
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
          this.renderFundDetail();
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
          fundId: this.fundId,
          context: 'fund',
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
          this.renderFundDetail();
        }
      }
    } catch (error) {
      console.error('Error opening add transaction modal in copy mode:', error);
    }
  }

  formatDate(dateStr: string): string {
    return dateStr.replace(/-/g, '/');
  }

  getDailyLimit(): number | null {
    const fund = this.getFund();
    if (!fund || !fund.hasDaily) return null;
    
    return this.financeService.getFundDailyLimitForDate(this.fundId, this.today);
  }
  getUnspentToday(): number | null {
    const fund = this.getFund();
    if (!fund || !fund.hasDaily) return null;

    const limit = this.getDailyLimit();
    if (limit === null) return null;
    
    const spent = this.financeService.getFundSpentOnDate(this.fundId, this.today);
    return limit - spent;
  }
  getCurrencySymbol(currency: string): string {
    const currenciesObj = {
      HKD: { symbol: '$', rate: 1, name: 'HKD' },
      JPY: { symbol: '¥', rate: 0.05, name: 'JPY' }
    };
    return currenciesObj[currency as keyof typeof currenciesObj]?.symbol || '$';
  }
}