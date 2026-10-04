/**
 * Structured server-side logger (#318).
 *
 * Lightweight JSON logger that works in the Node route-handler runtime
 * without pulling a hosted SaaS. All API routes and background jobs should
 * record failures through this module so incidents share one sink.
 */

import { redactError, redactString, redactValue } from "./redact";

export type LogLevel = "debug" | "info" | "warn" | "error";

export interface LogFields {
  requestId?: string;
  route?: string;
  [key: string]: unknown;
}

type Sink = (line: string) => void;

const levelOrder: Record<LogLevel, number> = {
  debug: 10,
  info: 20,
  warn: 30,
  error: 40,
};

let minLevel: LogLevel = "info";
let sink: Sink = (line) => {
  console.error(line);
};

export function configureLogger(options: {
  level?: LogLevel;
  sink?: Sink;
}): void {
  if (options.level) minLevel = options.level;
  if (options.sink) sink = options.sink;
}

export function resetLoggerForTests(): void {
  minLevel = "info";
  sink = (line) => {
    console.error(line);
  };
}

function write(level: LogLevel, msg: string, fields: LogFields = {}): void {
  if (levelOrder[level] < levelOrder[minLevel]) return;
  const { requestId, route, err, error, ...rest } = fields as LogFields & {
    err?: unknown;
    error?: unknown;
  };
  const payload: Record<string, unknown> = {
    ...(redactValue(rest) as Record<string, unknown>),
    // The logger owns its envelope even when caller fields use these names.
    level,
    time: new Date().toISOString(),
    msg: redactString(typeof msg === "string" ? msg : String(msg)),
  };
  if (requestId) payload.requestId = redactString(requestId);
  if (route) payload.route = redactString(route);
  const errValue = err ?? error;
  if (errValue !== undefined) {
    payload.err = redactError(errValue);
  }
  sink(JSON.stringify(payload));
}

function writeChild(
  level: LogLevel,
  msg: string,
  base: LogFields,
  fields?: LogFields
): void {
  // Filter before reading or copying child context for a suppressed level.
  if (levelOrder[level] < levelOrder[minLevel]) return;
  write(level, msg, { ...base, ...fields });
}

export const logger = {
  debug: (msg: string, fields?: LogFields) => write("debug", msg, fields),
  info: (msg: string, fields?: LogFields) => write("info", msg, fields),
  warn: (msg: string, fields?: LogFields) => write("warn", msg, fields),
  error: (msg: string, fields?: LogFields) => write("error", msg, fields),
  child(base: LogFields) {
    return {
      debug: (msg: string, fields?: LogFields) =>
        writeChild("debug", msg, base, fields),
      info: (msg: string, fields?: LogFields) =>
        writeChild("info", msg, base, fields),
      warn: (msg: string, fields?: LogFields) =>
        writeChild("warn", msg, base, fields),
      error: (msg: string, fields?: LogFields) =>
        writeChild("error", msg, base, fields),
    };
  },
};

export type Logger = typeof logger;
