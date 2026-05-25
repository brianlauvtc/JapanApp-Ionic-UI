import { Component, OnInit, OnDestroy } from '@angular/core';
import { Router } from '@angular/router';
import { AlertController, ModalController } from '@ionic/angular';
import { FinanceVarService } from '../../service/finance-var.service';
import { FinanceService } from '../../service/finance.service';
import { Subscription } from 'rxjs';
import { ApexOptions } from 'ng-apexcharts';
import moment from 'moment';
import { currencies } from '../../environment/environment';
import { AddTransactionPagePage } from '../../add-transaction/add-transaction-page/add-transaction-page.page';

@Component({
  selector: 'app-home-page',
  templateUrl: './home-page.page.html',
  styleUrls: ['./home-page.page.scss']
})
export class HomePagePage implements OnInit, OnDestroy {
  private appDataSubscription!: Subscription;
  viewedMonth: string = '';
  chartOptions: ApexOptions = {};
  chartSeries: any[] = [];
  currencies = currencies;
  baseCurrency: string = 'HKD';
  baseCurrencySymbol: string = '$';
  today: string = '';
  isLoading: boolean = true;
  homeData: any = { days: [], openBal: 0, closeBal: 0, totalInc: 0, totalExp: 0 };
  netWorthData: any = { net: 0 };

  constructor(
    private financeVar: FinanceVarService,
    private financeService: FinanceService,
    private router: Router,
    private modalController: ModalController,
    private alertController: AlertController
  ) {}

  ngOnInit() {
    this.viewedMonth = moment().format('YYYY-MM');
    this.today = this.financeService.getToday();
    console.log(this.viewedMonth, this.today.substring(0, 7))
    
    this.updateCurrencyInfo();
    this.appDataSubscription = this.financeVar.appData$.subscribe(() => {
      this.updateCurrencyInfo();
      this.renderHome();
    });
    this.renderHome();
  }

  private updateCurrencyInfo() {
    const appData = this.financeVar.getAppData();
    this.baseCurrency = appData.settings.baseCurrency;
    const currenciesObj = this.currencies as any;
    this.baseCurrencySymbol = currenciesObj[this.baseCurrency]?.symbol || '$';
  }

  ngOnDestroy() {
    if (this.appDataSubscription) {
      this.appDataSubscription.unsubscribe();
    }
  }

  renderHome() {
    this.isLoading = true; // 開始載入

    setTimeout(() => {

      this.homeData = this.financeService.calculateDailyGroupedData(this.viewedMonth, 'home');
      this.netWorthData = this.financeService.getNetWorth();

      const chartData = [{ date: `${this.viewedMonth}-01`, val: this.homeData.openBal }];
      this.homeData.days.forEach((dayGrp: any) => {
        chartData.push({ date: dayGrp.date, val: dayGrp.endBal });
      });
      
      const sortedChartData = chartData.sort((a, b) => moment(a.date).diff(moment(b.date)));
      const labels = sortedChartData.map(d => moment(d.date).format('D'));
      const values = sortedChartData.map(d => d.val);
      
      this.chartOptions = {
        chart: {
          type: 'line',
          height: 80,
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
        name: '淨資產',
        data: values
      }];
      this.isLoading = false; // 載入完成
    }, 200); // 200 毫秒的延遲讓畫面有喘息空間
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
     this.renderHome(); // 或 renderHome()
   }

  getNetWorth() {
    return this.financeService.getNetWorth();
  }

  calculateDailyGroupedData() {
    return this.financeService.calculateDailyGroupedData(this.viewedMonth, 'home');
  }

  formatMonthView() {
    return this.financeService.formatMonthView(this.viewedMonth);
  }

  getToday() {
    return this.financeService.getToday();
  }

  async openAddForm() {
    try {
      const modal = await this.modalController.create({
        component: AddTransactionPagePage,
        cssClass: 'add-transaction-modal'
      });
      
      await modal.present();
      
      const { data, role } = await modal.onWillDismiss();
      if (data) {
        console.log('Transaction saved:', data);
        // Refresh the data
        this.renderHome();
      }
    } catch (error) {
      console.error('Error opening add transaction modal:', error);
    }
  }

  async editTransaction(transactionId: string) {
    try {
      const modal = await this.modalController.create({
        component: AddTransactionPagePage,
        componentProps: {
          transactionId: transactionId
        },
        cssClass: 'add-transaction-modal'
      });
      
      await modal.present();
      
      const { data, role } = await modal.onWillDismiss();
      if (data) {
        console.log('Transaction updated:', data);
        // Refresh the data
        this.renderHome();
      }
    } catch (error) {
      console.error('Error opening edit transaction modal:', error);
    }
  }

  formatDate(dateStr: string): string {
    return dateStr.replace(/-/g, '/');
  }

  async deleteTransaction(transactionId: string) {
    const alert = await this.alertController.create({
      header: '確認刪除',
      message: '您確定要刪除這筆交易紀錄嗎？',
      buttons: [
        {
          text: '取消',
          role: 'cancel',
          cssClass: 'secondary'
        },
        {
          text: '刪除',
          role: 'destructive', // 在 iOS 上會顯示為紅色字體
          handler: () => {
            // 呼叫您的 FinanceService 來執行真正的刪除邏輯
            // 假設您的 service 中有 deleteTransaction 或類似的方法
            this.financeVar.deleteTransaction(transactionId);
            
            // 刪除後重新渲染畫面
            this.renderHome();
          }
        }
      ]
    });

    await alert.present();
  }
}