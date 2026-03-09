import { useEffect, useState } from 'react';

/**
 * Hook to check if the main process is ready to handle IPC calls.
 * Returns true once the main process sends 'main:ready' event.
 */
export function useMainReady(): boolean {
  const [isReady, setIsReady] = useState(false);

  useEffect(() => {
    if (!window.electronAPI?.on) {
      // If electronAPI is not available, we're probably not in Electron
      // (e.g., during SSR or testing). Assume ready.
      setIsReady(true);
      return;
    }

    // Listen for main:ready event
    const unsubscribe = window.electronAPI.on('main:ready', () => {
      setIsReady(true);
    });

    // Also check if already ready (in case we missed the event)
    // by trying a simple IPC call
    window.electronAPI
      .invoke('ping')
      .then(() => setIsReady(true))
      .catch(() => {
        // Not ready yet, wait for the event
      });

    return unsubscribe;
  }, []);

  return isReady;
}
