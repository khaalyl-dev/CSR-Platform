import { ComponentFixture, TestBed } from '@angular/core/testing';

import { ApprovalsList } from './approvals-list';

describe('ApprovalsList', () => {
  let component: ApprovalsList;
  let fixture: ComponentFixture<ApprovalsList>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [ApprovalsList]
    })
    .compileComponents();

    fixture = TestBed.createComponent(ApprovalsList);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
