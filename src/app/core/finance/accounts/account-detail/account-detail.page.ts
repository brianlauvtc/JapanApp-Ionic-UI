import { Component, OnInit } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { ModalController } from '@ionic/angular';
import { FinanceVarService } from '../../service/finance-var.service';
import { FinanceService } from '../../service/finance.service';
import { ApexOptions } from 'ng-apexcharts';
import moment from 'moment';
import { currencies } from '../../environment/environment';
import { AddTransactionPagePage } from '../../add-transaction/add-transaction-page/add-transaction-page.page';
import { EditAccountModalPage } from '../edit-account-modal/edit-account-modal.page';

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

  constructor(
    private route: ActivatedRoute,
    private router: Router,
    private modalController: ModalController,
    private financeVar: FinanceVarService,
    private financeService: FinanceService
  ) {}

  ngOnInit() {
    //this.accountId = '' //this.route.snapshot.paramMap.get('id')!;
    //this.viewedMonth = moment().format('YYYY-MM');
    //this.today = this.financeService.getToday();
    //this.renderAccountDetail();
  }

  renderAccountDetail() {
    const data = this.financeService.calculateDailyGroupedData(this.viewedMonth, 'account', this.accountId);
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

  changeMonth(offset: number) {
    const newDate = moment(this.viewedMonth + '-01').add(offset, 'months');
    const today = moment();
    
    if (newDate.isAfter(today, 'month')) {
      return;
    }
    
    this.viewedMonth = newDate.format('YYYY-MM');
    this.renderAccountDetail();
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

  async openAddForm() {
    try {
      const modal = await this.modalController.create({
        component: AddTransactionPagePage,
        componentProps: {
          accountId: this.accountId,
          context: 'account'
        },
        cssClass: 'add-transaction-modal'
      });
      
      await modal.present();
      
      const { data } = await modal.onWillDismiss();
      if (data) {
        console.log('Transaction saved:', data);
        this.renderAccountDetail();
      }
    } catch (error) {
      console.error('Error opening add transaction modal:', error);
    }
  }

  async editAccount() {
    const modal = await this.modalController.create({
      component: 'app-edit-account-modal',
      componentProps: {
        accountId: this.accountId
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
        console.log('Transaction updated:', data);
        this.renderAccountDetail();
      }
    } catch (error) {
      console.error('Error opening edit transaction modal:', error);
    }
  }

  formatDate(dateStr: string): string {
    return dateStr.replace(/-/g, '/');
  }
}