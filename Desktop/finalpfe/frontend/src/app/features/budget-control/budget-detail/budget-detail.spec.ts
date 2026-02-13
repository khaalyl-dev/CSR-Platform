import { ComponentFixture, TestBed } from '@angular/core/testing';

import { BudgetDetail } from './budget-detail';

describe('BudgetDetail', () => {
  let component: BudgetDetail;
  let fixture: ComponentFixture<BudgetDetail>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [BudgetDetail]
    })
    .compileComponents();

    fixture = TestBed.createComponent(BudgetDetail);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
