import { CommonModule, DatePipe } from '@angular/common';
import { Component, DestroyRef, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { Router } from '@angular/router';
import { interval } from 'rxjs';
import { NotificationsApi } from '../api/notifications-api';
import type { Notification } from '../models/notification.model';

@Component({
  selector: 'app-notification-bell',
  standalone: true,
  imports: [CommonModule, DatePipe],
  template: `
    <div class="relative">
      <button
        type="button"
        (click)="toggleOpen()"
        class="relative inline-flex h-10 w-10 items-center justify-center rounded-full border border-gray-200 bg-white text-brand-900 shadow-sm transition hover:bg-brand-100"
        aria-label="Notifications"
        title="Notifications"
      >
        <svg class="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8">
          <path stroke-linecap="round" stroke-linejoin="round" d="M14.857 17H9.143m8-6A5.143 5.143 0 0 0 6.857 11c0 1.791-.392 3.127-1.176 4.429A1 1 0 0 0 6.538 17h10.924a1 1 0 0 0 .857-1.571C17.535 14.127 17.143 12.79 17.143 11A5.143 5.143 0 0 0 12 5.857 5.143 5.143 0 0 0 6.857 11" />
          <path stroke-linecap="round" stroke-linejoin="round" d="M10 19a2 2 0 0 0 4 0" />
        </svg>
        @if (unreadCount() > 0) {
          <span class="absolute -right-1 -top-1 inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-brand-900 px-1 text-[11px] font-semibold text-white">
            {{ unreadCount() > 99 ? '99+' : unreadCount() }}
          </span>
        }
      </button>

      @if (isOpen()) {
        <div class="absolute right-0 z-20 mt-2 w-80 rounded-2xl border border-gray-200 bg-white p-4 shadow-xl">
          <div class="mb-3 flex items-center justify-between gap-3">
            <div>
              <h3 class="text-sm font-semibold text-brand-900">Notifications</h3>
              <p class="text-xs text-gray-500">{{ unreadCount() }} non lue(s)</p>
            </div>
            <button
              type="button"
              (click)="markAllAsRead()"
              class="rounded-lg bg-brand-100 px-2.5 py-1 text-xs font-medium text-brand-800 transition hover:bg-brand-700 hover:text-white disabled:cursor-not-allowed disabled:opacity-50"
              [disabled]="unreadCount() === 0 || loading()"
            >
              Tout lire
            </button>
          </div>

          @if (loading()) {
            <p class="py-6 text-center text-sm text-gray-500">Chargement...</p>
          } @else if (error()) {
            <p class="rounded-xl bg-red-50 px-3 py-2 text-sm text-red-700">{{ error() }}</p>
          } @else if (notifications().length === 0) {
            <p class="py-6 text-center text-sm text-gray-500">Aucune notification.</p>
          } @else {
            <div class="max-h-[18rem] space-y-2 overflow-y-auto pr-1">
              @for (notification of notifications(); track notification.id) {
                <button
                  type="button"
                  (click)="openNotification(notification)"
                  class="block w-full rounded-xl border px-3 py-3 text-left transition"
                  [class.bg-brand-100]="!notification.is_read"
                  [class.border-brand-700/30]="!notification.is_read"
                  [class.bg-white]="notification.is_read"
                  [class.border-gray-200]="notification.is_read"
                >
                  <div class="mb-1 flex items-start justify-between gap-3">
                    <div class="flex items-center gap-2">
                      <span
                        class="inline-block h-2.5 w-2.5 rounded-full"
                        [class.bg-brand-900]="notification.type === 'info'"
                        [class.bg-green-500]="notification.type === 'success'"
                        [class.bg-amber-500]="notification.type === 'warning'"
                        [class.bg-red-500]="notification.type === 'error'"
                      ></span>
                      <span class="text-sm font-semibold text-brand-900">{{ notification.title }}</span>
                    </div>
                    <span class="shrink-0 text-[11px] text-gray-500">
                      {{ notification.created_at | date:'short' }}
                    </span>
                  </div>
                  <p class="text-sm text-gray-700">{{ notification.message }}</p>
                </button>
              }
            </div>
          }
        </div>
      }
    </div>
  `
})
export class NotificationBellComponent {
  private readonly notificationsApi = inject(NotificationsApi);
  private readonly destroyRef = inject(DestroyRef);
  private readonly router = inject(Router);

  protected readonly isOpen = signal(false);
  protected readonly loading = signal(false);
  protected readonly error = signal<string | null>(null);
  protected readonly unreadCount = signal(0);
  protected readonly notifications = signal<Notification[]>([]);

  constructor() {
    this.refreshUnreadCount();
    interval(30000)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(() => {
        this.refreshUnreadCount();
        if (this.isOpen()) this.loadNotifications();
      });
  }

  protected toggleOpen(): void {
    const next = !this.isOpen();
    this.isOpen.set(next);
    if (next) {
      this.loadNotifications();
    }
  }

  protected markAsRead(notification: Notification): void {
    if (notification.is_read) return;

    this.notificationsApi.markRead(notification.id).subscribe({
      next: updated => {
        this.notifications.update(items =>
          items.map(item => (item.id === updated.id ? updated : item))
        );
        this.unreadCount.update(count => Math.max(0, count - 1));
      },
      error: () => {
        this.error.set("Impossible de marquer la notification comme lue.");
      }
    });
  }

  protected markAllAsRead(): void {
    this.notificationsApi.markAllRead().subscribe({
      next: () => {
        this.notifications.update(items => items.map(item => ({ ...item, is_read: true })));
        this.unreadCount.set(0);
      },
      error: () => {
        this.error.set("Impossible de marquer toutes les notifications comme lues.");
      }
    });
  }

  protected openNotification(notification: Notification): void {
    const targetRoute = this.getNotificationRoute(notification);

    if (notification.is_read) {
      this.isOpen.set(false);
      if (targetRoute) {
        this.router.navigate([targetRoute]);
      }
      return;
    }

    this.notificationsApi.markRead(notification.id).subscribe({
      next: updated => {
        this.notifications.update(items =>
          items.map(item => (item.id === updated.id ? updated : item))
        );
        this.unreadCount.update(count => Math.max(0, count - 1));
        this.isOpen.set(false);
        if (targetRoute) {
          this.router.navigate([targetRoute]);
        }
      },
      error: () => {
        this.error.set("Impossible d'ouvrir la notification.");
      }
    });
  }

  private loadNotifications(): void {
    this.loading.set(true);
    this.error.set(null);
    this.notificationsApi.list().subscribe({
      next: notifications => {
        this.notifications.set(notifications);
        this.unreadCount.set(notifications.filter(item => !item.is_read).length);
        this.loading.set(false);
      },
      error: () => {
        this.error.set("Impossible de charger les notifications.");
        this.loading.set(false);
      }
    });
  }

  private refreshUnreadCount(): void {
    this.notificationsApi.unreadCount().subscribe({
      next: ({ count }) => this.unreadCount.set(count),
      error: () => this.unreadCount.set(0)
    });
  }

  private getNotificationRoute(notification: Notification): string | null {
    if (notification.target_route) {
      return notification.target_route;
    }

    switch (notification.title) {
      case 'Nouveau plan soumis':
        return '/annual-plans/validation';
      case 'Nouvelle demande de modification':
        return '/changes/pending';
      default:
        return null;
    }
  }
}
