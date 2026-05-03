import { DeviceUser, UserAddType } from './user.model';
import { DeviceType } from './device.model';

describe('User Model', () => {
  describe('UserAddType enum', () => {
    it('TC-US-01: should contain exactly 2 enum members', () => {
      const values = Object.values(UserAddType);
      expect(values.length).toBe(2);
    });

    it('TC-US-02: COMMIS should equal "COMMIS"', () => {
      expect(UserAddType.COMMIS).toBe('COMMIS');
    });

    it('TC-US-03: NO_COMMIS should equal "NO_COMMIS"', () => {
      expect(UserAddType.NO_COMMIS).toBe('NO_COMMIS');
    });

    // ─── Parameterizovani testovi za UserAddType ───────────────────────────────
    const userAddTypeCases: Array<[keyof typeof UserAddType, string]> = [
      ['COMMIS', 'COMMIS'],
      ['NO_COMMIS', 'NO_COMMIS'],
    ];

    userAddTypeCases.forEach(([key, value]) => {
      it(`UserAddType.${key} should equal "${value}"`, () => {
        expect(UserAddType[key]).toBe(value);
      });

      it(`UserAddType.${key} should be a string`, () => {
        expect(typeof UserAddType[key]).toBe('string');
      });

      it(`UserAddType.${key} should be non-empty`, () => {
        expect(UserAddType[key].length).toBeGreaterThan(0);
      });

      it(`UserAddType.${key} should be uppercase`, () => {
        expect(UserAddType[key]).toBe(UserAddType[key].toUpperCase());
      });
    });

    it('UserAddType values should be unique', () => {
      const values = Object.values(UserAddType);
      const unique = new Set(values);
      expect(unique.size).toBe(values.length);
    });

    it('UserAddType should contain "COMMIS" in values', () => {
      const values: string[] = Object.values(UserAddType);
      expect(values).toContain('COMMIS');
    });

    it('UserAddType should contain "NO_COMMIS" in values', () => {
      const values: string[] = Object.values(UserAddType);
      expect(values).toContain('NO_COMMIS');
    });

    it('UserAddType should not contain empty string', () => {
      const values: string[] = Object.values(UserAddType);
      expect(values).not.toContain('');
    });

    it('UserAddType.COMMIS and NO_COMMIS should differ', () => {
      expect(UserAddType.COMMIS).not.toBe(UserAddType.NO_COMMIS);
    });
  });

  describe('DeviceUser interface', () => {
    const baseUser: DeviceUser = {
      firstName: 'Marko',
      lastName: 'Markovic',
      street: 'Bulevar Kralja Aleksandra',
      homeNumber: '73',
      city: 'Beograd',
      postalCode: '11000',
      phone: '+381601234567',
      connectedDeviceSN: '',
      installerName: 'Nikola Nikolic',
      installerPhoneNumber: '+381691234567',
      dateOfPurchase: new Date('2023-06-15'),
      lastWarrantyExtension: new Date('2024-06-15'),
      voidWarranty: false,
      callAccepted: true,
      addedBy: 'user-test-uid-001',
      additionType: UserAddType.NO_COMMIS,
    };

    it('TC-US-04: should accept DeviceUser with all fields, dateOfPurchase as Date', () => {
      const user: DeviceUser = { ...baseUser };

      expect(user.firstName).toBe('Marko');
      expect(user.lastName).toBe('Markovic');
      expect(user.dateOfPurchase).toEqual(new Date('2023-06-15'));
      expect(user.dateOfPurchase instanceof Date).toBe(true);
      expect(user.voidWarranty).toBe(false);
      expect(user.callAccepted).toBe(true);
      expect(user.additionType).toBe(UserAddType.NO_COMMIS);
    });

    it('TC-US-05: should accept DeviceUser with dateOfPurchase as null', () => {
      const user: DeviceUser = {
        ...baseUser,
        dateOfPurchase: null,
      };

      expect(user.dateOfPurchase).toBeNull();
    });

    it('TC-US-06: should accept DeviceUser with lastWarrantyExtension as null', () => {
      const user: DeviceUser = {
        ...baseUser,
        lastWarrantyExtension: null,
      };

      expect(user.lastWarrantyExtension).toBeNull();
    });

    it('TC-US-07: should accept DeviceUser with both dateOfPurchase and lastWarrantyExtension as null', () => {
      const user: DeviceUser = {
        ...baseUser,
        dateOfPurchase: null,
        lastWarrantyExtension: null,
      };

      expect(user.dateOfPurchase).toBeNull();
      expect(user.lastWarrantyExtension).toBeNull();
    });

    it('TC-US-08: additionType should be typed as UserAddType', () => {
      const userCommis: DeviceUser = {
        ...baseUser,
        additionType: UserAddType.COMMIS,
      };

      const userNoCommis: DeviceUser = {
        ...baseUser,
        additionType: UserAddType.NO_COMMIS,
      };

      expect(userCommis.additionType).toBe(UserAddType.COMMIS);
      expect(userNoCommis.additionType).toBe(UserAddType.NO_COMMIS);
    });

    // ─── Parameterizovani: additionType × voidWarranty × callAccepted ─────────
    const additionTypes = Object.values(UserAddType);
    const boolValues = [true, false];

    additionTypes.forEach((additionType) => {
      boolValues.forEach((voidWarranty) => {
        boolValues.forEach((callAccepted) => {
          it(`DeviceUser additionType=${additionType} voidWarranty=${voidWarranty} callAccepted=${callAccepted}`, () => {
            const user: DeviceUser = { ...baseUser, additionType, voidWarranty, callAccepted };
            expect(user.additionType).toBe(additionType);
            expect(user.voidWarranty).toBe(voidWarranty);
            expect(user.callAccepted).toBe(callAccepted);
          });
        });
      });
    });

    // ─── Parameterizovani: firstName variante ──────────────────────────────────
    const firstNameCases = [
      'Marko', 'Ana', 'Petar', 'Jovan', 'Milica',
      'Đorđe', 'Ljubiša', 'Dragoljub', 'Slobodan', 'Stevan',
    ];

    firstNameCases.forEach((firstName) => {
      it(`DeviceUser should accept firstName="${firstName}"`, () => {
        const user: DeviceUser = { ...baseUser, firstName };
        expect(user.firstName).toBe(firstName);
        expect(typeof user.firstName).toBe('string');
      });
    });

    // ─── Parameterizovani: lastName variante ──────────────────────────────────
    const lastNameCases = [
      'Markovic', 'Petrovic', 'Jovanovic', 'Nikolic', 'Stojanovic',
      'Pavlovic', 'Simic', 'Djordjevic', 'Bogdanovic', 'Ilic',
    ];

    lastNameCases.forEach((lastName) => {
      it(`DeviceUser should accept lastName="${lastName}"`, () => {
        const user: DeviceUser = { ...baseUser, lastName };
        expect(user.lastName).toBe(lastName);
        expect(typeof user.lastName).toBe('string');
      });
    });

    // ─── Parameterizovani: city variante ─────────────────────────────────────
    const cityCases = [
      'Beograd', 'Novi Sad', 'Nis', 'Kragujevac', 'Subotica',
      'Cacak', 'Uzice', 'Pancevo', 'Zrenjanin', 'Smederevo',
    ];

    cityCases.forEach((city) => {
      it(`DeviceUser should accept city="${city}"`, () => {
        const user: DeviceUser = { ...baseUser, city };
        expect(user.city).toBe(city);
      });
    });

    // ─── Parameterizovani: postalCode variante ────────────────────────────────
    const postalCodeCases = ['11000', '21000', '18000', '34000', '24000', '32000', '31000', '26000'];

    postalCodeCases.forEach((postalCode) => {
      it(`DeviceUser should accept postalCode="${postalCode}"`, () => {
        const user: DeviceUser = { ...baseUser, postalCode };
        expect(user.postalCode).toBe(postalCode);
        expect(typeof user.postalCode).toBe('string');
      });
    });

    // ─── Parameterizovani: phone variante ────────────────────────────────────
    const phoneCases = [
      '+381601234567',
      '+381641234567',
      '+381111234567',
      '0601234567',
      '+1-800-555-0199',
    ];

    phoneCases.forEach((phone) => {
      it(`DeviceUser should accept phone="${phone}"`, () => {
        const user: DeviceUser = { ...baseUser, phone };
        expect(user.phone).toBe(phone);
        expect(typeof user.phone).toBe('string');
      });
    });

    // ─── Parameterizovani: dateOfPurchase boundary dates ─────────────────────
    const dateOfPurchaseCases = [
      new Date('2000-01-01'),
      new Date('2010-06-15'),
      new Date('2020-12-31'),
      new Date('2023-06-15'),
      new Date('2025-01-01'),
    ];

    dateOfPurchaseCases.forEach((date) => {
      it(`DeviceUser should accept dateOfPurchase=${date.toISOString().slice(0, 10)}`, () => {
        const user: DeviceUser = { ...baseUser, dateOfPurchase: date };
        expect(user.dateOfPurchase).toEqual(date);
        expect(user.dateOfPurchase instanceof Date).toBe(true);
      });
    });

    // ─── Parameterizovani: lastWarrantyExtension boundary dates ──────────────
    const warrantyExtensionCases = [
      new Date('2021-01-01'),
      new Date('2022-06-15'),
      new Date('2023-12-31'),
      new Date('2024-06-15'),
      new Date('2025-01-01'),
      null,
    ];

    warrantyExtensionCases.forEach((lastWarrantyExtension) => {
      const label = lastWarrantyExtension
        ? lastWarrantyExtension.toISOString().slice(0, 10)
        : 'null';
      it(`DeviceUser should accept lastWarrantyExtension=${label}`, () => {
        const user: DeviceUser = { ...baseUser, lastWarrantyExtension };
        expect(user.lastWarrantyExtension).toEqual(lastWarrantyExtension);
      });
    });

    // ─── Parameterizovani: addedBy variante ──────────────────────────────────
    const addedByCases = [
      'user-test-uid-001',
      'firebase-uid-abc123',
      'admin-user-001',
      'service-account@project.iam.gserviceaccount.com',
    ];

    addedByCases.forEach((addedBy) => {
      it(`DeviceUser should accept addedBy="${addedBy.substring(0, 40)}"`, () => {
        const user: DeviceUser = { ...baseUser, addedBy };
        expect(user.addedBy).toBe(addedBy);
        expect(typeof user.addedBy).toBe('string');
      });
    });

    // ─── Parameterizovani: street variante ───────────────────────────────────
    const streetCases = [
      'Bulevar Kralja Aleksandra',
      'Knez Mihailova',
      'Terazije',
      'Makedonska',
      'Svetogorska',
    ];

    streetCases.forEach((street) => {
      it(`DeviceUser should accept street="${street}"`, () => {
        const user: DeviceUser = { ...baseUser, street };
        expect(user.street).toBe(street);
      });
    });

    // ─── Required fields presence ─────────────────────────────────────────────
    const requiredUserFields = [
      'firstName', 'lastName', 'street', 'homeNumber', 'city', 'postalCode',
      'phone', 'connectedDeviceSN', 'installerName', 'installerPhoneNumber',
      'dateOfPurchase', 'lastWarrantyExtension', 'voidWarranty', 'callAccepted',
      'addedBy', 'additionType',
    ];

    requiredUserFields.forEach((field) => {
      it(`DeviceUser should have field: ${field}`, () => {
        const user: DeviceUser = { ...baseUser };
        expect(field in user).toBe(true);
      });
    });

    // ─── DeviceUser field count ───────────────────────────────────────────────
    it('DeviceUser should have exactly 16 fields', () => {
      expect(Object.keys(baseUser).length).toBe(16);
    });

    // ─── Type checks for fields ───────────────────────────────────────────────
    it('DeviceUser firstName should be string', () => {
      expect(typeof baseUser.firstName).toBe('string');
    });

    it('DeviceUser lastName should be string', () => {
      expect(typeof baseUser.lastName).toBe('string');
    });

    it('DeviceUser voidWarranty should be boolean', () => {
      expect(typeof baseUser.voidWarranty).toBe('boolean');
    });

    it('DeviceUser callAccepted should be boolean', () => {
      expect(typeof baseUser.callAccepted).toBe('boolean');
    });

    it('DeviceUser additionType should be string', () => {
      expect(typeof baseUser.additionType).toBe('string');
    });

    // ─── Cross-product: additionType × DeviceType (simulacija korištenja) ─────
    const deviceTypes = Object.values(DeviceType);

    additionTypes.forEach((additionType) => {
      deviceTypes.forEach((deviceType) => {
        it(`DeviceUser additionType=${additionType} can be associated with deviceType=${deviceType}`, () => {
          const user: DeviceUser = { ...baseUser, additionType };
          // DeviceUser stores additionType - just verify type consistency
          expect(user.additionType).toBe(additionType);
          // deviceType is not stored in DeviceUser - just confirm it's a valid DeviceType
          expect(typeof deviceType).toBe('string');
        });
      });
    });

    // ─── connectedDeviceSN variante ───────────────────────────────────────────
    const connectedSNCases = [
      '',
      'SN1234567890',
      'SN1234567890123456789',
      'CONNECTED-DEVICE-001',
    ];

    connectedSNCases.forEach((connectedDeviceSN) => {
      it(`DeviceUser should accept connectedDeviceSN="${connectedDeviceSN.substring(0, 30)}"`, () => {
        const user: DeviceUser = { ...baseUser, connectedDeviceSN };
        expect(user.connectedDeviceSN).toBe(connectedDeviceSN);
      });
    });

    // ─── homeNumber variante ──────────────────────────────────────────────────
    const homeNumberCases = ['1', '5', '10', '73', '100', '100a', '12/3'];

    homeNumberCases.forEach((homeNumber) => {
      it(`DeviceUser should accept homeNumber="${homeNumber}"`, () => {
        const user: DeviceUser = { ...baseUser, homeNumber };
        expect(user.homeNumber).toBe(homeNumber);
        expect(typeof user.homeNumber).toBe('string');
      });
    });

    // ─── installerName variante ───────────────────────────────────────────────
    const installerNameCases = [
      'Nikola Nikolic',
      'Servis Tim Beograd',
      'Klimatehnika d.o.o.',
      'Petar Petrovic - Servis',
    ];

    installerNameCases.forEach((installerName) => {
      it(`DeviceUser should accept installerName="${installerName}"`, () => {
        const user: DeviceUser = { ...baseUser, installerName };
        expect(user.installerName).toBe(installerName);
      });
    });

    // ─── Edge cases / fuzz ────────────────────────────────────────────────────
    it('DeviceUser firstName can be empty string', () => {
      const user: DeviceUser = { ...baseUser, firstName: '' };
      expect(user.firstName).toBe('');
    });

    it('DeviceUser lastName can be empty string', () => {
      const user: DeviceUser = { ...baseUser, lastName: '' };
      expect(user.lastName).toBe('');
    });

    it('DeviceUser firstName can contain diacritics', () => {
      const user: DeviceUser = { ...baseUser, firstName: 'Đorđe' };
      expect(user.firstName).toContain('Đ');
    });

    it('DeviceUser lastName can contain diacritics', () => {
      const user: DeviceUser = { ...baseUser, lastName: 'Đorđević' };
      expect(user.lastName).toContain('Đ');
    });

    it('DeviceUser firstName can be 500 chars long', () => {
      const longName = 'A'.repeat(500);
      const user: DeviceUser = { ...baseUser, firstName: longName };
      expect(user.firstName.length).toBe(500);
    });

    it('DeviceUser should be JSON serializable (with null dates)', () => {
      const user: DeviceUser = { ...baseUser, dateOfPurchase: null, lastWarrantyExtension: null };
      const parsed = JSON.parse(JSON.stringify(user));
      expect(parsed.firstName).toBe('Marko');
      expect(parsed.dateOfPurchase).toBeNull();
      expect(parsed.lastWarrantyExtension).toBeNull();
    });

    it('DeviceUser spread should not mutate original', () => {
      const modified: DeviceUser = { ...baseUser, firstName: 'Ivan' };
      expect(baseUser.firstName).toBe('Marko');
      expect(modified.firstName).toBe('Ivan');
    });

    // ─── Null coalescing scenarios ────────────────────────────────────────────
    it('DeviceUser dateOfPurchase can be Date or null', () => {
      const withDate: DeviceUser = { ...baseUser, dateOfPurchase: new Date('2023-01-01') };
      const withNull: DeviceUser = { ...baseUser, dateOfPurchase: null };
      expect(withDate.dateOfPurchase instanceof Date).toBe(true);
      expect(withNull.dateOfPurchase).toBeNull();
    });

    it('DeviceUser lastWarrantyExtension can be Date or null', () => {
      const withDate: DeviceUser = { ...baseUser, lastWarrantyExtension: new Date('2024-01-01') };
      const withNull: DeviceUser = { ...baseUser, lastWarrantyExtension: null };
      expect(withDate.lastWarrantyExtension instanceof Date).toBe(true);
      expect(withNull.lastWarrantyExtension).toBeNull();
    });
  });
});
