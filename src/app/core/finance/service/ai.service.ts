import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, of } from 'rxjs';
import { catchError, map } from 'rxjs/operators';
import { FinanceVarService } from './finance-var.service';

@Injectable({
  providedIn: 'root'
})
export class AIService {
  private readonly GEMINI_API_URL = 'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent';

  constructor(
    private http: HttpClient,
    private financeVar: FinanceVarService
  ) {}

  analyzeFinancialData(prompt: string = "分析本月花費是否合理並簡短給出建議"): Observable<string> {
    const apiKey = this.financeVar.getAppData().settings.apiKey;
    if (!apiKey) {
      return of('請先設定 Gemini API Key');
    }

    const url = `${this.GEMINI_API_URL}?key=${apiKey}`;
    
    const requestBody = {
      contents: [{
        parts: [{
          text: prompt
        }]
      }]
    };

    return this.http.post<any>(url, requestBody).pipe(
      map(response => {
        if (response.candidates && response.candidates[0]?.content?.parts?.[0]?.text) {
          return response.candidates[0].content.parts[0].text;
        }
        return '分析完成，但未收到有效回應';
      }),
      catchError(error => {
        console.error('AI Analysis error:', error);
        return of('AI 分析失敗，請檢查 API Key 或網路連線');
      })
    );
  }
}