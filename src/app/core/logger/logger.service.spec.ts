import { TestBed } from '@angular/core/testing';
import { LoggerService } from './logger.service';
import { LogLevel, LogTransport, LogEntry } from './logger.model';
import { environment } from '../../../environments/environment';

describe('LoggerService', () => {
  let service: LoggerService;
  let customTransport: jasmine.SpyObj<LogTransport>;

  function createServiceWithLogLevel(level: string): LoggerService {
    const original = environment.logLevel;
    (environment as any).logLevel = level;
    const svc = new LoggerService();
    (environment as any).logLevel = original;
    return svc;
  }

  beforeEach(() => {
    TestBed.configureTestingModule({ providers: [LoggerService] });
    service = TestBed.inject(LoggerService);
    customTransport = jasmine.createSpyObj<LogTransport>('CustomTransport', ['log']);
    service.addTransport(customTransport);
  });

  // ─── Constructor / min-level init ──────────────────────────────────────────

  describe('Constructor / min-level init', () => {
    it('TC-L01: sets minLevel INFO when env.logLevel is INFO (debug not logged)', () => {
      const svc = createServiceWithLogLevel('INFO');
      const transport = jasmine.createSpyObj<LogTransport>('T', ['log']);
      svc.addTransport(transport);

      svc.debug('debug msg');

      expect(transport.log).not.toHaveBeenCalled();
    });

    it('TC-L02: sets minLevel DEBUG when env.logLevel is DEBUG (debug logged)', () => {
      const svc = createServiceWithLogLevel('DEBUG');
      const transport = jasmine.createSpyObj<LogTransport>('T', ['log']);
      svc.addTransport(transport);

      svc.debug('debug msg');

      expect(transport.log).toHaveBeenCalled();
    });

    it('TC-L03: sets minLevel WARN when env.logLevel is WARN (info not logged)', () => {
      const svc = createServiceWithLogLevel('WARN');
      const transport = jasmine.createSpyObj<LogTransport>('T', ['log']);
      svc.addTransport(transport);

      svc.info('info msg');

      expect(transport.log).not.toHaveBeenCalled();
    });

    it('TC-L04: sets minLevel ERROR when env.logLevel is ERROR (warn not logged)', () => {
      const svc = createServiceWithLogLevel('ERROR');
      const transport = jasmine.createSpyObj<LogTransport>('T', ['log']);
      svc.addTransport(transport);

      svc.warn('warn msg');

      expect(transport.log).not.toHaveBeenCalled();
    });

    it('TC-L05: defaults to DEBUG when env.logLevel is unrecognized', () => {
      const svc = createServiceWithLogLevel('VERBOSE');
      const transport = jasmine.createSpyObj<LogTransport>('T', ['log']);
      svc.addTransport(transport);

      svc.debug('debug msg');

      expect(transport.log).toHaveBeenCalled();
    });
  });

  // ─── Min-level filtering (service uses minLevel from env = INFO) ───────────

  describe('Min-level filtering', () => {
    let infoService: LoggerService;
    let filterTransport: jasmine.SpyObj<LogTransport>;

    beforeEach(() => {
      infoService = createServiceWithLogLevel('INFO');
      filterTransport = jasmine.createSpyObj<LogTransport>('FilterT', ['log']);
      infoService.addTransport(filterTransport);
    });

    it('TC-L06: does NOT log debug when minLevel is INFO', () => {
      infoService.debug('debug msg');
      expect(filterTransport.log).not.toHaveBeenCalled();
    });

    it('TC-L07: logs info when minLevel is INFO', () => {
      infoService.info('info msg');
      expect(filterTransport.log).toHaveBeenCalled();
    });

    it('TC-L08: logs warn when minLevel is INFO', () => {
      infoService.warn('warn msg');
      expect(filterTransport.log).toHaveBeenCalled();
    });

    it('TC-L09: logs error when minLevel is INFO', () => {
      infoService.error('error msg');
      expect(filterTransport.log).toHaveBeenCalled();
    });
  });

  // ─── Log entry construction ────────────────────────────────────────────────

  describe('Log entry construction', () => {
    let debugService: LoggerService;
    let entryTransport: jasmine.SpyObj<LogTransport>;

    beforeEach(() => {
      debugService = createServiceWithLogLevel('DEBUG');
      entryTransport = jasmine.createSpyObj<LogTransport>('EntryT', ['log']);
      debugService.addTransport(entryTransport);
    });

    it('TC-L10: includes correct message in log entry', () => {
      debugService.info('hello world');

      const entry: LogEntry = entryTransport.log.calls.mostRecent().args[0];
      expect(entry.message).toBe('hello world');
    });

    it('TC-L11: includes context when provided', () => {
      const ctx = { key: 'value', count: 42 };
      debugService.info('with context', ctx);

      const entry: LogEntry = entryTransport.log.calls.mostRecent().args[0];
      expect(entry.context).toEqual(ctx);
    });

    it('TC-L12: context is undefined when not provided', () => {
      debugService.info('no context');

      const entry: LogEntry = entryTransport.log.calls.mostRecent().args[0];
      expect(entry.context).toBeUndefined();
    });

    it('TC-L13: includes a valid Date timestamp', () => {
      const before = new Date();
      debugService.info('timestamp test');
      const after = new Date();

      const entry: LogEntry = entryTransport.log.calls.mostRecent().args[0];
      expect(entry.timestamp).toBeInstanceOf(Date);
      expect(entry.timestamp.getTime()).toBeGreaterThanOrEqual(before.getTime());
      expect(entry.timestamp.getTime()).toBeLessThanOrEqual(after.getTime());
    });

    it('TC-L14: each method maps to correct LogLevel', () => {
      debugService.debug('d');
      const debugEntry: LogEntry = entryTransport.log.calls.all()[0].args[0];
      expect(debugEntry.level).toBe(LogLevel.DEBUG);

      debugService.info('i');
      const infoEntry: LogEntry = entryTransport.log.calls.all()[1].args[0];
      expect(infoEntry.level).toBe(LogLevel.INFO);

      debugService.warn('w');
      const warnEntry: LogEntry = entryTransport.log.calls.all()[2].args[0];
      expect(warnEntry.level).toBe(LogLevel.WARN);

      debugService.error('e');
      const errorEntry: LogEntry = entryTransport.log.calls.all()[3].args[0];
      expect(errorEntry.level).toBe(LogLevel.ERROR);

      expect(LogLevel.DEBUG).toBe(0);
      expect(LogLevel.INFO).toBe(1);
      expect(LogLevel.WARN).toBe(2);
      expect(LogLevel.ERROR).toBe(3);
    });
  });

  // ─── addTransport ──────────────────────────────────────────────────────────

  describe('addTransport', () => {
    let debugService: LoggerService;

    beforeEach(() => {
      debugService = createServiceWithLogLevel('DEBUG');
    });

    it('TC-L15: delivers to custom transport added via addTransport', () => {
      const t = jasmine.createSpyObj<LogTransport>('T', ['log']);
      debugService.addTransport(t);

      debugService.info('msg');

      expect(t.log).toHaveBeenCalledTimes(1);
    });

    it('TC-L16: delivers to ALL transports (ConsoleTransport + custom)', () => {
      // We cannot directly spy on the built-in ConsoleTransport, but we can verify
      // the custom transport does receive the call, confirming multi-transport dispatch.
      const t1 = jasmine.createSpyObj<LogTransport>('T1', ['log']);
      debugService.addTransport(t1);

      // Spy on console.info to verify ConsoleTransport also fires
      spyOn(console, 'info').and.stub();
      debugService.info('broadcast msg');

      expect(t1.log).toHaveBeenCalledTimes(1);
      expect(console.info).toHaveBeenCalledTimes(1);
    });

    it('TC-L17: supports multiple custom transports', () => {
      const t1 = jasmine.createSpyObj<LogTransport>('T1', ['log']);
      const t2 = jasmine.createSpyObj<LogTransport>('T2', ['log']);
      debugService.addTransport(t1);
      debugService.addTransport(t2);

      debugService.warn('multi-transport');

      expect(t1.log).toHaveBeenCalledTimes(1);
      expect(t2.log).toHaveBeenCalledTimes(1);
    });
  });

  // ─── Edge cases ────────────────────────────────────────────────────────────

  describe('Edge cases', () => {
    it('TC-L18: handles empty string message without throwing', () => {
      const svc = createServiceWithLogLevel('DEBUG');
      const t = jasmine.createSpyObj<LogTransport>('T', ['log']);
      svc.addTransport(t);

      expect(() => svc.info('')).not.toThrow();

      const entry: LogEntry = t.log.calls.mostRecent().args[0];
      expect(entry.message).toBe('');
    });
  });

  // ─── Parameterized: all 4 levels × all message string variants ────────────

  describe('Parameterized: log levels × message variants', () => {
    type LevelMethod = 'debug' | 'info' | 'warn' | 'error';
    const levels: { method: LevelMethod; level: LogLevel }[] = [
      { method: 'debug', level: LogLevel.DEBUG },
      { method: 'info',  level: LogLevel.INFO },
      { method: 'warn',  level: LogLevel.WARN },
      { method: 'error', level: LogLevel.ERROR },
    ];

    const messageVariants: string[] = [
      '',
      ' ',
      '\t',
      '\n',
      'a',
      'Hello World',
      'a'.repeat(1000),
      'Привет мир',
      '你好世界',
      'مرحبا بالعالم',
      'שלום עולם',
      '🚀🔥💥',
      '<script>alert(1)</script>',
      '"; DROP TABLE users; --',
      '&lt;div&gt;',
      '../../../etc/passwd',
      'null',
      'undefined',
      '0',
      'false',
      ' ',
      '',
      '[31mRed[0m',
      'line1\nline2\nline3',
      'tab\there',
    ];

    let debugSvc: LoggerService;
    let capTransport: jasmine.SpyObj<LogTransport>;

    beforeEach(() => {
      debugSvc = createServiceWithLogLevel('DEBUG');
      capTransport = jasmine.createSpyObj<LogTransport>('CapT', ['log']);
      debugSvc.addTransport(capTransport);
    });

    levels.forEach(({ method, level }) => {
      messageVariants.forEach((msg) => {
        const label = msg.slice(0, 20).replace(/\n/g, '\\n').replace(/\t/g, '\\t');
        it(`TC-LPM-${method}-"${label}": ${method}() logs correct level and message`, () => {
          debugSvc[method](msg);

          expect(capTransport.log).toHaveBeenCalledTimes(1);
          const entry: LogEntry = capTransport.log.calls.mostRecent().args[0];
          expect(entry.level).toBe(level);
          expect(entry.message).toBe(msg);
        });
      });
    });
  });

  // ─── Parameterized: all 4 levels × context variants ───────────────────────

  describe('Parameterized: log levels × context variants', () => {
    type LevelMethod = 'debug' | 'info' | 'warn' | 'error';
    const levels: LevelMethod[] = ['debug', 'info', 'warn', 'error'];

    interface ContextCase {
      label: string;
      ctx: Record<string, unknown> | undefined;
    }

    const contextVariants: ContextCase[] = [
      { label: 'undefined', ctx: undefined },
      { label: 'empty object', ctx: {} },
      { label: 'plain string value', ctx: { key: 'value' } },
      { label: 'number value', ctx: { count: 42 } },
      { label: 'boolean true', ctx: { flag: true } },
      { label: 'boolean false', ctx: { flag: false } },
      { label: 'null value', ctx: { data: null } },
      { label: 'array value', ctx: { items: [1, 2, 3] } },
      { label: 'nested object', ctx: { outer: { inner: { deep: 'value' } } } },
      { label: 'number zero', ctx: { count: 0 } },
      { label: 'negative number', ctx: { offset: -1 } },
      { label: 'float', ctx: { ratio: 0.5 } },
      { label: 'large number', ctx: { n: Number.MAX_SAFE_INTEGER } },
      { label: 'infinity', ctx: { n: Infinity } },
      { label: 'NaN value', ctx: { n: NaN } },
      { label: 'empty string value', ctx: { msg: '' } },
      { label: 'unicode value', ctx: { text: 'Привет' } },
      { label: 'emoji value', ctx: { icon: '🚀' } },
      { label: 'mixed types', ctx: { s: 'str', n: 1, b: true, a: [], o: {} } },
      {
        label: 'deeply nested 5 levels',
        ctx: { l1: { l2: { l3: { l4: { l5: 'deep' } } } } },
      },
      { label: 'many keys', ctx: (Array.from({ length: 20 }) as unknown[]).reduce((acc: Record<string, unknown>, _, i) => { acc[`k${i}`] = i; return acc; }, {} as Record<string, unknown>) },
      { label: 'undefined value in ctx', ctx: { key: undefined } },
      { label: 'special chars in key', ctx: { 'key-with-dashes': 1 } },
      { label: 'error object stringified', ctx: { error: 'Error: something failed' } },
    ];

    let debugSvc: LoggerService;
    let capTransport: jasmine.SpyObj<LogTransport>;

    beforeEach(() => {
      debugSvc = createServiceWithLogLevel('DEBUG');
      capTransport = jasmine.createSpyObj<LogTransport>('CapT', ['log']);
      debugSvc.addTransport(capTransport);
    });

    levels.forEach((method) => {
      contextVariants.forEach(({ label, ctx }) => {
        it(`TC-LPC-${method}-${label}: ${method}() passes context correctly`, () => {
          if (ctx === undefined) {
            debugSvc[method]('msg');
          } else {
            debugSvc[method]('msg', ctx);
          }

          const entry: LogEntry = capTransport.log.calls.mostRecent().args[0];
          expect(entry.context).toEqual(ctx);
        });
      });
    });
  });

  // ─── Min-level filtering parameterized ────────────────────────────────────

  describe('Parameterized: min-level filtering matrix', () => {
    type LevelName = 'DEBUG' | 'INFO' | 'WARN' | 'ERROR';
    type MethodName = 'debug' | 'info' | 'warn' | 'error';

    const levelNames: LevelName[] = ['DEBUG', 'INFO', 'WARN', 'ERROR'];
    const methods: MethodName[] = ['debug', 'info', 'warn', 'error'];

    const methodToLevel: Record<MethodName, LogLevel> = {
      debug: LogLevel.DEBUG,
      info:  LogLevel.INFO,
      warn:  LogLevel.WARN,
      error: LogLevel.ERROR,
    };

    const minLevelMap: Record<LevelName, LogLevel> = {
      DEBUG: LogLevel.DEBUG,
      INFO:  LogLevel.INFO,
      WARN:  LogLevel.WARN,
      ERROR: LogLevel.ERROR,
    };

    levelNames.forEach((minLevelName) => {
      methods.forEach((method) => {
        const shouldLog = methodToLevel[method] >= minLevelMap[minLevelName];
        it(`TC-LF-${minLevelName}-${method}: minLevel=${minLevelName} → ${method}() should${shouldLog ? '' : ' NOT'} be logged`, () => {
          const svc = createServiceWithLogLevel(minLevelName);
          const t = jasmine.createSpyObj<LogTransport>('T', ['log']);
          svc.addTransport(t);

          svc[method]('test');

          if (shouldLog) {
            expect(t.log).toHaveBeenCalledTimes(1);
          } else {
            expect(t.log).not.toHaveBeenCalled();
          }
        });
      });
    });
  });

  // ─── Multiple transports: delivery count ──────────────────────────────────

  describe('Multiple transports delivery', () => {
    const transportCounts = [1, 2, 3, 5, 10];

    transportCounts.forEach((count) => {
      it(`TC-LMT-${count}: delivers to ${count} custom transport(s)`, () => {
        const svc = createServiceWithLogLevel('DEBUG');
        const transports = Array.from({ length: count }, (_, i) =>
          jasmine.createSpyObj<LogTransport>(`T${i}`, ['log'])
        );
        transports.forEach((t) => svc.addTransport(t));

        svc.info('broadcast');

        transports.forEach((t) => {
          expect(t.log).toHaveBeenCalledTimes(1);
        });
      });
    });
  });

  // ─── Timestamp ordering ───────────────────────────────────────────────────

  describe('Timestamp ordering', () => {
    it('TC-LTS-01: sequential calls produce non-decreasing timestamps', () => {
      const svc = createServiceWithLogLevel('DEBUG');
      const t = jasmine.createSpyObj<LogTransport>('T', ['log']);
      svc.addTransport(t);

      for (let i = 0; i < 10; i++) {
        svc.info(`message ${i}`);
      }

      const entries: LogEntry[] = t.log.calls.all().map((c) => c.args[0]);
      for (let i = 1; i < entries.length; i++) {
        expect(entries[i].timestamp.getTime()).toBeGreaterThanOrEqual(
          entries[i - 1].timestamp.getTime()
        );
      }
    });

    it('TC-LTS-02: timestamp is not in the future', () => {
      const svc = createServiceWithLogLevel('DEBUG');
      const t = jasmine.createSpyObj<LogTransport>('T', ['log']);
      svc.addTransport(t);

      const before = Date.now();
      svc.debug('now');
      const after = Date.now();

      const entry: LogEntry = t.log.calls.mostRecent().args[0];
      expect(entry.timestamp.getTime()).toBeGreaterThanOrEqual(before);
      expect(entry.timestamp.getTime()).toBeLessThanOrEqual(after);
    });
  });

  // ─── Console output verification ──────────────────────────────────────────

  describe('Console output verification', () => {
    type LevelMethod = 'debug' | 'info' | 'warn' | 'error';
    const consoleMethods: Record<LevelMethod, keyof Console> = {
      debug: 'debug',
      info:  'info',
      warn:  'warn',
      error: 'error',
    };

    (['info', 'warn', 'error'] as LevelMethod[]).forEach((method) => {
      it(`TC-LCON-${method}: ${method}() triggers console.${consoleMethods[method]}`, () => {
        const svc = createServiceWithLogLevel('DEBUG');
        spyOn(console, consoleMethods[method] as any).and.stub();

        svc[method]('console test');

        expect(console[consoleMethods[method]]).toHaveBeenCalledTimes(1);
      });
    });

    it('TC-LCON-debug: debug() triggers console.debug when minLevel is DEBUG', () => {
      const svc = createServiceWithLogLevel('DEBUG');
      spyOn(console, 'debug').and.stub();

      svc.debug('debug console test');

      expect(console.debug).toHaveBeenCalledTimes(1);
    });
  });

  // ─── addTransport after logging: does not affect previous entries ──────────

  describe('addTransport after logging', () => {
    it('TC-LAT-01: transport added after log call does not receive previous entries', () => {
      const svc = createServiceWithLogLevel('DEBUG');
      const t1 = jasmine.createSpyObj<LogTransport>('T1', ['log']);
      svc.addTransport(t1);

      svc.info('first');

      const t2 = jasmine.createSpyObj<LogTransport>('T2', ['log']);
      svc.addTransport(t2);

      svc.info('second');

      expect(t1.log).toHaveBeenCalledTimes(2);
      expect(t2.log).toHaveBeenCalledTimes(1);
      const lastEntry: LogEntry = t2.log.calls.mostRecent().args[0];
      expect(lastEntry.message).toBe('second');
    });
  });

  // ─── High-frequency logging ───────────────────────────────────────────────

  describe('High-frequency logging', () => {
    it('TC-LHF-01: handles 500 rapid log calls without error', () => {
      const svc = createServiceWithLogLevel('DEBUG');
      const t = jasmine.createSpyObj<LogTransport>('T', ['log']);
      svc.addTransport(t);

      expect(() => {
        for (let i = 0; i < 500; i++) {
          svc.info(`message ${i}`, { index: i });
        }
      }).not.toThrow();

      expect(t.log).toHaveBeenCalledTimes(500);
    });
  });
});
