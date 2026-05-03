import { Servicer } from './servicer.model';

describe('Servicer Model', () => {
  describe('Servicer interface', () => {
    it('TC-SR-01: should accept Servicer with all fields including optional id', () => {
      const servicer: Servicer = {
        id: 'svc-001',
        email: 'servicer@example.com',
        company: 'TechService d.o.o.',
        name: 'Nikola Nikolic',
        city: 'Beograd',
        phone: '+381601234567',
      };

      expect(servicer.id).toBe('svc-001');
      expect(servicer.email).toBe('servicer@example.com');
      expect(servicer.company).toBe('TechService d.o.o.');
      expect(servicer.name).toBe('Nikola Nikolic');
      expect(servicer.city).toBe('Beograd');
      expect(servicer.phone).toBe('+381601234567');
    });

    it('TC-SR-02: should accept Servicer without optional id', () => {
      const servicer: Servicer = {
        email: 'other@example.com',
        company: 'ServisTim',
        name: 'Marko Markovic',
        city: 'Novi Sad',
        phone: '+381641234567',
      };

      expect(servicer.id).toBeUndefined();
      expect(servicer.email).toBe('other@example.com');
      expect(servicer.company).toBe('ServisTim');
      expect(servicer.name).toBe('Marko Markovic');
      expect(servicer.city).toBe('Novi Sad');
      expect(servicer.phone).toBe('+381641234567');
    });

    // ─── Parameterizovani testovi: Servicer sa razlicitim emailovima ──────────
    const emailCases = [
      'servicer@example.com',
      'user@domain.co.rs',
      'tech.service+tag@gmail.com',
      'test@test.test',
      'a@b.c',
      'very.long.email.address@subdomain.company.example.com',
    ];

    emailCases.forEach((email) => {
      it(`Servicer should accept email="${email}"`, () => {
        const servicer: Servicer = {
          email,
          company: 'Company',
          name: 'Test Name',
          city: 'City',
          phone: '+381600000000',
        };
        expect(servicer.email).toBe(email);
        expect(typeof servicer.email).toBe('string');
      });

      it(`Servicer email="${email}" should contain "@"`, () => {
        expect(email).toContain('@');
      });
    });

    // ─── Parameterizovani testovi: Servicer sa razlicitim kompanijama ──────────
    const companyCases = [
      'TechService d.o.o.',
      'ServisTim',
      'Ariston Service Serbia',
      'Klima-Servis Beograd',
      'GAS TECHNIKA j.d.o.o.',
      'Servisi Plus 2000',
      'Toplinska tehnika',
    ];

    companyCases.forEach((company) => {
      it(`Servicer should accept company="${company}"`, () => {
        const servicer: Servicer = {
          email: 'test@test.com',
          company,
          name: 'Test',
          city: 'City',
          phone: '+381600000000',
        };
        expect(servicer.company).toBe(company);
        expect(typeof servicer.company).toBe('string');
      });

      it(`Servicer company="${company}" should be non-empty`, () => {
        expect(company.length).toBeGreaterThan(0);
      });
    });

    // ─── Parameterizovani testovi: Servicer sa razlicitim imenima ─────────────
    const nameCases = [
      'Nikola Nikolic',
      'Marko Markovic',
      'Ana Anic',
      'Petar Petrovic',
      'Jovan Jovanovic',
      'Stefan Stefanovic',
      'Milica Milicevic',
      'Dragan Draganovic',
    ];

    nameCases.forEach((name) => {
      it(`Servicer should accept name="${name}"`, () => {
        const servicer: Servicer = {
          email: 'test@test.com',
          company: 'Company',
          name,
          city: 'City',
          phone: '+381600000000',
        };
        expect(servicer.name).toBe(name);
        expect(typeof servicer.name).toBe('string');
      });
    });

    // ─── Parameterizovani testovi: Servicer sa razlicitim gradovima ───────────
    const cityCases = [
      'Beograd',
      'Novi Sad',
      'Nis',
      'Kragujevac',
      'Subotica',
      'Cacak',
      'Uzice',
      'Pancevo',
      'Zrenjanin',
      'Smederevo',
      'Leskovac',
      'Valjevo',
    ];

    cityCases.forEach((city) => {
      it(`Servicer should accept city="${city}"`, () => {
        const servicer: Servicer = {
          email: 'test@test.com',
          company: 'Company',
          name: 'Test Name',
          city,
          phone: '+381600000000',
        };
        expect(servicer.city).toBe(city);
        expect(typeof servicer.city).toBe('string');
      });
    });

    // ─── Parameterizovani testovi: Servicer sa razlicitim telefonima ──────────
    const phoneCases = [
      '+381601234567',
      '+381641234567',
      '+381111234567',
      '0601234567',
      '381601234567',
      '+1-800-555-0199',
      '+44 20 7946 0958',
    ];

    phoneCases.forEach((phone) => {
      it(`Servicer should accept phone="${phone}"`, () => {
        const servicer: Servicer = {
          email: 'test@test.com',
          company: 'Company',
          name: 'Test Name',
          city: 'City',
          phone,
        };
        expect(servicer.phone).toBe(phone);
        expect(typeof servicer.phone).toBe('string');
      });
    });

    // ─── Parameterizovani testovi: Servicer id variants ──────────────────────
    const idCases = [
      'svc-001',
      'svc-abc-def',
      'firebase-uid-abc123',
      'user-test-uid-001',
      '123456',
    ];

    idCases.forEach((id) => {
      it(`Servicer should accept id="${id}"`, () => {
        const servicer: Servicer = {
          id,
          email: 'test@test.com',
          company: 'Company',
          name: 'Test',
          city: 'City',
          phone: '+381600000000',
        };
        expect(servicer.id).toBe(id);
        expect(typeof servicer.id).toBe('string');
      });
    });

    // ─── Field type checks ────────────────────────────────────────────────────
    it('Servicer email should be of type string', () => {
      const s: Servicer = { email: 'e@e.com', company: 'C', name: 'N', city: 'Ci', phone: 'P' };
      expect(typeof s.email).toBe('string');
    });

    it('Servicer company should be of type string', () => {
      const s: Servicer = { email: 'e@e.com', company: 'C', name: 'N', city: 'Ci', phone: 'P' };
      expect(typeof s.company).toBe('string');
    });

    it('Servicer name should be of type string', () => {
      const s: Servicer = { email: 'e@e.com', company: 'C', name: 'N', city: 'Ci', phone: 'P' };
      expect(typeof s.name).toBe('string');
    });

    it('Servicer city should be of type string', () => {
      const s: Servicer = { email: 'e@e.com', company: 'C', name: 'N', city: 'Ci', phone: 'P' };
      expect(typeof s.city).toBe('string');
    });

    it('Servicer phone should be of type string', () => {
      const s: Servicer = { email: 'e@e.com', company: 'C', name: 'N', city: 'Ci', phone: 'P' };
      expect(typeof s.phone).toBe('string');
    });

    // ─── Required fields presence ─────────────────────────────────────────────
    const requiredServicerFields = ['email', 'company', 'name', 'city', 'phone'];

    requiredServicerFields.forEach((field) => {
      it(`Servicer should have required field: ${field}`, () => {
        const s: Servicer = { email: 'e@e.com', company: 'C', name: 'N', city: 'Ci', phone: 'P' };
        expect(field in s).toBe(true);
      });
    });

    // ─── Equality checks ──────────────────────────────────────────────────────
    it('two Servicers with same data should be deeply equal', () => {
      const s1: Servicer = { id: 'svc-001', email: 'a@a.com', company: 'C', name: 'N', city: 'Ci', phone: 'P' };
      const s2: Servicer = { id: 'svc-001', email: 'a@a.com', company: 'C', name: 'N', city: 'Ci', phone: 'P' };
      expect(s1).toEqual(s2);
    });

    it('two Servicers with different id should NOT be equal', () => {
      const s1: Servicer = { id: 'svc-001', email: 'a@a.com', company: 'C', name: 'N', city: 'Ci', phone: 'P' };
      const s2: Servicer = { id: 'svc-002', email: 'a@a.com', company: 'C', name: 'N', city: 'Ci', phone: 'P' };
      expect(s1).not.toEqual(s2);
    });

    // ─── Edge cases ───────────────────────────────────────────────────────────
    it('Servicer email can be empty string', () => {
      const s: Servicer = { email: '', company: 'C', name: 'N', city: 'Ci', phone: 'P' };
      expect(s.email).toBe('');
    });

    it('Servicer phone can be empty string', () => {
      const s: Servicer = { email: 'e@e.com', company: 'C', name: 'N', city: 'Ci', phone: '' };
      expect(s.phone).toBe('');
    });

    it('Servicer name can contain diacritics', () => {
      const s: Servicer = { email: 'e@e.com', company: 'C', name: 'Đorđe Đorđević', city: 'Ci', phone: 'P' };
      expect(s.name).toContain('Đ');
    });

    it('Servicer company can contain special chars', () => {
      const s: Servicer = { email: 'e@e.com', company: 'Servis & Co. d.o.o.', name: 'N', city: 'Ci', phone: 'P' };
      expect(s.company).toContain('&');
    });

    it('Servicer name can be a long string', () => {
      const longName = 'A'.repeat(500);
      const s: Servicer = { email: 'e@e.com', company: 'C', name: longName, city: 'Ci', phone: 'P' };
      expect(s.name.length).toBe(500);
    });

    it('Servicer id should be undefined when not provided', () => {
      const s: Servicer = { email: 'e@e.com', company: 'C', name: 'N', city: 'Ci', phone: 'P' };
      expect(s.id).toBeUndefined();
    });

    // ─── JSON serialization ───────────────────────────────────────────────────
    it('Servicer should be JSON serializable', () => {
      const s: Servicer = { id: 'svc-001', email: 'e@e.com', company: 'C', name: 'N', city: 'Ci', phone: 'P' };
      const parsed: Servicer = JSON.parse(JSON.stringify(s));
      expect(parsed.id).toBe('svc-001');
      expect(parsed.email).toBe('e@e.com');
      expect(parsed.company).toBe('C');
    });

    // ─── Spread / copy ────────────────────────────────────────────────────────
    it('Servicer can be spread into new Servicer with override', () => {
      const original: Servicer = { id: 'svc-001', email: 'a@a.com', company: 'C', name: 'N', city: 'Beograd', phone: 'P' };
      const updated: Servicer = { ...original, city: 'Novi Sad' };
      expect(updated.city).toBe('Novi Sad');
      expect(original.city).toBe('Beograd');
    });

    // ─── Array of Servicers ───────────────────────────────────────────────────
    it('array of Servicers should work correctly', () => {
      const servicers: Servicer[] = nameCases.map((name, i) => ({
        id: `svc-${String(i + 1).padStart(3, '0')}`,
        email: `svc${i}@example.com`,
        company: 'Company',
        name,
        city: cityCases[i % cityCases.length],
        phone: '+381600000000',
      }));
      expect(servicers.length).toBe(nameCases.length);
      servicers.forEach((s) => {
        expect(typeof s.name).toBe('string');
        expect(typeof s.email).toBe('string');
      });
    });
  });
});
