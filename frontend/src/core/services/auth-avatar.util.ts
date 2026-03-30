import { HttpClient } from '@angular/common/http';
import { AuthStore } from './auth-store';

/**
 * Load profile photo via HttpClient (JWT header) and expose as blob URL for sidebar / settings.
 * Browser `<img src="/api/...">` cannot send Authorization, so we always use blob URLs.
 */
export function applyAvatarUrlToStore(
  authStore: AuthStore,
  http: HttpClient,
  avatarUrl: string | null | undefined,
): void {
  const url = (avatarUrl ?? '').trim();
  if (!url) {
    authStore.setAvatarDisplayUrl(null);
    return;
  }
  const sep = url.includes('?') ? '&' : '?';
  http.get(`${url}${sep}t=${Date.now()}`, { responseType: 'blob' }).subscribe({
    next: (blob) => authStore.setAvatarDisplayUrl(URL.createObjectURL(blob)),
    error: () => authStore.setAvatarDisplayUrl(null),
  });
}
