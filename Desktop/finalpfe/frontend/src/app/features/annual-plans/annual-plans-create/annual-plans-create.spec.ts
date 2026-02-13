import { ComponentFixture, TestBed } from '@angular/core/testing';

import { AnnualPlansCreate } from './annual-plans-create';

describe('AnnualPlansCreate', () => {
  let component: AnnualPlansCreate;
  let fixture: ComponentFixture<AnnualPlansCreate>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [AnnualPlansCreate]
    })
    .compileComponents();

    fixture = TestBed.createComponent(AnnualPlansCreate);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
