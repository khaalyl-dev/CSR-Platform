import { ComponentFixture, TestBed } from '@angular/core/testing';

import { SitesDetail } from './sites-detail';

describe('SitesDetail', () => {
  let component: SitesDetail;
  let fixture: ComponentFixture<SitesDetail>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [SitesDetail]
    })
    .compileComponents();

    fixture = TestBed.createComponent(SitesDetail);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
