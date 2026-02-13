import { ComponentFixture, TestBed } from '@angular/core/testing';

import { KpiList } from './kpi-list';

describe('KpiList', () => {
  let component: KpiList;
  let fixture: ComponentFixture<KpiList>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [KpiList]
    })
    .compileComponents();

    fixture = TestBed.createComponent(KpiList);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
