import { Component, OnInit } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { ModalController } from '@ionic/angular';
import { FinanceVarService } from '../../service/finance-var.service';
import { FinanceService } from '../../service/finance.service';
import { ApexOptions } from 'ng-apexcharts';
import moment from 'moment';
import { currencies } from '../../environment/environment';
import { AddTransactionPagePage } from '../../add-transaction/add-transaction-page/add-transaction-page.page';
import { EditFundModalPage } from '../edit-fund-modal/edit-fund-modal.page';

@Component({
  selector: 'app-fund-detail',
  templateUrl: './fund-detail.page.html',
  styleUrls: ['./fund-detail.page.scss']
})
export class FundDetailPage implements OnInit {
  currencies = currencies;
  fundId!: string;
  viewedMonth: string = '';
  chartOptions: ApexOptions = {};
  chartSeries: any[] = [];
  today: string = '';
  baseCurrency: string = 'HKD';
  baseCurrencySymbol: string = '$';

  constructor(
    private route: ActivatedRoute,
    private router: Router,
    private modalController: ModalController,
    private financeVar: FinanceVarService,
    private financeService: FinanceService
  ) {}

  ngOnInit() {
    this.fundId = this.route.snapshot.paramMap.get('id')!;
    this.viewedMonth = moment().format('YYYY-MM');
    this.today = this.financeService.getToday();
    this.updateCurrencyInfo();
    this.renderFundDetail();
  }

  private updateCurrencyInfo() {
    const appData = this.financeVar.getAppData();
    this.baseCurrency = appData.settings.baseCurrency;
    const currenciesObj = this.currencies as any;
    this.baseCurrencySymbol = currenciesObj[this.baseCurrency]?.symbol || '$';
  }

  renderFundDetail() {
    const data = this.financeService.calculateDailyGroupedData(this.viewedMonth, 'fund', this.fundId);
    const fund = this.financeVar.getAppData().funds.find(f => f.id === this.fundId);
    
    if (!fund) {
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
  }

  changeMonth(offset: number) {
    const newDate = moment(this.viewedMonth + '-01').add(offset, 'months');
    const today = moment();
    
    if (newDate.isAfter(today, 'month')) {
      return;
    }
    
    this.viewedMonth = newDate.format('YYYY-MM');
    this.renderFundDetail();
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

  async openAddForm() {
    try {
      const modal = await this.modalController.create({
        component: AddTransactionPagePage,
        componentProps: {
          fundId: this.fundId,
          context: 'fund'
        },
        cssClass: 'add-transaction-modal'
      });
      
      await modal.present();
      
      const { data } = await modal.onWillDismiss();
      if (data) {
        console.log('Transaction saved:', data);
        this.renderFundDetail();
      }
    } catch (error) {
      console.error('Error opening add transaction modal:', error);
    }
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
        console.log('Transaction updated:', data);
        this.renderFundDetail();
      }
    } catch (error) {
      console.error('Error opening edit transaction modal:', error);
    }
  }

  formatDate(dateStr: string): string {
    return dateStr.replace(/-/g, '/');
  }
}