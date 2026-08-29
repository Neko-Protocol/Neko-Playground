class TypedStorage {
  private readonly storage: Storage | null;

  constructor() {
    this.storage = typeof window !== "undefined" && window.localStorage ? window.localStorage : null;
  }

  get isBrowser(): boolean {
    return this.storage !== null;
  }

  getItem(key: string): string | null {
    return this.storage ? this.storage.getItem(key) : null;
  }

  setItem(key: string, value: string): void {
    if (this.storage) this.storage.setItem(key, value);
  }

  removeItem(key: string): void {
    if (this.storage) this.storage.removeItem(key);
  }

  clear(): void {
    if (this.storage) this.storage.clear();
  }
}

const storage = new TypedStorage();
export default storage;