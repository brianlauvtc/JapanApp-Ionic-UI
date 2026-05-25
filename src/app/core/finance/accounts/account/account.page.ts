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
  selector: 'app-account-',
  templateUrl: './account.page.html',
  styleUrls: ['./account.page.scss']
})
export class AccountPage implements OnInit {


  constructor(
    private route: ActivatedRoute,
    private router: Router,
    private modalController: ModalController,
    private financeVar: FinanceVarService,
    private financeService: FinanceService
  ) {}

  ngOnInit() {
 
  }

}