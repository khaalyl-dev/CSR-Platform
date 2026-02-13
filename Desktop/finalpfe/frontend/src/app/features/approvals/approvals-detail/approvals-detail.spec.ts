import { ComponentFixture, TestBed } from '@angular/core/testing';

import { ApprovalsDetail } from './approvals-detail';

describe('ApprovalsDetail', () => {
  let component: ApprovalsDetail;
  let fixture: ComponentFixture<ApprovalsDetail>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [ApprovalsDetail]
    })
    .compileComponents();

    fixture = TestBed.createComponent(ApprovalsDetail);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
