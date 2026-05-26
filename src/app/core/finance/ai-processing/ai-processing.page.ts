import { Component, OnInit } from '@angular/core';
import { Router } from '@angular/router';
import { AlertController } from '@ionic/angular';
import { Photo } from '@capacitor/camera';
import { HttpClient } from '@angular/common/http';
import { FinanceVarService } from '../service/finance-var.service';

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

  constructor(
    private router: Router,
    private alertCtrl: AlertController,
    private http: HttpClient,
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

  /*async processImageAtIndex(index: number) {
    if (index >= this.processingImages.length) {
      // All items parsed! Route back directly to add-transaction with results data
      this.router.navigate(['/add-transaction'], {
        state: { aiExtractedData: this.extractedTransactions },
        replaceUrl: true
      });
      return;
    }

    try {
      const activePhoto = this.processingImages[index];
      const base64Data = await this.convertPhotoToBase64(activePhoto);
      const parsedResults = await this.callGeminiVisionAPI(base64Data);
      
      if (parsedResults && parsedResults.length > 0) {
        parsedResults.forEach((tx: any) => {
          this.extractedTransactions.push({
            amount: tx.amount || 0,
            currency: tx.currency || 'HKD',
            category: tx.category || 'Other',
            date: tx.date || new Date().toISOString().split('T')[0],
            note: tx.note || '',
            items: tx.items || [] // Maps perfectly into your TransactionItem[] interface
          });
        });
      } else {
        this.pushFallbackRecord();
      }
    } catch (err) {
      console.error('Operational processing failure at index: ' + index, err);
      this.pushFallbackRecord();
    }

    this.currentImageIndex++;
    await this.processImageAtIndex(this.currentImageIndex);
  }*/


  async processImageAtIndex(index: number) {
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
  }
  
  private generateMockReceiptData(index: number) {
    const merchants = ['AEON Supermarket', '7-Eleven', '松屋 (Matsuya)', 'Muji', 'JR East Ticket Counter'];
    const currencies = ['HKD', 'JPY'];
    // Using categories present in your getCategories() list
    const explicitCategories = ['飲食', '日用', '交通', '娛樂', '其他']; 
    
    const selectedMerchant = merchants[Math.floor(Math.random() * merchants.length)];
    const selectedCurrency = currencies[Math.floor(Math.random() * currencies.length)];
    const selectedCategory = explicitCategories[Math.floor(Math.random() * explicitCategories.length)];

    // Generate random items array matching TransactionItem
    const sampleItemsPool = [
      { name: 'Apple', priceRange: [10, 20] },
      { name: 'Pineapple', priceRange: [25, 50] },
      { name: 'Green Tea', priceRange: [12, 16] },
      { name: 'Bento Box', priceRange: [45, 90] },
      { name: 'Charging Cable', priceRange: [60, 120] }
    ];

    const itemsCount = Math.floor(Math.random() * 3) + 1; // 1 to 3 random items
    const structuredItems: any[] = [];
    let totalCalculatedAmount = 0;

    for (let i = 0; i < itemsCount; i++) {
      const poolItem = samplePoolItem(sampleItemsPool, structuredItems);
      const quantity = Math.floor(Math.random() * 3) + 1;
      const unitPrice = Math.floor(Math.random() * (poolItem.priceRange[1] - poolItem.priceRange[0] + 1)) + poolItem.priceRange[0];
      
      structuredItems.push({
        name: poolItem.name,
        quantity: quantity,
        price: unitPrice // TransactionItem mapping
      });

      totalCalculatedAmount += (quantity * unitPrice);
    }

    function samplePoolItem(pool: any[], existing: any[]) {
      // Pick an item from pool that hasn't been added yet if possible
      const available = pool.filter(p => !existing.some(e => e.name === p.name));
      const targetPool = available.length > 0 ? available : pool;
      return targetPool[Math.floor(Math.random() * targetPool.length)];
    }

    return {
      amount: totalCalculatedAmount, // Calculated Grand Total
      currency: selectedCurrency,
      category: selectedCategory,
      date: new Date().toISOString().split('T')[0], // Today's date
      note: `${selectedMerchant} (Receipt Mock #${index + 1})`,
      items: structuredItems
    };
  }

 
  private pushFallbackRecord() {
    this.extractedTransactions.push({
      amount: 0,
      currency: 'HKD',
      category: 'Other',
      date: new Date().toISOString().split('T')[0],
      note: 'Parsing error - please check details manually',
      items: []
    });
  }

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

  private async callGeminiVisionAPI(base64Image: string): Promise<any[] | null> {
    const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${this.apiKey}`;
    
    // Prompt structure referencing the schema guidelines outlined above
    const promptText = `You are an expert financial ledger accountant. Analyze the provided expense receipt image carefully.
  
      Perform the following steps:
      1. Extract all individual line items (name, quantity, price per item) into the "items" array.
      2. Extract the grand total final price as "amount".
      3. Determine the currency ("HKD" or "JPY"). Default to "HKD" if undetermined.
      4. Categorize the transaction into exactly one of these expense categories matching the application: 
         ["Food", "Transport", "Shopping", "Entertainment", "Housing", "Medical", "Education", "Gift", "Travel", "Other"].
      5. Parse the transaction date in "YYYY-MM-DD" format. Fallback to today's date if missing.
      6. Write a concise merchant name or summary as the "note".
    
      You must respond with a strictly valid JSON array of objects representing the transactions (even if there is only 1 receipt, wrap it inside an array). Match this structure:
      [
        {
          "amount": number (The final total price of the receipt),
          "currency": "HKD" | "JPY",
          "category": string (One of the permitted categories listed above),
          "date": "YYYY-MM-DD",
          "note": "Merchant Name or summary note",
          "items": [
            {
              "name": string (Item name),
              "quantity": number,
              "price": number (Unit price of a single unit)
            }
          ]
        }
      ]
    
      CRITICAL RULES:
      - Do not include markdown code block syntax (like \`\`\`json ... \`\`\`).
      - Do not include any conversational text outside the raw JSON array string.
      - 1 receipt = 1 transaction entry object inside the array.`; 

    const requestPayload = {
      contents: [{
        parts: [
          { text: promptText },
          {
            inlineData: {
              mimeType: 'image/jpeg',
              data: base64Image
            }
          }
        ]
      }]
    };

    try {
      const apiResponse: any = await this.http.post(url, requestPayload).toPromise();
      const rawTextResponse = apiResponse?.candidates?.[0]?.content?.parts?.[0]?.text || '';
      const cleanTarget = rawTextResponse.replace(/```json/gi, '').replace(/```/g, '').trim();
      const parsedData = JSON.parse(cleanTarget);
      return Array.isArray(parsedData) ? parsedData : [parsedData];
    } catch (e) {
      console.error('API integration stream runtime parsing exception:', e);
      return null;
    }
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