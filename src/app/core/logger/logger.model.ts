export enum LogLevel {
  DEBUG = 0,
  INFO = 1,
  WARN = 2,
  ERROR = 3,
}

export interface LogEntry {
  level: LogLevel;
  message: string;
  context?: Record<string, unknown>;
  timestamp: Date;
  tenantId?: string;
  userId?: string;
}

export interface LogTransport {
  log(entry: LogEntry): void | Promise<void>;
}
