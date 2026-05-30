import { Component, OnInit } from '@angular/core';
import { Router } from '@angular/router';
import { AlertController } from '@ionic/angular';
import { Photo } from '@capacitor/camera';
import { HttpClient } from '@angular/common/http';
import { FinanceVarService } from '../service/finance-var.service';
import { AIService } from '../service/ai.service';
import { CATEGORY_MAP } from '../../../../environments/categories';


@Component({
  selector: 'app-ai-processing',
  templateUrl: './ai-processing.page.html',
  styleUrls: ['./ai-processing.page.scss']
})
export class AIProcessingPage implements OnInit {
  processingImages: Photo[] = [];
  extractedTransactions: any[] = []; 
  currentImageIndex: number = 0;
  totalImages: number = 0;
  private apiKey: string = '';
  isProcessing: boolean = false;


  constructor(
    private router: Router,
    private alertCtrl: AlertController,
    private aiService: AIService,
    private financeVar: FinanceVarService
  ) {}

  ngOnInit() {
    const navigation = this.router.getCurrentNavigation();
    const state = navigation?.extras?.state as { images: Photo[] };
    
    if (state && state.images && state.images.length > 0) {
      this.processingImages = state.images;
      this.totalImages = this.processingImages.length;
      this.apiKey = this.financeVar.getAppData()?.settings?.apiKey || '';
      
      if (!this.apiKey) {
        this.showError('Authentication Failure', 'Gemini API key configuration setup is missing.');
        return;
      }
      
      this.startSequentialProcessing();
    } else {
      this.showError('No Assets Found', 'No receipt images were provided for analysis.');
    }
  }

  async startSequentialProcessing() {
    this.extractedTransactions = [];
    this.currentImageIndex = 0;
    await this.processImageAtIndex(this.currentImageIndex);
  }

  async processImageAtIndex(index: number) {
    if (index >= this.processingImages.length) {
      // All items parsed! Route back directly to add-transaction with results data
      this.router.navigate(['/add-transaction'], {
        state: { aiTransactions    : this.extractedTransactions },
        replaceUrl: true
      });
      return;
    }

    this.isProcessing = true;
    try {
      const activePhoto = this.processingImages[index];
      const base64Data = await this.convertPhotoToBase64(activePhoto);
      const parsedResults = await this.aiService.analyzeReceiptImage(base64Data);
     

      if (parsedResults && parsedResults.length > 0) {
        
        parsedResults.forEach((tx: any) => {
          const mappedCategoryName = CATEGORY_MAP[tx.category] || '其他';
          this.extractedTransactions.push({
            amount: tx.amount || 0,
            currency: tx.currency || 'HKD',
            category: mappedCategoryName,
            exchangeRate: tx.exchangeRate || tx.exRate || null,
            date: tx.date || new Date().toISOString().split('T')[0],
            note: tx.note || '',
            items: tx.items || [] // Maps perfectly into your TransactionItem[] interface
          });
        });
        console.log(`✅ Successfully processed image ${index + 1}/${this.totalImages}`);
        console.log('Extracted Transaction Data:', this.extractedTransactions);
      } else {
        //this.pushFallbackRecord();       
        await this.showError(
          'AI Processing Error', 
          'No valid transactions parsed from the API.'
        );
        
      }
    } catch (err) {
      console.error('Operational processing failure at index: ' + index, err);
      await this.showError(
          'AI Processing Error', 
          'There was a problem analyzing your receipt. The process has been canceled. Please try again later.'
        );
      //this.pushFallbackRecord();
      this.isProcessing = false;
    }

    this.currentImageIndex++;
    await this.processImageAtIndex(this.currentImageIndex);
  }


  /*async processImageAtIndex(index: number) {
    if (index >= this.processingImages.length) {
      // Send the structured mock array back to add-transaction
      this.router.navigate(['/add-transaction'], {
        state: { aiTransactions: this.extractedTransactions },
        replaceUrl: true
      });
      return;
    }

    try {
      // Simulate network/processing delay for visual aesthetics
      await new Promise(resolve => setTimeout(resolve, 1500));
      
      // Generate randomized structured mock data matching Transaction and TransactionItem
      const mockResult = this.generateMockReceiptData(index);
      this.extractedTransactions.push(mockResult);

    } catch (err) {
      console.error('Operational processing failure at index: ' + index, err);
      this.extractedTransactions.push({
        amount: 0,
        currency: 'HKD',
        category: '其他',
        date: new Date().toISOString().split('T')[0],
        note: 'Mock Error Fallback',
        items: []
      });
    }

    this.currentImageIndex++;
    await this.processImageAtIndex(this.currentImageIndex);
  }/*/
  
 
  private async convertPhotoToBase64(photo: Photo): Promise<string> {
    if (!photo.webPath) throw new Error('Binary asset path components missing runtime references');
    const response = await fetch(photo.webPath);
    const blob = await response.blob();
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onloadend = () => {
        const base64String = reader.result as string;
        resolve(base64String.split(',')[1]);
      };
      reader.onerror = reject;
      reader.readAsDataURL(blob);
    });
  }
 
  async showError(header: string, message: string) {
    const alert = await this.alertCtrl.create({
      header,
      message,
      buttons: [{
        text: 'OK',
        handler: () => { this.router.navigate(['/add-transaction'], { replaceUrl: true }); }
      }]
    });
    await alert.present();
  }
}