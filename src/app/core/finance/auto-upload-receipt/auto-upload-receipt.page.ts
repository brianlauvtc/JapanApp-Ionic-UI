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
    this.hasApiKey = !!this.financeVar.getAppData().settings.apiKey;
    if (!this.hasApiKey) {
      this.showNoApiKeyAlert();
    }
  }

  async showNoApiKeyAlert() {
    const alert = await this.alertCtrl.create({
      header: 'Gemini API Key Required',
      message: 'Please set your Gemini API key in Settings to use this feature.',
      buttons: ['OK']
    });
    await alert.present();
  }

  async selectImageSource() {
    if (!this.hasApiKey) {
      await this.showNoApiKeyAlert();
      return;
    }

    const actionSheet = await this.actionSheetCtrl.create({
      header: 'Select Image Source',
      buttons: [
        {
          text: 'Take Photo',
          icon: 'camera',
          handler: () => {
            this.takePhoto();
          }
        },
        {
          text: 'Choose from Gallery',
          icon: 'images',
          handler: () => {
            this.pickImages();
          }
        },
        {
          text: 'Done Adding Images',
          icon: 'checkmark-done',
          handler: () => {
            // Process all selected images
            this.processImages();
          }
        },
        {
          text: 'Cancel',
          icon: 'close',
          role: 'cancel'
        }
      ]
    });
    await actionSheet.present();
  }

  async takePhoto() {
    try {
      const photo = await Camera.getPhoto({
        resultType: CameraResultType.Uri,
        source: CameraSource.Camera,
        quality: 90
      });
      
      if (photo) {
        this.selectedImages.push(photo);
      }
    } catch (error) {
      console.error('Error taking photo:', error);
      const alert = await this.alertCtrl.create({
        header: 'Camera Error',
        message: 'Failed to take photo. Please try again.',
        buttons: ['OK']
      });
      await alert.present();
    }
  }

  async pickImages() {
    try {
      // Note: Capacitor Camera plugin doesn't support multiple selection natively
      // We'll implement single selection for now, user can add multiple images one by one
      const photo = await Camera.getPhoto({
        resultType: CameraResultType.Uri,
        source: CameraSource.Photos,
        quality: 90
      });
      
      if (photo) {
        this.selectedImages.push(photo);
      }
    } catch (error: any) {
      console.error('Error picking image:', error);
      if (error.message !== 'User cancelled photos app') {
        const alert = await this.alertCtrl.create({
          header: 'Gallery Error',
          message: 'Failed to select image. Please try again.',
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
    if (this.selectedImages.length === 0) {
      const alert = await this.alertCtrl.create({
        header: 'No Images Selected',
        message: 'Please select at least one receipt image to process.',
        buttons: ['OK']
      });
      await alert.present();
      return;
    }

    const loading = await this.loadingCtrl.create({
      message: 'Processing images...',
      duration: 10000
    });
    await loading.present();

    try {
      // Navigate to AI processing page with selected images
      // For now, we'll pass the image URIs as state
      this.router.navigate(['/ai-processing'], {
        state: { images: this.selectedImages }
      });
    } catch (error) {
      console.error('Error navigating to processing:', error);
      const alert = await this.alertCtrl.create({
        header: 'Navigation Error',
        message: 'Failed to start processing. Please try again.',
        buttons: ['OK']
      });
      await alert.present();
    } finally {
      await loading.dismiss();
    }
  }

  goBack() {
    this.router.navigate(['/add-transaction']);
  }
}