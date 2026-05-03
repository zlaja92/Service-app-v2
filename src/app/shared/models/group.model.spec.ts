import { Group } from './group.model';

describe('Group Model', () => {
  describe('Group interface', () => {
    it('TC-GR-01: should accept valid Group with all fields', () => {
      const group: Group = {
        id: 'group-001',
        name: 'Living Room',
        groupPhoto: 'https://example.com/photo.jpg',
      };

      expect(group.id).toBe('group-001');
      expect(group.name).toBe('Living Room');
      expect(group.groupPhoto).toBe('https://example.com/photo.jpg');
    });

    it('TC-GR-02: all 3 fields are required (none optional)', () => {
      const keys = ['id', 'name', 'groupPhoto'];

      const group: Group = {
        id: 'group-002',
        name: 'Bedroom',
        groupPhoto: 'photo-url',
      };

      keys.forEach((key) => {
        expect(key in group).toBe(true);
      });

      expect(typeof group.id).toBe('string');
      expect(typeof group.name).toBe('string');
      expect(typeof group.groupPhoto).toBe('string');
    });

    // ─── Parameterizovani testovi: Group sa razlicitim ID-jevima ───────────────
    const groupIdCases = [
      'group-001',
      'group-abc-xyz',
      'g',
      '12345',
      'a'.repeat(100),
      'GROUP_SPECIAL_123',
    ];

    groupIdCases.forEach((id) => {
      it(`Group should accept id="${id.substring(0, 40)}"`, () => {
        const group: Group = { id, name: 'Test', groupPhoto: 'photo' };
        expect(group.id).toBe(id);
        expect(typeof group.id).toBe('string');
      });
    });

    // ─── Parameterizovani testovi: Group sa razlicitim imenima ─────────────────
    const groupNameCases = [
      'Living Room',
      'Bedroom',
      'Kitchen',
      'Bathroom',
      'Boiler Room',
      'Basement',
      'Attic',
      'Garage',
      'Office',
      'Hall',
    ];

    groupNameCases.forEach((name) => {
      it(`Group should accept name="${name}"`, () => {
        const group: Group = { id: 'g-001', name, groupPhoto: 'photo' };
        expect(group.name).toBe(name);
        expect(typeof group.name).toBe('string');
      });

      it(`Group name "${name}" should be non-empty`, () => {
        const group: Group = { id: 'g-001', name, groupPhoto: 'photo' };
        expect(group.name.length).toBeGreaterThan(0);
      });
    });

    // ─── Parameterizovani testovi: groupPhoto URL formati ──────────────────────
    const photoUrlCases = [
      'https://example.com/photo.jpg',
      'https://storage.googleapis.com/bucket/photo.png',
      'http://localhost:3000/photo.gif',
      '/assets/default-group.png',
      'data:image/jpeg;base64,/9j/4AAQSkZJRg==',
      '',
      'photo-url-without-protocol',
    ];

    photoUrlCases.forEach((url) => {
      it(`Group should accept groupPhoto="${url.substring(0, 50)}"`, () => {
        const group: Group = { id: 'g-001', name: 'Test', groupPhoto: url };
        expect(group.groupPhoto).toBe(url);
        expect(typeof group.groupPhoto).toBe('string');
      });
    });

    // ─── Field type checks ─────────────────────────────────────────────────────
    it('Group id should be of type string', () => {
      const group: Group = { id: 'g-test', name: 'Test', groupPhoto: 'p' };
      expect(typeof group.id).toBe('string');
    });

    it('Group name should be of type string', () => {
      const group: Group = { id: 'g-test', name: 'Test', groupPhoto: 'p' };
      expect(typeof group.name).toBe('string');
    });

    it('Group groupPhoto should be of type string', () => {
      const group: Group = { id: 'g-test', name: 'Test', groupPhoto: 'p' };
      expect(typeof group.groupPhoto).toBe('string');
    });

    // ─── Object identity and equality ─────────────────────────────────────────
    it('two Group objects with same data should be deeply equal', () => {
      const g1: Group = { id: 'same', name: 'Room', groupPhoto: 'url' };
      const g2: Group = { id: 'same', name: 'Room', groupPhoto: 'url' };
      expect(g1).toEqual(g2);
    });

    it('two Group objects with different id should NOT be equal', () => {
      const g1: Group = { id: 'g-001', name: 'Room', groupPhoto: 'url' };
      const g2: Group = { id: 'g-002', name: 'Room', groupPhoto: 'url' };
      expect(g1).not.toEqual(g2);
    });

    it('two Group objects with different name should NOT be equal', () => {
      const g1: Group = { id: 'g-001', name: 'Living Room', groupPhoto: 'url' };
      const g2: Group = { id: 'g-001', name: 'Bedroom', groupPhoto: 'url' };
      expect(g1).not.toEqual(g2);
    });

    it('two Group objects with different photo should NOT be equal', () => {
      const g1: Group = { id: 'g-001', name: 'Room', groupPhoto: 'url1' };
      const g2: Group = { id: 'g-001', name: 'Room', groupPhoto: 'url2' };
      expect(g1).not.toEqual(g2);
    });

    // ─── Array of Groups ──────────────────────────────────────────────────────
    it('array of Groups should work correctly', () => {
      const groups: Group[] = [
        { id: 'g-001', name: 'Living Room', groupPhoto: 'url1' },
        { id: 'g-002', name: 'Bedroom', groupPhoto: 'url2' },
        { id: 'g-003', name: 'Kitchen', groupPhoto: 'url3' },
      ];

      expect(groups.length).toBe(3);
      expect(groups[0].id).toBe('g-001');
      expect(groups[1].name).toBe('Bedroom');
      expect(groups[2].groupPhoto).toBe('url3');
    });

    it('empty array of Groups should be valid', () => {
      const groups: Group[] = [];
      expect(groups.length).toBe(0);
      expect(Array.isArray(groups)).toBe(true);
    });

    it('Group should have exactly 3 own properties', () => {
      const group: Group = { id: 'g', name: 'n', groupPhoto: 'p' };
      expect(Object.keys(group).length).toBe(3);
    });

    // ─── Edge cases / fuzz ────────────────────────────────────────────────────
    const xssPayloads = [
      '<script>alert(1)</script>',
      '"><img src=x onerror=alert(1)>',
      "'; DROP TABLE groups; --",
    ];

    xssPayloads.forEach((payload) => {
      it(`Group name stores XSS payload safely (type check): "${payload.substring(0, 30)}"`, () => {
        const group: Group = { id: 'g-001', name: payload, groupPhoto: '' };
        expect(group.name).toBe(payload);
        expect(typeof group.name).toBe('string');
      });
    });

    const unicodeNames = [
      '中文房间',
      'Wohnzimmer',
      'غرفة المعيشة',
      'гостиная',
      'Çalışma odası',
    ];

    unicodeNames.forEach((name) => {
      it(`Group name accepts unicode: "${name}"`, () => {
        const group: Group = { id: 'g-001', name, groupPhoto: '' };
        expect(group.name).toBe(name);
        expect(typeof group.name).toBe('string');
      });
    });

    it('Group name can be 1000 character long string', () => {
      const longName = 'R'.repeat(1000);
      const group: Group = { id: 'g-001', name: longName, groupPhoto: '' };
      expect(group.name.length).toBe(1000);
    });

    it('Group id can be 1000 character long string', () => {
      const longId = 'I'.repeat(1000);
      const group: Group = { id: longId, name: 'Room', groupPhoto: '' };
      expect(group.id.length).toBe(1000);
    });

    it('Group groupPhoto can be empty string', () => {
      const group: Group = { id: 'g-001', name: 'Room', groupPhoto: '' };
      expect(group.groupPhoto).toBe('');
      expect(group.groupPhoto.length).toBe(0);
    });

    it('Group id can be empty string', () => {
      const group: Group = { id: '', name: 'Room', groupPhoto: 'p' };
      expect(group.id).toBe('');
    });

    // ─── Object spread / copy ────────────────────────────────────────────────
    it('Group object can be spread into new Group', () => {
      const original: Group = { id: 'g-001', name: 'Room', groupPhoto: 'url' };
      const copy: Group = { ...original, name: 'New Room' };
      expect(copy.id).toBe('g-001');
      expect(copy.name).toBe('New Room');
      expect(copy.groupPhoto).toBe('url');
    });

    it('spreading Group should not mutate original', () => {
      const original: Group = { id: 'g-001', name: 'Room', groupPhoto: 'url' };
      const modified: Group = { ...original, id: 'g-999' };
      expect(original.id).toBe('g-001');
      expect(modified.id).toBe('g-999');
    });

    // ─── JSON serialization ───────────────────────────────────────────────────
    it('Group should be JSON serializable', () => {
      const group: Group = { id: 'g-001', name: 'Living Room', groupPhoto: 'url' };
      const json = JSON.stringify(group);
      const parsed = JSON.parse(json) as Group;
      expect(parsed.id).toBe('g-001');
      expect(parsed.name).toBe('Living Room');
      expect(parsed.groupPhoto).toBe('url');
    });

    it('parsed Group from JSON should have all fields', () => {
      const group: Group = { id: 'g-test', name: 'Test Room', groupPhoto: 'test-url' };
      const parsed: Group = JSON.parse(JSON.stringify(group));
      expect(Object.keys(parsed).sort()).toEqual(['groupPhoto', 'id', 'name']);
    });
  });
});
