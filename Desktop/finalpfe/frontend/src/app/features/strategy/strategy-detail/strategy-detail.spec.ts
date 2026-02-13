import { ComponentFixture, TestBed } from '@angular/core/testing';

import { StrategyDetail } from './strategy-detail';

describe('StrategyDetail', () => {
  let component: StrategyDetail;
  let fixture: ComponentFixture<StrategyDetail>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [StrategyDetail]
    })
    .compileComponents();

    fixture = TestBed.createComponent(StrategyDetail);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
