import { Component, OnInit } from '@angular/core';
import { ModalController } from '@ionic/angular';

@Component({
  selector: 'app-add-recurring-modal',
  templateUrl: './add-recurring-modal.component.html',
  styleUrls: ['./add-recurring-modal.component.scss'],
})
export class AddRecurringModalComponent implements OnInit {

  constructor(private modalCtrl: ModalController) { }

  ngOnInit() {}

  dismiss() {
    this.modalCtrl.dismiss();
  }
}
