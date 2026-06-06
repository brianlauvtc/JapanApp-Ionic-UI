import { Component, OnInit, ViewChild } from '@angular/core';
import { AnalysisStatisticsComponent } from '../components/analysis-statistics/analysis-statistics.component';

@Component({
  selector: 'app-analysis-page',
  templateUrl: './analysis-page.page.html',
  styleUrls: ['./analysis-page.page.scss']
})
export class AnalysisPagePage implements OnInit {
  @ViewChild(AnalysisStatisticsComponent) statsComponent!: AnalysisStatisticsComponent;
  aiTab: 'stats_ai' | 'plans' = 'stats_ai';

  constructor() {}

  ngOnInit() {}

  ionViewDidEnter() {
    if (this.statsComponent) {
      this.statsComponent.ionViewDidEnter();
    }
  }

  switchTab(tab: 'stats_ai' | 'plans') {
    this.aiTab = tab;
    if (tab === 'stats_ai') {
      setTimeout(() => {
        if (this.statsComponent) {
          this.statsComponent.ionViewDidEnter();
        }
      }, 50);
    }
  }
}