import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, of } from 'rxjs';
import { catchError, map } from 'rxjs/operators';
import { FinanceVarService } from './finance-var.service';
import { EXPENSE_CATEGORIES } from '../../../../environments/categories';

@Injectable({
  providedIn: 'root'
})
export class AIService {
  private readonly GEMINI_API_URL = 'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent';
  private apiKey: string = '';
  constructor(
    private http: HttpClient,
    private financeVar: FinanceVarService
  ) {

    this.apiKey = this.financeVar.getAppData()?.settings?.apiKey || '';
  }


  async analyzeReceiptImage(base64Image: string): Promise<any[] | null> {
    const apiKey = this.financeVar.getAppData().settings.apiKey;
    if (!apiKey) {
      throw new Error('API Key missing');
    }

    const url = `${this.GEMINI_API_URL}?key=${apiKey}`;
    const allExpenseCats = this.financeVar.getAllExpenseCategories();
    const categoryIdsPrompt = allExpenseCats.map(c => `"${c.id}"`).join(', ');
    // 🧠 優化的英文 Prompt：省 Token 且精準度更高，強制 category 輸出繁體中文
    const promptText = `You are an expert financial accountant. Analyze the provided receipt or credit card bill image.
  
      Perform these exact steps:
      1. Extract line items (name, quantity, price) into an "items" array.
      2. Extract the grand total as "amount" (number).
      3. Determine the "currency" ("HKD" or "JPY"). Default to "HKD".
      4. Extract the explicit foreign currency exchange rate as "exchangeRate" (number, max 4 decimal places) ONLY IF it is clearly printed on the bill. If not explicitly shown, omit this key entirely.
      5. Categorize the transaction into EXACTLY ONE of these category IDs: [${categoryIdsPrompt}]. Default to "other_expense" if unsure.
      6. Parse the transaction "date" (YYYY-MM-DD). Use today's date if missing.
      7. Write a short merchant name or summary as "note".

      Respond ONLY with a strictly valid JSON array (even for 1 receipt). Structure:
      [
        {
          "amount": number,
          "currency": "HKD" | "JPY",
          "category": "One of the exact Chinese strings above",
          "exchangeRate": number (optional, e.g., 0.0492),
          "date": "YYYY-MM-DD",
          "note": "Merchant name",
          "items": [
            { "name": "item", "quantity": 1, "price": 10 }
          ]
        }
      ]

      RULES:
      - NO markdown syntax (like \`\`\`json).
      - NO conversational text.
      - 1 receipt/bill = 1 object in the array.`; 

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
      if (apiResponse?.error) {
         throw new Error(apiResponse.error.message);
      }
      const rawTextResponse = apiResponse?.candidates?.[0]?.content?.parts?.[0]?.text || '';
      if (!rawTextResponse) {
          throw new Error('Empty response from Gemini API');
      }
      
      // 清理 Markdown 標記並解析 JSON
      const cleanTarget = rawTextResponse.replace(/```json/gi, '').replace(/```/g, '').trim();
      const parsedData = JSON.parse(cleanTarget);
      
      return Array.isArray(parsedData) ? parsedData : [parsedData];
    } catch (e) {
      console.error('API integration stream runtime parsing exception:', e);
      return null;
    }
  }

  async generateCategoryDetails(chineseName: string): Promise<{id: string, icon: string} | null> {
    const apiKey = this.financeVar.getAppData().settings.apiKey;
    if (!apiKey) return null;

    const url = `${this.GEMINI_API_URL}?key=${apiKey}`;
    const promptText = `You are a UI designer for an accounting app. The user is adding a new custom transaction category named "${chineseName}".
Generate a short English ID (lowercase, underscore separated, e.g. "fast_food", "game_topup") and exactly ONE most suitable emoji as the icon.
Respond ONLY with strictly valid JSON format: {"id": "english_id", "icon": "emoji"}`;

    try {
      const requestPayload = { contents: [{ parts: [{ text: promptText }] }] };
      const apiResponse: any = await this.http.post(url, requestPayload).toPromise();
      const rawText = apiResponse?.candidates?.[0]?.content?.parts?.[0]?.text || '';
      const cleanTarget = rawText.replace(/```json/gi, '').replace(/```/g, '').trim();
      return JSON.parse(cleanTarget);
    } catch (e) {
      console.error('AI Category Generation failed:', e);
      return null;
    }
  }
}