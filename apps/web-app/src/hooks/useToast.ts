import type { SileoOptions } from "sileo";
import {
  notify,
  promise,
  action,
  sileo,
  type ToastType,
  type PromiseOpts,
} from "@/lib/toast";

export function useToast() {
  return {
    addNotification: (
      msg: string,
      type: ToastType,
      opts?: Partial<SileoOptions>
    ) => notify(msg, type, opts),
    action,
    promise: <T>(p: Promise<T> | (() => Promise<T>), opts: PromiseOpts<T>) =>
      promise(p, opts),
    dismiss: sileo.dismiss,
    clear: sileo.clear,
  };
}
