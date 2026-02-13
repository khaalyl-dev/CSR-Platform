import { ComponentFixture, TestBed } from '@angular/core/testing';

import { SitesList } from './sites-list';

describe('SitesList', () => {
  let component: SitesList;
  let fixture: ComponentFixture<SitesList>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [SitesList]
    })
    .compileComponents();

    fixture = TestBed.createComponent(SitesList);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
