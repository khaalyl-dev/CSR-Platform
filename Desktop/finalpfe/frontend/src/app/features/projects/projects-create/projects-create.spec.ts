import { ComponentFixture, TestBed } from '@angular/core/testing';

import { ProjectsCreate } from './projects-create';

describe('ProjectsCreate', () => {
  let component: ProjectsCreate;
  let fixture: ComponentFixture<ProjectsCreate>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [ProjectsCreate]
    })
    .compileComponents();

    fixture = TestBed.createComponent(ProjectsCreate);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
