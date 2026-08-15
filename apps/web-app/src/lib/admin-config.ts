import "server-only";
import { serverEnv } from "./env.server";

export function getLendingAdminAddress(): string {
  return serverEnv.LENDING_ADMIN_ADDRESS ?? "";
}

export function isAdminConfigured(): boolean {
  return getLendingAdminAddress().length > 0;
}
