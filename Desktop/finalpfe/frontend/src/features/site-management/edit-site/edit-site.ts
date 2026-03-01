import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormGroup, Validators, ReactiveFormsModule } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';

@Component({
  selector: 'app-edit-site',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule],
  templateUrl: './edit-site.html',
  styleUrl: './edit-site.css',
})
export class EditSiteComponent implements OnInit {

  siteForm!: FormGroup;
  siteId!: string;
  loading = false;

  constructor(
    private fb: FormBuilder,
    private route: ActivatedRoute,
    private router: Router
  ) {}

  ngOnInit(): void {
    this.siteId = this.route.snapshot.paramMap.get('id')!;
    
    this.siteForm = this.fb.group({
      name: ['', Validators.required],
      code: ['', Validators.required],
      region: [''],
      country: [''],
      location: [''],
      description: ['']
    });

    
  }

  onSubmit() {
    if (this.siteForm.invalid) return;

    this.loading = true;

    // 👉 appel API update ici
    console.log(this.siteForm.value);

    setTimeout(() => {
      this.loading = false;
      this.router.navigate(['/sites']);
    }, 1000);
  }

  cancel() {
    this.router.navigate(['/sites']);
  }
}