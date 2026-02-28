import { Injectable } from '@angular/core';
import { LogEntry, LogLevel, LogTransport } from './logger.model';
import { ConsoleTransport } from './transports/console.transport';
import { environment } from '../../../environments/environment';

@Injectable({ providedIn: 'root' })
export class LoggerService {
  private transports: LogTransport[] = [new ConsoleTransport()];
  private minLevel: LogLevel;

  constructor() {
    const levelMap: Record<string, LogLevel> = {
      DEBUG: LogLevel.DEBUG,
      INFO: LogLevel.INFO,
      WARN: LogLevel.WARN,
      ERROR: LogLevel.ERROR,
    };
    this.minLevel = levelMap[environment.logLevel] ?? LogLevel.DEBUG;
  }

  debug(message: string, context?: Record<string, unknown>): void {
    this.log(LogLevel.DEBUG, message, context);
  }

  info(message: string, context?: Record<string, unknown>): void {
    this.log(LogLevel.INFO, message, context);
  }

  warn(message: string, context?: Record<string, unknown>): void {
    this.log(LogLevel.WARN, message, context);
  }

  error(message: string, context?: Record<string, unknown>): void {
    this.log(LogLevel.ERROR, message, context);
  }

  addTransport(transport: LogTransport): void {
    this.transports.push(transport);
  }

  private log(level: LogLevel, message: string, context?: Record<string, unknown>): void {
    if (level < this.minLevel) return;

    const entry: LogEntry = {
      level,
      message,
      context,
      timestamp: new Date(),
    };

    for (const transport of this.transports) {
      transport.log(entry);
    }
  }
}
