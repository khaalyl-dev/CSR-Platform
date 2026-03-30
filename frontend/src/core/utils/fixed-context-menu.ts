/**
 * Positioning for fixed overlay ⋮ menus: optional “open above” for the last table row
 * (measured after render + horizontal clamp).
 */
export const FIXED_CONTEXT_MENU_PAD = 8;
export const FIXED_CONTEXT_MENU_GAP = 4;

export function initialFixedContextMenuTopBelow(btnRect: DOMRect): number {
  return btnRect.bottom + FIXED_CONTEXT_MENU_GAP;
}

export function initialFixedContextMenuLeft(btnRect: DOMRect, menuWidth: number): number {
  const pad = FIXED_CONTEXT_MENU_PAD;
  return Math.max(pad, Math.min(btnRect.right - menuWidth, window.innerWidth - menuWidth - pad));
}

export function scheduleFixedContextMenuPosition(options: {
  menuSelector: string;
  btnRect: DOMRect;
  menuWidth: number;
  openAbove: boolean;
  initialLeft: number;
  isAlive: () => boolean;
  onApply: (top: number, left: number) => void;
}): void {
  const pad = FIXED_CONTEXT_MENU_PAD;
  const gap = FIXED_CONTEXT_MENU_GAP;

  const run = (attempt: number): void => {
    requestAnimationFrame(() => {
      if (!options.isAlive()) return;
      const menu = document.querySelector(options.menuSelector) as HTMLElement | null;
      const m = menu?.getBoundingClientRect();
      if (!menu || !m || m.height < 4) {
        if (attempt < 16) run(attempt + 1);
        return;
      }

      let left = options.initialLeft;
      let top: number;

      if (options.openAbove) {
        top = options.btnRect.top - m.height - gap;
        if (top < pad) top = pad;
        if (top + m.height > window.innerHeight - pad) {
          top = Math.max(pad, window.innerHeight - pad - m.height);
        }
      } else {
        top = options.btnRect.bottom + gap;
      }

      if (left + m.width > window.innerWidth - pad) {
        left = window.innerWidth - pad - m.width;
      }
      if (left < pad) left = pad;

      options.onApply(top, left);
    });
  };

  run(0);
}
