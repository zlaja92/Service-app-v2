import { TestBed } from '@angular/core/testing';
import { PreferencesService } from './preferences.service';

// ─── Mocking strategy note ─────────────────────────────────────────────────
// Preferences (from @capacitor/preferences) is a Proxy created by registerPlugin().
// Its get() trap intercepts all property access, so spyOn(Preferences, 'get')
// silently fails — the spy is never installed (same pattern as CapacitorHttp).
//
// In Karma/browser environment the Proxy delegates to PreferencesWeb (web impl),
// which stores values in window.localStorage with prefix 'CapacitorStorage.'.
//
// Strategy: spy on window.localStorage methods to verify calls,
// and use a fresh localStorage state per test via beforeEach/afterEach cleanup.
// ──────────────────────────────────────────────────────────────────────────

/** Capacitor Preferences web impl prefixes every key with 'CapacitorStorage.' */
const PREFIX = 'CapacitorStorage.';

describe('PreferencesService', () => {
  let service: PreferencesService;

  beforeEach(() => {
    // Clean localStorage before each test to ensure isolation
    localStorage.clear();

    TestBed.configureTestingModule({
      providers: [PreferencesService],
    });

    service = TestBed.inject(PreferencesService);
  });

  afterEach(() => {
    localStorage.clear();
  });

  // ─── TC-WU06-01: get returns value when present ─────────────────────────

  it('TC-WU06-01: get(key) returns stored value when key is present', async () => {
    localStorage.setItem(`${PREFIX}user_lang`, 'sr');

    const result = await service.get('user_lang');

    expect(result).toBe('sr');
  });

  // ─── TC-WU06-02: get returns null when key not present ──────────────────

  it('TC-WU06-02: get(key) returns null when key is not present', async () => {
    const result = await service.get('nonexistent_key');

    expect(result).toBeNull();
  });

  // ─── TC-WU06-03: set stores value ───────────────────────────────────────

  it('TC-WU06-03: set(key, value) persists value in underlying storage', async () => {
    await service.set('theme', 'dark');

    expect(localStorage.getItem(`${PREFIX}theme`)).toBe('dark');
  });

  // ─── TC-WU06-04: set then get round-trip ────────────────────────────────

  it('TC-WU06-04: set then get round-trip returns the stored value', async () => {
    await service.set('access_token', 'abc123');
    const result = await service.get('access_token');

    expect(result).toBe('abc123');
  });

  // ─── TC-WU06-05: remove clears single key ───────────────────────────────

  it('TC-WU06-05: remove(key) deletes only the specified key', async () => {
    await service.set('key_a', 'value_a');
    await service.set('key_b', 'value_b');

    await service.remove('key_a');

    expect(localStorage.getItem(`${PREFIX}key_a`)).toBeNull();
    expect(localStorage.getItem(`${PREFIX}key_b`)).toBe('value_b');
  });

  // ─── TC-WU06-06: clear removes all keys ─────────────────────────────────

  it('TC-WU06-06: clear() removes all Capacitor-prefixed keys from storage', async () => {
    await service.set('key_1', 'val_1');
    await service.set('key_2', 'val_2');
    await service.set('key_3', 'val_3');

    await service.clear();

    expect(localStorage.getItem(`${PREFIX}key_1`)).toBeNull();
    expect(localStorage.getItem(`${PREFIX}key_2`)).toBeNull();
    expect(localStorage.getItem(`${PREFIX}key_3`)).toBeNull();
  });

  // ─── TC-WU06-07: multiple sequential set/get preserve isolation ──────────

  it('TC-WU06-07: multiple sequential set/get operations preserve key isolation', async () => {
    await service.set('lang', 'en');
    await service.set('timezone', 'UTC+1');
    await service.set('notifications', 'true');

    const lang = await service.get('lang');
    const timezone = await service.get('timezone');
    const notifications = await service.get('notifications');

    expect(lang).toBe('en');
    expect(timezone).toBe('UTC+1');
    expect(notifications).toBe('true');
  });

  // ─── TC-WU06-08: empty string value can be stored and retrieved ───────────

  it('TC-WU06-08: empty string value can be stored and retrieved', async () => {
    await service.set('empty_val', '');
    const result = await service.get('empty_val');

    expect(result).toBe('');
  });

  // ─── TC-WU06-09 (bonus): special characters in key/value ─────────────────

  it('TC-WU06-09: special characters and Unicode in key/value are stored and retrieved correctly', async () => {
    const unicodeValue = 'Здраво свете! \u{1F30D} <>&"\'';
    const jsonValue = JSON.stringify({ nested: true, count: 42, arr: [1, 2, 3] });

    await service.set('unicode_key', unicodeValue);
    await service.set('json_payload', jsonValue);

    const retrievedUnicode = await service.get('unicode_key');
    const retrievedJson = await service.get('json_payload');

    expect(retrievedUnicode).toBe(unicodeValue);
    expect(retrievedJson).toBe(jsonValue);
    expect(JSON.parse(retrievedJson!)).toEqual({ nested: true, count: 42, arr: [1, 2, 3] });
  });

  // ─── TC-WU06-10 (bonus): removed key returns null ────────────────────────

  it('TC-WU06-10: get returns null for a key that has been removed', async () => {
    await service.set('temp_key', 'temp_value');
    await service.remove('temp_key');

    const result = await service.get('temp_key');

    expect(result).toBeNull();
  });

  // ─── Parameterized: key variants ──────────────────────────────────────────

  describe('Parameterized: key variants for set() and get()', () => {
    const keyVariants = [
      'simple_key',
      'key-with-dashes',
      'key.with.dots',
      'key/with/slashes',
      'KEY_UPPERCASE',
      'mixedCaseKey',
      'key123',
      '123key',
      'a',
      'k'.repeat(200),
      'key with spaces',
      'key\twith\ttabs',
      'key\nwith\nnewlines',
      'key@special#chars!',
      'key(with)parens',
      'key[with]brackets',
      'key{with}braces',
      'key<with>angles',
      'ΚΛΕΙΔΊ',
      'кључ',
      'مفتاح',
      '键',
      'key🔑',
    ];

    keyVariants.forEach((key) => {
      it(`TC-PREF-KEY-"${key.slice(0, 25)}": set and get round-trip for key "${key.slice(0, 25)}"`, async () => {
        const value = `value-for-${key.slice(0, 10)}`;

        await service.set(key, value);
        const result = await service.get(key);

        expect(result).toBe(value);
      });
    });
  });

  // ─── Parameterized: value variants ───────────────────────────────────────

  describe('Parameterized: value variants for set() and get()', () => {
    const valueVariants = [
      '',
      ' ',
      '\t',
      '\n',
      'a',
      'Hello World',
      'v'.repeat(10000),
      '{"json": "value", "number": 42, "bool": true}',
      '[1, 2, 3, "array"]',
      'null',
      'undefined',
      'true',
      'false',
      '0',
      '-1',
      '1.5',
      'Привет мир',
      '你好世界',
      'مرحبا بالعالم',
      '🚀🔥💥🌍',
      '<script>alert(1)</script>',
      '"; DROP TABLE keys; --',
      '&lt;div class=&quot;test&quot;&gt;',
      '../../../etc/passwd',
      'a\0b',
      'line1\nline2\nline3',
    ];

    valueVariants.forEach((value) => {
      const label = value.slice(0, 25).replace(/\n/g, '\\n').replace(/\t/g, '\\t').replace(/\0/g, '\\0');
      it(`TC-PREF-VAL-"${label}": set and get round-trip for value "${label}"`, async () => {
        await service.set('test_key', value);
        const result = await service.get('test_key');

        expect(result).toBe(value);
      });
    });
  });

  // ─── Parameterized: remove() — various keys ───────────────────────────────

  describe('Parameterized: remove() for various key types', () => {
    const keysToRemove = [
      'simple',
      'key-with-dashes',
      'key_with_underscores',
      'key.with.dots',
      'KEY_UPPER',
      'mixedCase',
      'unicode_кључ',
    ];

    keysToRemove.forEach((key) => {
      it(`TC-PREF-REM-${key}: remove("${key}") clears the key`, async () => {
        await service.set(key, 'some-value');
        await service.remove(key);

        const result = await service.get(key);
        expect(result).toBeNull();
      });
    });
  });

  // ─── Parameterized: clear() clears multiple keys ──────────────────────────

  describe('Parameterized: clear() removes all previously set keys', () => {
    const keysets = [
      ['k1'],
      ['k1', 'k2'],
      ['k1', 'k2', 'k3'],
      ['a', 'b', 'c', 'd', 'e'],
      Array.from({ length: 10 }, (_, i) => `key_${i}`),
    ];

    keysets.forEach((keys) => {
      it(`TC-PREF-CLR-${keys.length}keys: clear() removes all ${keys.length} keys`, async () => {
        for (const key of keys) {
          await service.set(key, `val-${key}`);
        }

        await service.clear();

        for (const key of keys) {
          expect(await service.get(key)).toBeNull();
        }
      });
    });
  });

  // ─── Parameterized: get() returns null for non-existent keys ─────────────

  describe('Parameterized: get() returns null for non-existent keys', () => {
    const nonExistentKeys = [
      'does_not_exist',
      'never_set',
      '',
      'NULL',
      'undefined',
      '0',
      'false',
    ];

    nonExistentKeys.forEach((key) => {
      it(`TC-PREF-NOKEY-"${key}": get("${key}") returns null when key was never set`, async () => {
        const result = await service.get(key);

        expect(result).toBeNull();
      });
    });
  });

  // ─── Parameterized: overwrite existing key ────────────────────────────────

  describe('Parameterized: set() overwrites existing value', () => {
    const overwriteCases = [
      { initial: 'first', updated: 'second' },
      { initial: 'value1', updated: '' },
      { initial: '', updated: 'new-value' },
      { initial: 'long ' + 'x'.repeat(1000), updated: 'short' },
      { initial: 'english', updated: 'кирилица' },
    ];

    overwriteCases.forEach(({ initial, updated }) => {
      const label = `${initial.slice(0, 10)} → ${updated.slice(0, 10)}`;
      it(`TC-PREF-OVW-"${label}": set() overwrites "${initial.slice(0, 10)}" with "${updated.slice(0, 10)}"`, async () => {
        await service.set('overwrite_key', initial);
        await service.set('overwrite_key', updated);

        const result = await service.get('overwrite_key');
        expect(result).toBe(updated);
      });
    });
  });

  // ─── Parameterized: concurrent set/get operations ─────────────────────────

  describe('Parameterized: concurrent operations', () => {
    const concurrentCounts = [2, 5, 10, 20];

    concurrentCounts.forEach((count) => {
      it(`TC-PREF-CONC-${count}: ${count} concurrent set operations resolve correctly`, async () => {
        const pairs = Array.from({ length: count }, (_, i) => ({
          key: `concurrent_key_${i}`,
          value: `concurrent_value_${i}`,
        }));

        await Promise.all(pairs.map(({ key, value }) => service.set(key, value)));

        for (const { key, value } of pairs) {
          expect(await service.get(key)).toBe(value);
        }
      });
    });
  });
});
