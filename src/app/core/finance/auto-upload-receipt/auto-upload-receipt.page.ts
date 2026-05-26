import { Component, OnInit } from '@angular/core';
import { Router } from '@angular/router';
import { ActionSheetController, AlertController, LoadingController } from '@ionic/angular';
import { Camera, CameraResultType, CameraSource, Photo } from '@capacitor/camera';
import { FinanceVarService } from '../service/finance-var.service';

@Component({
  selector: 'app-auto-upload-receipt',
  templateUrl: './auto-upload-receipt.page.html',
  styleUrls: ['./auto-upload-receipt.page.scss']
})
export class AutoUploadReceiptPage implements OnInit {
  selectedImages: Photo[] = [];
  hasApiKey: boolean = false;

  constructor(
    private router: Router,
    private actionSheetCtrl: ActionSheetController,
    private alertCtrl: AlertController,
    private loadingCtrl: LoadingController,
    private financeVar: FinanceVarService
  ) {}

  ngOnInit() {
    this.checkApiKeyValidity();
  }

  ionViewWillEnter() {
    this.checkApiKeyValidity();
  }

  private checkApiKeyValidity() {
    this.hasApiKey = !!this.financeVar.getAppData()?.settings?.apiKey;
  }

  async selectImageSource() {
    if (!this.hasApiKey) {
      this.showNoApiKeyAlert();
      return;
    }

    const actionSheet = await this.actionSheetCtrl.create({
      header: 'Capture or Choose Expense Receipt',
      cssClass: 'custom-action-sheet',
      buttons: [
        {
          text: 'Snap Photo',
          icon: 'camera',
          handler: () => { this.capturePhoto(CameraSource.Camera); }
        },
        {
          text: 'Browse Photo Gallery',
          icon: 'images',
          handler: () => { this.capturePhoto(CameraSource.Photos); }
        },
        {
          text: 'Dismiss',
          icon: 'close',
          role: 'cancel'
        }
      ]
    });
    await actionSheet.present();
  }

  async capturePhoto(sourceType: CameraSource) {
    try {
      const photo = await Camera.getPhoto({
        resultType: CameraResultType.Uri,
        source: sourceType,
        quality: 85,
        allowEditing: false
      });
      
      if (photo) {
        this.selectedImages.push(photo);
      }
    } catch (error: any) {
      console.error('Image capture source execution issue:', error);
      if (error?.message !== 'User cancelled photos app') {
        const alert = await this.alertCtrl.create({
          header: 'Input Source Error',
          message: 'Unable to safely obtain the chosen asset. Please try again.',
          buttons: ['OK']
        });
        await alert.present();
      }
    }
  }

  removeImage(index: number) {
    this.selectedImages.splice(index, 1);
  }

  async processImages() {
    if (this.selectedImages.length === 0) return;

    const loader = await this.loadingCtrl.create({
      message: 'Preparing structural asset streams...',
      spinner: 'crescent',
      cssClass: 'custom-loading'
    });
    await loader.present();

    try {
      // Direct pass to stateful sequential handling processor
      this.router.navigate(['/ai-processing'], {
        state: { images: this.selectedImages }
      });
    } catch (err) {
      console.error('State routing context setup exception:', err);
    } finally {
      await loader.dismiss();
    }
  }

  async showNoApiKeyAlert() {
    const alert = await this.alertCtrl.create({
      header: 'Gemini Credentials Required',
      message: 'Feature locked. Provide a runtime Google Generative AI API client token within your standard profile configuration setup.',
      buttons: ['Understand']
    });
    await alert.present();
  }
}