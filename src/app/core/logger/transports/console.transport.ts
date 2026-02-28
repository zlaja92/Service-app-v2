import { LogEntry, LogLevel, LogTransport } from '../logger.model';

export class ConsoleTransport implements LogTransport {
  log(entry: LogEntry): void {
    const timestamp = entry.timestamp.toISOString();
    const prefix = `[${timestamp}] [${LogLevel[entry.level]}]`;

    switch (entry.level) {
      case LogLevel.DEBUG:
        console.debug(prefix, entry.message, entry.context ?? '');
        break;
      case LogLevel.INFO:
        console.info(prefix, entry.message, entry.context ?? '');
        break;
      case LogLevel.WARN:
        console.warn(prefix, entry.message, entry.context ?? '');
        break;
      case LogLevel.ERROR:
        console.error(prefix, entry.message, entry.context ?? '');
        break;
    }
  }
}
