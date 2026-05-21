import { Component } from '@angular/core';
import { Router } from '@angular/router';

@Component({
  selector: 'app-main',
  templateUrl: './main.page.html',
  styleUrls: ['./main.page.scss']
})
export class MainPage {
  currentView = 'home';

  constructor(private router: Router) {}

  switchView(view: string) {
    this.currentView = view;
    this.router.navigate([view]);
  }

  isActive(view: string): boolean {
    return this.currentView === view;
  }
}