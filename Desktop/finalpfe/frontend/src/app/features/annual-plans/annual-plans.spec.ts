import { ComponentFixture, TestBed } from '@angular/core/testing';

import { AnnualPlansComponent } from './annual-plans';

describe('AnnualPlansComponent', () => {
  let component: AnnualPlansComponent;
  let fixture: ComponentFixture<AnnualPlansComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [AnnualPlansComponent]
    })
    .compileComponents();

    fixture = TestBed.createComponent(AnnualPlansComponent);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
