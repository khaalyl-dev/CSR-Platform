import { ComponentFixture, TestBed } from '@angular/core/testing';

import { BudgetOverview } from './budget-overview';

describe('BudgetOverview', () => {
  let component: BudgetOverview;
  let fixture: ComponentFixture<BudgetOverview>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [BudgetOverview]
    })
    .compileComponents();

    fixture = TestBed.createComponent(BudgetOverview);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
