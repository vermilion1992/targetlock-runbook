export interface LocalStorageAdapter {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
}

class BrowserLocalStorageAdapter implements LocalStorageAdapter {
  getItem(key: string): string | null {
    return window.localStorage.getItem(key);
  }

  setItem(key: string, value: string): void {
    window.localStorage.setItem(key, value);
  }

  removeItem(key: string): void {
    window.localStorage.removeItem(key);
  }
}

export function getBrowserLocalStorageAdapter(): LocalStorageAdapter | null {
  if (typeof window === "undefined") {
    return null;
  }

  return new BrowserLocalStorageAdapter();
}
