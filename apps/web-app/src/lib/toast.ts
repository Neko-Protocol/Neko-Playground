import { sileo } from "sileo";
import type { SileoOptions, SileoPosition } from "sileo";

export { sileo, Toaster } from "sileo";
export type { SileoOptions, SileoPosition } from "sileo";

export type ToastType = "success" | "warning" | "info" | "error";

export type PromiseOpts<T = unknown> = {
  loading: SileoOptions;
  success: SileoOptions | ((data: T) => SileoOptions);
  error: SileoOptions | ((err: unknown) => SileoOptions);
  position?: SileoPosition;
};

const TYPE_MAP: Record<
  ToastType,
  keyof Pick<typeof sileo, "success" | "error" | "warning" | "info">
> = {
  success: "success",
  error: "error",
  warning: "warning",
  info: "info",
};

export function notify(
  message: string,
  type: ToastType = "info",
  options?: Partial<SileoOptions>
): string {
  return sileo[TYPE_MAP[type]]({ title: message, ...options });
}

export function promise<T>(
  p: Promise<T> | (() => Promise<T>),
  opts: PromiseOpts<T>
): Promise<T> {
  return sileo.promise(p, opts);
}

export function action(
  message: string,
  button: { title: string; onClick: () => void },
  options?: Partial<SileoOptions>
): string {
  return sileo.action({ title: message, button, ...options });
}
