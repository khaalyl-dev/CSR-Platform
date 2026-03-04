import { Component, OnInit, OnDestroy, signal, computed, HostListener } from '@angular/core';
import { CommonModule } from '@angular/common';
import { NotificationsApi } from '../api/notifications-api';
import { Notification } from '../models/notification.model';

@Component({
  selector: 'app-notification-bell',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './notification-bell.html',
  styleUrl: './notification-bell.css',
})
export class NotificationBellComponent implements OnInit, OnDestroy {

  notifications = signal<Notification[]>([]);
  isOpen = false;
  private intervalId: any;

  unreadCount = computed(() => this.notifications().filter(n => !n.is_read).length);

  constructor(private api: NotificationsApi) {}

  ngOnInit() {
    this.loadNotifications();
    // Polling toutes les 30 secondes
    this.intervalId = setInterval(() => this.loadNotifications(), 30000);
  }

  ngOnDestroy() {
    clearInterval(this.intervalId);
  }

  @HostListener('document:click')
  onDocumentClick() {
    this.isOpen = false;
  }

  toggleDropdown(event: MouseEvent) {
    event.stopPropagation();
    this.isOpen = !this.isOpen;
  }

  loadNotifications() {
    this.api.list().subscribe({
      next: (data) => this.notifications.set(data),
      error: () => {}
    });
  }

  markRead(notif: Notification, event: MouseEvent) {
    event.stopPropagation();
    if (notif.is_read) return;
    this.api.markRead(notif.id).subscribe({
      next: (updated) => {
        this.notifications.update(list =>
          list.map(n => n.id === updated.id ? updated : n)
        );
      }
    });
  }

  markAllRead(event: MouseEvent) {
    event.stopPropagation();
    this.api.markAllRead().subscribe({
      next: () => {
        this.notifications.update(list =>
          list.map(n => ({ ...n, is_read: true }))
        );
      }
    });
  }

  deleteNotif(notif: Notification, event: MouseEvent) {
    event.stopPropagation();
    this.api.delete(notif.id).subscribe({
      next: () => {
        this.notifications.update(list => list.filter(n => n.id !== notif.id));
      }
    });
  }

  getTypeIcon(type: string): string {
    const icons: Record<string, string> = {
      'info':    'fas fa-info-circle',
      'success': 'fas fa-check-circle',
      'warning': 'fas fa-exclamation-triangle',
      'error':   'fas fa-times-circle',
    };
    return icons[type] || 'fas fa-bell';
  }

  getTypeColor(type: string): string {
    const colors: Record<string, string> = {
      'info':    'text-blue-500',
      'success': 'text-green-500',
      'warning': 'text-yellow-500',
      'error':   'text-red-500',
    };
    return colors[type] || 'text-gray-500';
  }

  getTypeBg(type: string): string {
    const colors: Record<string, string> = {
      'info':    'bg-blue-50',
      'success': 'bg-green-50',
      'warning': 'bg-yellow-50',
      'error':   'bg-red-50',
    };
    return colors[type] || 'bg-gray-50';
  }

  formatDate(dateStr: string | null): string {
    if (!dateStr) return '';
    const date = new Date(dateStr);
    const now = new Date();
    const diff = Math.floor((now.getTime() - date.getTime()) / 1000);
    if (diff < 60) return 'À l\'instant';
    if (diff < 3600) return `Il y a ${Math.floor(diff / 60)} min`;
    if (diff < 86400) return `Il y a ${Math.floor(diff / 3600)}h`;
    return `Il y a ${Math.floor(diff / 86400)}j`;
  }
}