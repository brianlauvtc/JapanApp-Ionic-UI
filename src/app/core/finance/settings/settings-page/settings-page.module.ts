import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule, ReactiveFormsModule } from '@angular/forms';
import { IonicModule } from '@ionic/angular';
import { SettingsPagePage } from './settings-page.page';
import { SettingsPageRoutingModule } from './settings-page-routing.module';

@NgModule({
  imports: [
    CommonModule,
    FormsModule,
    ReactiveFormsModule,
    IonicModule,
    SettingsPageRoutingModule
  ],
  declarations: [SettingsPagePage]
})
export class SettingsPageModule { }