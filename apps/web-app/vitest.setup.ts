class LocalStorageMock implements Storage {
  private store = new Map<string, string>();

  get length() {
    return this.store.size;
  }

  clear(): void {
    this.store.clear();
  }

  getItem(key: string): string | null {
    return this.store.get(key) ?? null;
  }

  key(index: number): string | null {
    return [...this.store.keys()][index] ?? null;
  }

  removeItem(key: string): void {
    this.store.delete(key);
  }

  setItem(key: string, value: string): void {
    this.store.set(key, String(value));
  }
}

Object.defineProperty(globalThis, "localStorage", {
  value: new LocalStorageMock(),
  writable: true,
  configurable: true,
});

process.env.NEXT_PUBLIC_STELLAR_NETWORK ??= "TESTNET";
process.env.NEXT_PUBLIC_STELLAR_NETWORK_PASSPHRASE ??=
  "Test SDF Network ; September 2015";
process.env.NEXT_PUBLIC_STELLAR_RPC_URL ??=
  "https://soroban-testnet.stellar.org";
process.env.NEXT_PUBLIC_STELLAR_HORIZON_URL ??=
  "https://horizon-testnet.stellar.org";
