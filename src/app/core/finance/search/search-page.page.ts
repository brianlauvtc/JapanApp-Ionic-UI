import { Component, OnInit } from '@angular/core';

@Component({
  selector: 'app-search-page',
  templateUrl: './search-page.page.html',
  styleUrls: ['./search-page.page.scss'],
})
export class SearchPage implements OnInit {

  constructor() { }

  ngOnInit() {
  }

  onSearch(query: string) {
    console.log('Search query:', query);
  }
}
