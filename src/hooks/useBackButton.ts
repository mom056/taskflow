import { useEffect } from 'react';

export interface BackButtonHandler {
  id: string;
  priority: number;
  fn: () => boolean | void | Promise<boolean | void>;
}

// Global registry of back button handlers
const handlers: BackButtonHandler[] = [];

if (typeof window !== 'undefined') {
  (window as any).capBackButtonHandlers = handlers;
}

export function registerBackButtonHandler(priority: number, fn: () => boolean | void | Promise<boolean | void>): string {
  const id = Math.random().toString(36).substring(2, 9);
  handlers.push({ id, priority, fn });
  // Sort descending by priority so higher priority runs first
  handlers.sort((a, b) => b.priority - a.priority);
  return id;
}

export function unregisterBackButtonHandler(id: string) {
  const index = handlers.findIndex(h => h.id === id);
  if (index !== -1) {
    handlers.splice(index, 1);
  }
}

/**
 * Hook to handle hardware back button on Android.
 * @param fn Callback function. If it returns true (or doesn't return false), it prevents default navigation/app exit.
 * @param priority Higher priority executes first. Modals should be 100+, tabs 10+.
 * @param active Whether this listener is active.
 */
export function useBackButton(
  fn: () => boolean | void | Promise<boolean | void>,
  priority: number = 10,
  active: boolean = true
) {
  useEffect(() => {
    if (!active) return;

    const id = registerBackButtonHandler(priority, fn);

    return () => {
      unregisterBackButtonHandler(id);
    };
  }, [fn, priority, active]);
}
