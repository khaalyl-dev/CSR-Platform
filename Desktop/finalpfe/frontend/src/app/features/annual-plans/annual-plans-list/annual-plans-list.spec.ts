import { ComponentFixture, TestBed } from '@angular/core/testing';

import { AnnualPlansList } from './annual-plans-list';

describe('AnnualPlansList', () => {
  let component: AnnualPlansList;
  let fixture: ComponentFixture<AnnualPlansList>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [AnnualPlansList]
    })
    .compileComponents();

    fixture = TestBed.createComponent(AnnualPlansList);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
