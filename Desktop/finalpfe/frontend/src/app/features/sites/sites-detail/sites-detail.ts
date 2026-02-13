import { Component, OnInit, signal } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { SitesService } from '../sites.service';
import { Site } from '../models/site.model';
import { CommonModule } from '@angular/common';
@Component({
  selector: 'app-sites-detail',
  imports: [CommonModule],
  templateUrl: './sites-detail.html',
  styleUrls: ['./sites-detail.css']
})
export class SitesDetailComponent implements OnInit {
  siteId!: number;
  site = signal<Site | undefined>(undefined);

  constructor(private route: ActivatedRoute, private sitesService: SitesService) {}

  ngOnInit(): void {
    // Get the ID from route
    this.siteId = +this.route.snapshot.paramMap.get('id')!;

    // Fetch the site
    const found = this.sitesService.getSiteById(this.siteId);

    // Set the signal (no parentheses!)
    this.site.set(found);
  }
}
