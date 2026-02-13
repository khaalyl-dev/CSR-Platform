import { ComponentFixture, TestBed } from '@angular/core/testing';

import { StrategyList } from './strategy-list';

describe('StrategyList', () => {
  let component: StrategyList;
  let fixture: ComponentFixture<StrategyList>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [StrategyList]
    })
    .compileComponents();

    fixture = TestBed.createComponent(StrategyList);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
