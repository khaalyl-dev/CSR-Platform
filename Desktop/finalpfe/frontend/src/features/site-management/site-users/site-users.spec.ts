import { ComponentFixture, TestBed } from '@angular/core/testing';

import { SiteUsers } from './site-users';

describe('SiteUsers', () => {
  let component: SiteUsers;
  let fixture: ComponentFixture<SiteUsers>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [SiteUsers]
    })
    .compileComponents();

    fixture = TestBed.createComponent(SiteUsers);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
