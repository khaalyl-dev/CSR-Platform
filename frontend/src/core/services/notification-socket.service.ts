import { Injectable, NgZone, inject } from '@angular/core';
import { Subject } from 'rxjs';
import { io, type Socket } from 'socket.io-client';
import type { Notification } from '@features/notification-management/models/notification.model';

/**
 * Base URL for Socket.IO. During `ng serve` (port 4200), the dev server often serves `index.html`
 * for `/socket.io` (200 + text/html) instead of proxying — so we talk to Flask on :5001 directly.
 * CORS for `http://localhost:4200` is already set on Flask-SocketIO.
 */
function socketIoServerUrl(): string {
  if (typeof window === 'undefined') {
    return '';
  }
  const loc = window.location;
  const local =
    loc.hostname === 'localhost' ||
    loc.hostname === '127.0.0.1' ||
    loc.hostname === '[::1]';
  if (local && loc.port === '4200') {
    return `${loc.protocol}//${loc.hostname}:5001`;
  }
  return loc.origin;
}

/**
 * WebSocket (Socket.IO) for real-time notifications and task-list nudges.
 * Call {@link syncAuthToken} from a **component** `effect()` (e.g. MainLayout) so the connection
 * runs in a proper injection context; do not rely on effects inside this injectable alone.
 */
@Injectable({ providedIn: 'root' })
export class NotificationSocketService {
  private readonly zone = inject(NgZone);

  private socket: Socket | null = null;
  private lastToken: string | null = null;

  /** New notification from server event `notification` (same shape as REST list items). */
  readonly incoming = new Subject<Notification>();

  /** Fires each time the Socket.IO connection is established (use to refresh unread count after handshake). */
  readonly connected = new Subject<void>();

  /** Server asks clients to refetch `GET /api/tasks` (same JWT room as notifications). */
  readonly tasksUpdated = new Subject<void>();

  /**
   * Connect or reconnect using the current JWT; pass `null` to disconnect.
   * Idempotent for the same token while already connected.
   */
  syncAuthToken(token: string | null): void {
    if (!token) {
      this.teardown(true);
      return;
    }
    if (this.lastToken === token && this.socket?.connected) {
      return;
    }
    this.lastToken = token;
    this.teardown(false);
    if (typeof window === 'undefined') {
      return;
    }
    const url = socketIoServerUrl();
    this.socket = io(url, {
      path: '/socket.io',
      auth: { token },
      transports: ['polling', 'websocket'],
      reconnection: true,
      reconnectionAttempts: 20,
      reconnectionDelay: 2000,
      autoConnect: true,
    });
    this.socket.on('connect', () => {
      this.zone.run(() => this.connected.next());
    });
    this.socket.on('notification', (payload: Notification) => {
      this.zone.run(() => this.incoming.next(payload));
    });
    this.socket.on('tasks_updated', () => {
      this.zone.run(() => this.tasksUpdated.next());
    });
    this.socket.on('connect_error', () => {
      /* handshake failed (e.g. auth); client will retry if reconnection enabled */
    });
  }

  private teardown(clearLast: boolean): void {
    if (this.socket) {
      this.socket.removeAllListeners();
      this.socket.disconnect();
      this.socket = null;
    }
    if (clearLast) {
      this.lastToken = null;
    }
  }
}
