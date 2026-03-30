import { CommonModule } from '@angular/common';
import { Component, DestroyRef, ElementRef, HostListener, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { Router } from '@angular/router';
import { TranslateModule, TranslateService } from '@ngx-translate/core';
import { AuthStore } from '@core/services/auth-store';
import { NotificationSocketService } from '@core/services/notification-socket.service';
import { TasksApi, type UserTask } from '../api/tasks-api';

@Component({
  selector: 'app-user-tasks-bell',
  standalone: true,
  imports: [CommonModule, TranslateModule],
  template: `
    <div class="relative">
      <button
        type="button"
        (click)="toggleOpen()"
        class="relative inline-flex h-10 w-10 items-center justify-center rounded-full border border-gray-200 bg-white text-gray-700 shadow-sm transition hover:bg-gray-100"
        [attr.aria-label]="'USER_TASKS.ARIA' | translate"
        [attr.title]="'USER_TASKS.TITLE' | translate"
      >
        <svg class="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8">
          <path
            stroke-linecap="round"
            stroke-linejoin="round"
            d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4"
          />
        </svg>
        @if (taskCount() > 0) {
          <span
            class="absolute -right-1 -top-1 inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-brand-900 px-1 text-[11px] font-semibold text-white"
          >
            {{ taskCount() > 99 ? '99+' : taskCount() }}
          </span>
        }
      </button>

      @if (isOpen()) {
        <div class="absolute right-0 z-20 mt-2 w-96 max-w-[calc(100vw-2rem)] rounded-2xl border border-gray-200 bg-white p-4 shadow-xl">
          <div class="mb-3">
            <h3 class="text-sm font-semibold text-gray-800">{{ 'USER_TASKS.TITLE' | translate }}</h3>
            <p class="text-xs text-gray-500">{{ 'USER_TASKS.SUBTITLE' | translate }}</p>
          </div>

          @if (loading()) {
            <p class="py-6 text-center text-sm text-gray-500">{{ 'USER_TASKS.LOADING' | translate }}</p>
          } @else if (error()) {
            <p class="rounded-xl bg-red-50 px-3 py-2 text-sm text-red-700">{{ error() }}</p>
          } @else if (tasks().length === 0) {
            <p class="py-6 text-center text-sm text-gray-500">{{ 'USER_TASKS.EMPTY' | translate }}</p>
          } @else {
            <div class="max-h-[20rem] space-y-2 overflow-y-auto pr-1">
              @for (task of tasks(); track task.id) {
                <button
                  type="button"
                  (click)="openTask(task)"
                  class="flex w-full flex-col gap-0.5 rounded-xl border border-gray-200 bg-white px-3 py-3 text-left transition hover:bg-gray-50"
                >
                  <span class="text-sm font-semibold text-gray-900">{{ taskTitle(task) }}</span>
                  <span class="text-xs text-gray-600">{{ taskSubtitle(task) }}</span>
                </button>
              }
            </div>
          }
        </div>
      }
    </div>
  `,
})
export class UserTasksBellComponent {
  private readonly tasksApi = inject(TasksApi);
  private readonly notificationSocket = inject(NotificationSocketService);
  private readonly authStore = inject(AuthStore);
  private readonly translate = inject(TranslateService);
  private readonly destroyRef = inject(DestroyRef);
  private readonly router = inject(Router);
  private readonly elementRef = inject(ElementRef<HTMLElement>);

  protected readonly isOpen = signal(false);
  protected readonly loading = signal(false);
  protected readonly error = signal<string | null>(null);
  protected readonly tasks = signal<UserTask[]>([]);
  protected readonly taskCount = signal(0);

  constructor() {
    if (this.authStore.token()) this.refreshTasks();
    this.notificationSocket.connected.pipe(takeUntilDestroyed(this.destroyRef)).subscribe(() => {
      if (this.authStore.token()) this.refreshTasks();
    });
    this.notificationSocket.tasksUpdated.pipe(takeUntilDestroyed(this.destroyRef)).subscribe(() => {
      if (this.authStore.token()) this.refreshTasks();
    });
  }

  @HostListener('document:click', ['$event'])
  onDocumentClick(event: MouseEvent): void {
    const target = event.target as Node;
    if (this.isOpen() && target && !this.elementRef.nativeElement.contains(target)) {
      this.isOpen.set(false);
    }
  }

  protected toggleOpen(): void {
    const next = !this.isOpen();
    this.isOpen.set(next);
    if (next) this.loadTasks();
  }

  protected taskTitle(task: UserTask): string {
    const key = `USER_TASKS.KIND_${task.kind}`;
    const translated = this.translate.instant(key);
    return translated !== key ? translated : task.kind;
  }

  protected taskSubtitle(task: UserTask): string {
    const m = task.meta;
    const site = m.site_name || m.site_code || '';
    const year = m.year != null ? String(m.year) : '';
    if (task.kind === 'REVIEW_PENDING_CHANGES') {
      return this.translate.instant('USER_TASKS.META_PENDING_CHANGES');
    }
    if (
      task.kind === 'RESUBMIT_ACTIVITY' ||
      task.kind === 'EDIT_UNLOCKED_ACTIVITY'
    ) {
      const num = m.activity_number || '';
      const title = (m.activity_title || '').trim();
      const parts = [num && `#${num}`, title].filter(Boolean);
      const act = parts.join(' — ') || '';
      if (site && year) {
        return this.translate.instant('USER_TASKS.META_SITE_YEAR_ACTIVITY', {
          site,
          year,
          activity: act,
        });
      }
      return act || this.translate.instant('USER_TASKS.META_PLAN_ACTIVITY', { activity: act });
    }
    if (site && year) {
      return this.translate.instant('USER_TASKS.META_SITE_YEAR', { site, year });
    }
    if (year) return year;
    return '';
  }

  protected openTask(task: UserTask): void {
    const href = (task.href || '').trim();
    if (!href.startsWith('/')) {
      this.isOpen.set(false);
      return;
    }
    this.isOpen.set(false);
    this.router.navigateByUrl(href);
  }

  private loadTasks(): void {
    if (!this.authStore.token()) return;
    this.loading.set(true);
    this.error.set(null);
    this.tasksApi.list().subscribe({
      next: (res) => {
        this.tasks.set(res.tasks ?? []);
        this.taskCount.set(res.count ?? 0);
        this.loading.set(false);
      },
      error: () => {
        this.error.set(this.translate.instant('USER_TASKS.LOAD_ERROR'));
        this.loading.set(false);
      },
    });
  }

  private refreshTasks(): void {
    if (!this.authStore.token()) return;
    this.tasksApi.list().subscribe({
      next: (res) => {
        this.tasks.set(res.tasks ?? []);
        this.taskCount.set(res.count ?? 0);
      },
      error: () => this.taskCount.set(0),
    });
  }
}
