import { Component, OnInit, OnDestroy } from '@angular/core';
import { Router } from '@angular/router';
import { ModalController } from '@ionic/angular';
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

  constructor(
    private financeVar: FinanceVarService,
    private financeService: FinanceService,
    private router: Router,
    private modalController: ModalController
  ) {}

  ngOnInit() {
    this.viewedMonth = moment().format('YYYY-MM');
    this.today = this.financeService.getToday();
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
    const data = this.financeService.calculateDailyGroupedData(this.viewedMonth, 'home');
    const netWorth = this.financeService.getNetWorth();
    
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
  }

  changeMonth(offset: number) {
    const newDate = moment(this.viewedMonth + '-01').add(offset, 'months');
    const today = moment();
    
    if (newDate.isAfter(today, 'month')) {
      return; // Don't allow future months
    }
    
    this.viewedMonth = newDate.format('YYYY-MM');
    this.renderHome();
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
}