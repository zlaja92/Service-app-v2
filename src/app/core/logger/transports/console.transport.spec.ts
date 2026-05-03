import { ConsoleTransport } from './console.transport';
import { LogEntry, LogLevel } from '../logger.model';

describe('ConsoleTransport', () => {
  let transport: ConsoleTransport;

  function createEntry(
    level: LogLevel,
    message: string = 'test message',
    context?: Record<string, unknown>,
  ): LogEntry {
    return {
      level,
      message,
      context,
      timestamp: new Date('2024-01-15T12:00:00.000Z'),
    };
  }

  beforeEach(() => {
    transport = new ConsoleTransport();
    spyOn(console, 'debug').and.stub();
    spyOn(console, 'info').and.stub();
    spyOn(console, 'warn').and.stub();
    spyOn(console, 'error').and.stub();
  });

  // ─── Console method per level ──────────────────────────────────────────────

  describe('Console method per level', () => {
    it('TC-CT01: calls console.debug for DEBUG level', () => {
      transport.log(createEntry(LogLevel.DEBUG));

      expect(console.debug).toHaveBeenCalledTimes(1);
      expect(console.info).not.toHaveBeenCalled();
      expect(console.warn).not.toHaveBeenCalled();
      expect(console.error).not.toHaveBeenCalled();
    });

    it('TC-CT02: calls console.info for INFO level', () => {
      transport.log(createEntry(LogLevel.INFO));

      expect(console.info).toHaveBeenCalledTimes(1);
      expect(console.debug).not.toHaveBeenCalled();
      expect(console.warn).not.toHaveBeenCalled();
      expect(console.error).not.toHaveBeenCalled();
    });

    it('TC-CT03: calls console.warn for WARN level', () => {
      transport.log(createEntry(LogLevel.WARN));

      expect(console.warn).toHaveBeenCalledTimes(1);
      expect(console.debug).not.toHaveBeenCalled();
      expect(console.info).not.toHaveBeenCalled();
      expect(console.error).not.toHaveBeenCalled();
    });

    it('TC-CT04: calls console.error for ERROR level', () => {
      transport.log(createEntry(LogLevel.ERROR));

      expect(console.error).toHaveBeenCalledTimes(1);
      expect(console.debug).not.toHaveBeenCalled();
      expect(console.info).not.toHaveBeenCalled();
      expect(console.warn).not.toHaveBeenCalled();
    });
  });

  // ─── Formatting ────────────────────────────────────────────────────────────

  describe('Formatting', () => {
    it('TC-CT05: prefix format is [ISO timestamp] [LEVEL_NAME]', () => {
      const entry = createEntry(LogLevel.INFO, 'msg');
      transport.log(entry);

      const prefix = (console.info as jasmine.Spy).calls.mostRecent().args[0] as string;
      expect(prefix).toBe('[2024-01-15T12:00:00.000Z] [INFO]');
    });

    it('TC-CT06: passes context object as third argument when context is provided', () => {
      const ctx = { userId: 'u1', action: 'click' };
      const entry = createEntry(LogLevel.INFO, 'msg', ctx);
      transport.log(entry);

      const args = (console.info as jasmine.Spy).calls.mostRecent().args;
      expect(args[2]).toEqual(ctx);
    });

    it('TC-CT07: passes empty string as third argument when context is undefined', () => {
      const entry = createEntry(LogLevel.INFO, 'msg');
      transport.log(entry);

      const args = (console.info as jasmine.Spy).calls.mostRecent().args;
      expect(args[2]).toBe('');
    });

    it('TC-CT08: uses LogLevel enum name in prefix (DEBUG, INFO, WARN, ERROR)', () => {
      transport.log(createEntry(LogLevel.DEBUG, 'msg'));
      const debugPrefix = (console.debug as jasmine.Spy).calls.mostRecent().args[0] as string;
      expect(debugPrefix).toContain('[DEBUG]');

      transport.log(createEntry(LogLevel.WARN, 'msg'));
      const warnPrefix = (console.warn as jasmine.Spy).calls.mostRecent().args[0] as string;
      expect(warnPrefix).toContain('[WARN]');

      transport.log(createEntry(LogLevel.ERROR, 'msg'));
      const errorPrefix = (console.error as jasmine.Spy).calls.mostRecent().args[0] as string;
      expect(errorPrefix).toContain('[ERROR]');
    });
  });
});
