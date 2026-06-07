import { trimDeep, stripWhitespace, hasWhitespace } from './trim';

// ---------------------------------------------------------------------------
// Helper: Timestamp-like class whose prototype !== Object.prototype
// ---------------------------------------------------------------------------
class FakeTimestamp {
  constructor(private seconds: number) {}
  toDate(): Date {
    return new Date(this.seconds * 1000);
  }
}

// ---------------------------------------------------------------------------
// Helper: plain-object factory
// ---------------------------------------------------------------------------
function plainObj(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return Object.assign(Object.create(Object.prototype), overrides);
}

// ===========================================================================
describe('trim utils (shared/utils/trim)', () => {

  // =========================================================================
  describe('trimDeep', () => {

    // ── Strings ────────────────────────────────────────────────────────────

    it('should trim leading and trailing whitespace from a string', () => {
      expect(trimDeep('  hello  ')).toBe('hello');
    });

    it('should trim leading whitespace only', () => {
      expect(trimDeep('   world')).toBe('world');
    });

    it('should trim trailing whitespace only', () => {
      expect(trimDeep('world   ')).toBe('world');
    });

    it('should return empty string for whitespace-only string', () => {
      expect(trimDeep('   ')).toBe('');
    });

    it('should return empty string unchanged', () => {
      expect(trimDeep('')).toBe('');
    });

    // ── Primitives (non-string) ────────────────────────────────────────────

    it('should return null unchanged', () => {
      expect(trimDeep(null)).toBeNull();
    });

    it('should return undefined unchanged', () => {
      expect(trimDeep(undefined)).toBeUndefined();
    });

    it('should return a number unchanged', () => {
      expect(trimDeep(42)).toBe(42);
    });

    it('should return boolean true unchanged', () => {
      expect(trimDeep(true)).toBe(true);
    });

    it('should return boolean false unchanged', () => {
      expect(trimDeep(false)).toBe(false);
    });

    // ── Empty collections ──────────────────────────────────────────────────

    it('should return empty object unchanged', () => {
      expect(trimDeep({})).toEqual({});
    });

    it('should return empty array unchanged', () => {
      expect(trimDeep([])).toEqual([]);
    });

    // ── Arrays ────────────────────────────────────────────────────────────

    it('should trim all strings inside an array of strings', () => {
      expect(trimDeep(['  a  ', ' b', 'c '])).toEqual(['a', 'b', 'c']);
    });

    it('should handle a mixed array of string, number, boolean, null, nested object', () => {
      const input = ['  hello  ', 42, true, null, { name: '  world  ' }];
      const result = trimDeep(input);
      expect(result[0]).toBe('hello');
      expect(result[1]).toBe(42);
      expect(result[2]).toBe(true);
      expect(result[3]).toBeNull();
      expect((result[4] as Record<string, unknown>)['name']).toBe('world');
    });

    // ── Plain objects ──────────────────────────────────────────────────────

    it('should trim all string fields of a plain object', () => {
      const input = { first: '  Ana  ', last: 'Jovanovic  ' };
      expect(trimDeep(input)).toEqual({ first: 'Ana', last: 'Jovanovic' });
    });

    it('should recursively trim nested plain objects at 3+ levels', () => {
      const input = {
        level1: '  L1  ',
        nested: {
          level2: '  L2  ',
          deeper: {
            level3: '  L3  ',
            deepest: {
              level4: '  L4  ',
            },
          },
        },
      };
      const result = trimDeep(input);
      expect(result.level1).toBe('L1');
      expect((result.nested as any).level2).toBe('L2');
      expect((result.nested as any).deeper.level3).toBe('L3');
      expect((result.nested as any).deeper.deepest.level4).toBe('L4');
    });

    // ── Class instances pass through untouched ─────────────────────────────

    it('should return a Date instance untouched', () => {
      const date = new Date('2024-06-01T12:00:00Z');
      const result = trimDeep(date);
      expect(result).toBe(date);
      expect(result instanceof Date).toBe(true);
    });

    it('should return a Timestamp-like object with custom prototype untouched', () => {
      const ts = new FakeTimestamp(1717236000);
      const result = trimDeep(ts);
      expect(result).toBe(ts);
      expect(result instanceof FakeTimestamp).toBe(true);
    });

    it('should return a class instance created via Object.create(customProto) untouched', () => {
      const customProto = { toDate() { return new Date(); } };
      const tsLike = Object.create(customProto) as typeof customProto & { seconds: number };
      tsLike.seconds = 1717236000;
      const result = trimDeep(tsLike);
      expect(result).toBe(tsLike);
    });

    it('should return any class instance (non-plain object) untouched', () => {
      class MyModel {
        constructor(public value: string) {}
      }
      const instance = new MyModel('  test  ');
      const result = trimDeep(instance);
      expect(result).toBe(instance);
      expect(result.value).toBe('  test  '); // NOT trimmed — class instance passes through as-is
    });

    // ── Mixed: nested object with Date + string fields ─────────────────────

    it('should trim string fields but leave Date instances untouched in a nested object', () => {
      const date = new Date('2024-01-15T00:00:00Z');
      const input = {
        name: '  Petar  ',
        createdAt: date,
        nested: {
          label: '  label  ',
          updatedAt: date,
        },
      };
      const result = trimDeep(input);
      expect(result.name).toBe('Petar');
      expect(result.createdAt).toBe(date);
      expect(result.createdAt instanceof Date).toBe(true);
      expect((result.nested as any).label).toBe('label');
      expect((result.nested as any).updatedAt).toBe(date);
      expect((result.nested as any).updatedAt instanceof Date).toBe(true);
    });
  });

  // =========================================================================
  describe('stripWhitespace', () => {

    it('should return a string without spaces unchanged', () => {
      expect(stripWhitespace('abc123')).toBe('abc123');
    });

    it('should remove leading whitespace', () => {
      expect(stripWhitespace('  abc')).toBe('abc');
    });

    it('should remove trailing whitespace', () => {
      expect(stripWhitespace('abc  ')).toBe('abc');
    });

    it('should remove inner spaces', () => {
      expect(stripWhitespace('a b c')).toBe('abc');
    });

    it('should remove tabs', () => {
      expect(stripWhitespace('a\tb\tc')).toBe('abc');
    });

    it('should remove newlines', () => {
      expect(stripWhitespace('a\nb\nc')).toBe('abc');
    });

    it('should collapse multiple consecutive spaces', () => {
      expect(stripWhitespace('a   b   c')).toBe('abc');
    });

    it('should return empty string for empty input', () => {
      expect(stripWhitespace('')).toBe('');
    });

    it('should return empty string for whitespace-only input', () => {
      expect(stripWhitespace('   \t\n  ')).toBe('');
    });
  });

  // =========================================================================
  describe('hasWhitespace', () => {

    it('should return true when string contains an inner space', () => {
      expect(hasWhitespace('hello world')).toBe(true);
    });

    it('should return false for a string with no whitespace', () => {
      expect(hasWhitespace('helloworld')).toBe(false);
    });

    it('should return true when string contains a tab', () => {
      expect(hasWhitespace('hello\tworld')).toBe(true);
    });

    it('should return true when string contains a newline', () => {
      expect(hasWhitespace('hello\nworld')).toBe(true);
    });

    it('should return false for empty string', () => {
      expect(hasWhitespace('')).toBe(false);
    });

    it('should return true for whitespace-only string', () => {
      expect(hasWhitespace('   ')).toBe(true);
    });
  });
});
