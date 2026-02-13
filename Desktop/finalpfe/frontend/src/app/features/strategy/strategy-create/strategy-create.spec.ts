import { ComponentFixture, TestBed } from '@angular/core/testing';

import { StrategyCreate } from './strategy-create';

describe('StrategyCreate', () => {
  let component: StrategyCreate;
  let fixture: ComponentFixture<StrategyCreate>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [StrategyCreate]
    })
    .compileComponents();

    fixture = TestBed.createComponent(StrategyCreate);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
