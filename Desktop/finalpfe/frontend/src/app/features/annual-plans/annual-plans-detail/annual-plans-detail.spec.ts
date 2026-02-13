import { ComponentFixture, TestBed } from '@angular/core/testing';

import { AnnualPlansDetail } from './annual-plans-detail';

describe('AnnualPlansDetail', () => {
  let component: AnnualPlansDetail;
  let fixture: ComponentFixture<AnnualPlansDetail>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [AnnualPlansDetail]
    })
    .compileComponents();

    fixture = TestBed.createComponent(AnnualPlansDetail);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
