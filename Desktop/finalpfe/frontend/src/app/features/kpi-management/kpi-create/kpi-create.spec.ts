import { ComponentFixture, TestBed } from '@angular/core/testing';

import { KpiCreate } from './kpi-create';

describe('KpiCreate', () => {
  let component: KpiCreate;
  let fixture: ComponentFixture<KpiCreate>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [KpiCreate]
    })
    .compileComponents();

    fixture = TestBed.createComponent(KpiCreate);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
