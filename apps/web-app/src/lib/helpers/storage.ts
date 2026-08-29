const storage = {
  get isBrowser() { return typeof window !== "undefined" && !!window.localStorage; },
  getItem: (k: string) => typeof window !== "undefined" && window.localStorage ? window.localStorage.getItem(k) : null,
  setItem: (k: string, v: string) => { if (typeof window !== "undefined" && window.localStorage) window.localStorage.setItem(k, v); },
  removeItem: (k: string) => { if (typeof window !== "undefined" && window.localStorage) window.localStorage.removeItem(k); },
  clear: () => { if (typeof window !== "undefined" && window.localStorage) window.localStorage.clear(); },
};
export default storage;