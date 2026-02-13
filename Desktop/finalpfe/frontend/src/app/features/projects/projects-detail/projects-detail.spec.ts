import { ComponentFixture, TestBed } from '@angular/core/testing';

import { ProjectsDetail } from './projects-detail';

describe('ProjectsDetail', () => {
  let component: ProjectsDetail;
  let fixture: ComponentFixture<ProjectsDetail>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [ProjectsDetail]
    })
    .compileComponents();

    fixture = TestBed.createComponent(ProjectsDetail);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
