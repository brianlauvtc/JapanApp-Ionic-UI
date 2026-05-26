import { Component, OnInit } from '@angular/core';
import { Router } from '@angular/router';
import { AlertController, LoadingController } from '@ionic/angular';
import { Camera, Photo } from '@capacitor/camera';
import { AIService } from '../service/ai.service';
import { FinanceVarService } from '../service/finance-var.service';

interface ExtractedTransaction {
  amount: number;
  currency: string;
  category: string;
  date: string;
  note: string;
  items?: Array<{ name: string; quantity: number; price: number }>;
}

@Component({
  selector: 'app-ai-processing',
  templateUrl: './ai-processing.page.html',
  styleUrls: ['./ai-processing.page.scss']
})
export class AIProcessingPage implements OnInit {
  processingImages: Photo[] = [];
  extractedTransactions: ExtractedTransaction[] = [];
  currentImageIndex: number = 0;
  totalImages: number = 0;
  hasApiKey: boolean = false;

  constructor(
    private router: Router,
    private alertController: AlertController,
    private loadingController: LoadingController,
    private aiService: AIService,
    private financeVar: FinanceVarService
  ) {}

  ngOnInit() {
    const navigation = this.router.getCurrentNavigation();
    const state = navigation?.extras?.state as { images: Photo[] };
    
    if (state && state.images) {
      this.processingImages = state.images;
      this.totalImages = this.processingImages.length;
      this.hasApiKey = !!this.financeVar.getAppData().settings.apiKey;
      
      if (!this.hasApiKey) {
        this.showError('No API Key', 'Please set your Gemini API key in Settings.');
        return;
      }
      
      this.processNextImage();
    } else {
      this.showError('No Images', 'No images were provided for processing.');
    }
  }

  async processNextImage() {
    if (this.currentImageIndex >= this.processingImages.length) {
      // All images processed, navigate to confirmation
      this.navigateToConfirmation();
      return;
    }

    const loading = await this.loadingController.create({
      message: `Processing receipt ${this.currentImageIndex + 1} of ${this.totalImages}...`,
      duration: 30000
    });
    await loading.present();

    try {
      const photo = this.processingImages[this.currentImageIndex];
      const extractedData = await this.extractTransactionFromImage(photo);
      
      if (extractedData) {
        this.extractedTransactions.push(extractedData);
      } else {
        // Handle case where extraction failed
        const fallbackTransaction: ExtractedTransaction = {
          amount: 0,
          currency: 'HKD',
          category: 'Other',
          date: new Date().toISOString().split('T')[0],
          note: 'Failed to extract data - please edit manually'
        };
        this.extractedTransactions.push(fallbackTransaction);
      }
      
      this.currentImageIndex++;
      await loading.dismiss();
      this.processNextImage(); // Process next image
      
    } catch (error) {
      console.error('Error processing image:', error);
      await loading.dismiss();
      this.showError('Processing Error', 'Failed to process receipt. Please try again.');
    }
  }

  async extractTransactionFromImage(photo: Photo): Promise<ExtractedTransaction | null> {
    try {
      // For now, we'll simulate the AI response since actual image processing 
      // with Gemini would require base64 encoding and proper API setup
      // In a real implementation, you'd convert the image to base64 and send to Gemini
      
      // Simulate AI extraction with mock data
      const mockResponse: ExtractedTransaction = {
        amount: Math.floor(Math.random() * 1000) + 10,
        currency: Math.random() > 0.5 ? 'HKD' : 'JPY',
        category: ['Food', 'Transport', 'Shopping', 'Entertainment'][Math.floor(Math.random() * 4)],
        date: new Date(Date.now() - Math.floor(Math.random() * 7) * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
        note: `Receipt from ${['Restaurant', 'Store', 'Taxi', 'Online Shop'][Math.floor(Math.random() * 4)]}`
      };
      
      // In real implementation, you would:
      // 1. Convert photo to base64
      // 2. Send to Gemini API with appropriate prompt
      // 3. Parse JSON response
      
      return mockResponse;
      
    } catch (error) {
      console.error('AI extraction error:', error);
      return null;
    }
  }

  async navigateToConfirmation() {
    if (this.extractedTransactions.length === 0) {
      this.showError('No Data', 'No transaction data was extracted from the receipts.');
      return;
    }

    // Navigate to confirmation page with extracted transactions
    this.router.navigate(['/receipt-confirmation'], {
      state: { transactions: this.extractedTransactions }
    });
  }

  async showError(header: string, message: string) {
    const alert = await this.alertController.create({
      header: header,
      message: message,
      buttons: [{
        text: 'OK',
        handler: () => {
          this.router.navigate(['/add-transaction']);
        }
      }]
    });
    await alert.present();
  }

  goBack() {
    this.router.navigate(['/auto-upload-receipt']);
  }
}