import { GasBoilerSetup, HeatPumpSetup } from './setup.model';

describe('Setup Model', () => {
  describe('HeatPumpSetup interface', () => {
    it('TC-ST-01: should accept HeatPumpSetup with all 16 string fields', () => {
      const setup: HeatPumpSetup = {
        fuses: '16A',
        wiring: 'copper 2.5mm',
        fid: '30mA',
        modbusCable: 'CAT5e',
        coolingSystem: 'split',
        boiler: '200L',
        buffer: '100L',
        expansionTank: '12L',
        filter: 'installed',
        pressure: '1.5 bar',
        vacuum: '500 micron',
        pipeLength: '10m',
        additionalFreon: '200g',
        waterPressure: '1.8 bar',
        temperatures: 'S1:45 S2:35',
        compressorData: 'OK',
      };

      expect(setup.fuses).toBe('16A');
      expect(setup.wiring).toBe('copper 2.5mm');
      expect(setup.fid).toBe('30mA');
      expect(setup.modbusCable).toBe('CAT5e');
      expect(setup.coolingSystem).toBe('split');
      expect(setup.boiler).toBe('200L');
      expect(setup.buffer).toBe('100L');
      expect(setup.expansionTank).toBe('12L');
      expect(setup.filter).toBe('installed');
      expect(setup.pressure).toBe('1.5 bar');
      expect(setup.vacuum).toBe('500 micron');
      expect(setup.pipeLength).toBe('10m');
      expect(setup.additionalFreon).toBe('200g');
      expect(setup.waterPressure).toBe('1.8 bar');
      expect(setup.temperatures).toBe('S1:45 S2:35');
      expect(setup.compressorData).toBe('OK');
    });

    it('TC-ST-02: all HeatPumpSetup values should be strings', () => {
      const setup: HeatPumpSetup = {
        fuses: '16A',
        wiring: 'copper 2.5mm',
        fid: '30mA',
        modbusCable: 'CAT5e',
        coolingSystem: 'split',
        boiler: '200L',
        buffer: '100L',
        expansionTank: '12L',
        filter: 'installed',
        pressure: '1.5 bar',
        vacuum: '500 micron',
        pipeLength: '10m',
        additionalFreon: '200g',
        waterPressure: '1.8 bar',
        temperatures: 'S1:45 S2:35',
        compressorData: 'OK',
      };

      const values = Object.values(setup);
      expect(values.length).toBe(16);
      values.forEach((value) => {
        expect(typeof value).toBe('string');
      });
    });

    // ─── Parameterizovani testovi: svako polje HeatPumpSetup ──────────────────
    const heatPumpFields: Array<[keyof HeatPumpSetup, string]> = [
      ['fuses', '16A'],
      ['wiring', 'copper 2.5mm'],
      ['fid', '30mA'],
      ['modbusCable', 'CAT5e'],
      ['coolingSystem', 'split'],
      ['boiler', '200L'],
      ['buffer', '100L'],
      ['expansionTank', '12L'],
      ['filter', 'installed'],
      ['pressure', '1.5 bar'],
      ['vacuum', '500 micron'],
      ['pipeLength', '10m'],
      ['additionalFreon', '200g'],
      ['waterPressure', '1.8 bar'],
      ['temperatures', 'S1:45 S2:35'],
      ['compressorData', 'OK'],
    ];

    const baseHeatPumpSetup: HeatPumpSetup = {
      fuses: '16A',
      wiring: 'copper 2.5mm',
      fid: '30mA',
      modbusCable: 'CAT5e',
      coolingSystem: 'split',
      boiler: '200L',
      buffer: '100L',
      expansionTank: '12L',
      filter: 'installed',
      pressure: '1.5 bar',
      vacuum: '500 micron',
      pipeLength: '10m',
      additionalFreon: '200g',
      waterPressure: '1.8 bar',
      temperatures: 'S1:45 S2:35',
      compressorData: 'OK',
    };

    heatPumpFields.forEach(([field, value]) => {
      it(`HeatPumpSetup.${field} should equal "${value}"`, () => {
        expect(baseHeatPumpSetup[field]).toBe(value);
      });

      it(`HeatPumpSetup.${field} should be of type string`, () => {
        expect(typeof baseHeatPumpSetup[field]).toBe('string');
      });

      it(`HeatPumpSetup.${field} should be present in interface`, () => {
        expect(field in baseHeatPumpSetup).toBe(true);
      });

      it(`HeatPumpSetup.${field} can be set to empty string`, () => {
        const setup: HeatPumpSetup = { ...baseHeatPumpSetup, [field]: '' };
        expect(setup[field]).toBe('');
      });

      it(`HeatPumpSetup.${field} can be set to long string`, () => {
        const longVal = 'X'.repeat(200);
        const setup: HeatPumpSetup = { ...baseHeatPumpSetup, [field]: longVal };
        expect(setup[field].length).toBe(200);
      });
    });

    // ─── HeatPumpSetup field count ────────────────────────────────────────────
    it('HeatPumpSetup should have exactly 16 fields', () => {
      expect(Object.keys(baseHeatPumpSetup).length).toBe(16);
    });

    // ─── Fuses variants ───────────────────────────────────────────────────────
    const fusesVariants = ['10A', '13A', '16A', '20A', '25A', '32A', 'C16A', '16A - Type B'];

    fusesVariants.forEach((fuses) => {
      it(`HeatPumpSetup fuses="${fuses}" should be accepted`, () => {
        const setup: HeatPumpSetup = { ...baseHeatPumpSetup, fuses };
        expect(setup.fuses).toBe(fuses);
      });
    });

    // ─── FID variants ─────────────────────────────────────────────────────────
    const fidVariants = ['30mA Type A', '30mA Type B', '30mA Type F', 'no FID', '100mA'];

    fidVariants.forEach((fid) => {
      it(`HeatPumpSetup fid="${fid}" should be accepted`, () => {
        const setup: HeatPumpSetup = { ...baseHeatPumpSetup, fid };
        expect(setup.fid).toBe(fid);
      });
    });

    // ─── Pressure variants ────────────────────────────────────────────────────
    const pressureVariants = ['0 bar', '1.0 bar', '1.5 bar', '2.0 bar', '2.5 bar', '3.0 bar'];

    pressureVariants.forEach((pressure) => {
      it(`HeatPumpSetup pressure="${pressure}" should be accepted`, () => {
        const setup: HeatPumpSetup = { ...baseHeatPumpSetup, pressure };
        expect(setup.pressure).toBe(pressure);
      });
    });

    // ─── PipeLength variants ──────────────────────────────────────────────────
    const pipeLengthVariants = ['0m', '5m', '10m', '15m', '20m', '30m', '50m'];

    pipeLengthVariants.forEach((pipeLength) => {
      it(`HeatPumpSetup pipeLength="${pipeLength}" should be accepted`, () => {
        const setup: HeatPumpSetup = { ...baseHeatPumpSetup, pipeLength };
        expect(setup.pipeLength).toBe(pipeLength);
      });
    });

    // ─── JSON serialization ───────────────────────────────────────────────────
    it('HeatPumpSetup should be JSON serializable', () => {
      const parsed: HeatPumpSetup = JSON.parse(JSON.stringify(baseHeatPumpSetup));
      expect(parsed.fuses).toBe('16A');
      expect(parsed.pipeLength).toBe('10m');
      expect(Object.keys(parsed).length).toBe(16);
    });

    it('HeatPumpSetup spread should not mutate original', () => {
      const modified: HeatPumpSetup = { ...baseHeatPumpSetup, fuses: '32A' };
      expect(baseHeatPumpSetup.fuses).toBe('16A');
      expect(modified.fuses).toBe('32A');
    });

    // ─── Edge cases: special characters ──────────────────────────────────────
    it('HeatPumpSetup temperatures can contain colon-separated values', () => {
      const setup: HeatPumpSetup = { ...baseHeatPumpSetup, temperatures: 'S1:45°C S2:35°C' };
      expect(setup.temperatures).toContain(':');
    });

    it('HeatPumpSetup modbusCable can contain forward slash', () => {
      const setup: HeatPumpSetup = { ...baseHeatPumpSetup, modbusCable: '2x0.75/shielded' };
      expect(setup.modbusCable).toContain('/');
    });

    it('HeatPumpSetup wiring can contain multiplication sign', () => {
      const setup: HeatPumpSetup = { ...baseHeatPumpSetup, wiring: '3x2.5mm²' };
      expect(setup.wiring).toContain('x');
    });

    // ─── All fields empty string ──────────────────────────────────────────────
    it('HeatPumpSetup with all empty strings should be valid', () => {
      const setup: HeatPumpSetup = {
        fuses: '',
        wiring: '',
        fid: '',
        modbusCable: '',
        coolingSystem: '',
        boiler: '',
        buffer: '',
        expansionTank: '',
        filter: '',
        pressure: '',
        vacuum: '',
        pipeLength: '',
        additionalFreon: '',
        waterPressure: '',
        temperatures: '',
        compressorData: '',
      };
      Object.values(setup).forEach((val) => {
        expect(val).toBe('');
        expect(typeof val).toBe('string');
      });
    });
  });

  describe('GasBoilerSetup interface', () => {
    it('TC-ST-03: should accept GasBoilerSetup with 4 string + 2 boolean fields', () => {
      const setup: GasBoilerSetup = {
        gasType: 'natural',
        voltage: '230V',
        pressureSettings: '20 mbar',
        systemPressure: '1.5 bar',
        leakTested: true,
        installationVerified: true,
      };

      expect(setup.gasType).toBe('natural');
      expect(setup.voltage).toBe('230V');
      expect(setup.pressureSettings).toBe('20 mbar');
      expect(setup.systemPressure).toBe('1.5 bar');
      expect(setup.leakTested).toBe(true);
      expect(setup.installationVerified).toBe(true);
    });

    it('TC-ST-04: GasBoilerSetup leakTested and installationVerified should be boolean', () => {
      const setup: GasBoilerSetup = {
        gasType: 'propane',
        voltage: '230V',
        pressureSettings: '30 mbar',
        systemPressure: '1.2 bar',
        leakTested: false,
        installationVerified: false,
      };

      expect(typeof setup.leakTested).toBe('boolean');
      expect(typeof setup.installationVerified).toBe('boolean');
      expect(setup.leakTested).toBe(false);
      expect(setup.installationVerified).toBe(false);
    });

    // ─── Parameterizovani testovi: svako polje GasBoilerSetup ─────────────────
    const gasBoilerStringFields: Array<[keyof GasBoilerSetup, string]> = [
      ['gasType', 'natural'],
      ['voltage', '230V'],
      ['pressureSettings', '20 mbar'],
      ['systemPressure', '1.5 bar'],
    ];

    const baseGasBoilerSetup: GasBoilerSetup = {
      gasType: 'natural',
      voltage: '230V',
      pressureSettings: '20 mbar',
      systemPressure: '1.5 bar',
      leakTested: true,
      installationVerified: true,
    };

    gasBoilerStringFields.forEach(([field, value]) => {
      it(`GasBoilerSetup.${String(field)} should equal "${value}"`, () => {
        expect(baseGasBoilerSetup[field]).toBe(value);
      });

      it(`GasBoilerSetup.${String(field)} should be of type string`, () => {
        expect(typeof baseGasBoilerSetup[field]).toBe('string');
      });

      it(`GasBoilerSetup.${String(field)} should be present in interface`, () => {
        expect(String(field) in baseGasBoilerSetup).toBe(true);
      });

      it(`GasBoilerSetup.${String(field)} can be set to empty string`, () => {
        const setup: GasBoilerSetup = { ...baseGasBoilerSetup, [field]: '' };
        expect(setup[field]).toBe('');
      });

      it(`GasBoilerSetup.${String(field)} can be set to long string`, () => {
        const longVal = 'Y'.repeat(100);
        const setup: GasBoilerSetup = { ...baseGasBoilerSetup, [field]: longVal };
        expect((setup[field] as string).length).toBe(100);
      });
    });

    // ─── GasBoilerSetup field count ────────────────────────────────────────────
    it('GasBoilerSetup should have exactly 6 fields', () => {
      expect(Object.keys(baseGasBoilerSetup).length).toBe(6);
    });

    // ─── gasType variants ─────────────────────────────────────────────────────
    const gasTypeVariants = ['natural', 'propane', 'lpg', 'methane', 'biogas'];

    gasTypeVariants.forEach((gasType) => {
      it(`GasBoilerSetup gasType="${gasType}" should be accepted`, () => {
        const setup: GasBoilerSetup = { ...baseGasBoilerSetup, gasType };
        expect(setup.gasType).toBe(gasType);
      });
    });

    // ─── voltage variants ─────────────────────────────────────────────────────
    const voltageVariants = ['230V', '220V', '240V', '110V', '3x400V'];

    voltageVariants.forEach((voltage) => {
      it(`GasBoilerSetup voltage="${voltage}" should be accepted`, () => {
        const setup: GasBoilerSetup = { ...baseGasBoilerSetup, voltage };
        expect(setup.voltage).toBe(voltage);
      });
    });

    // ─── pressureSettings variants ────────────────────────────────────────────
    const pressureSettingVariants = ['15 mbar', '20 mbar', '25 mbar', '30 mbar', '37 mbar'];

    pressureSettingVariants.forEach((pressureSettings) => {
      it(`GasBoilerSetup pressureSettings="${pressureSettings}" should be accepted`, () => {
        const setup: GasBoilerSetup = { ...baseGasBoilerSetup, pressureSettings };
        expect(setup.pressureSettings).toBe(pressureSettings);
      });
    });

    // ─── systemPressure variants ──────────────────────────────────────────────
    const systemPressureVariants = ['0.5 bar', '1.0 bar', '1.2 bar', '1.5 bar', '2.0 bar', '2.5 bar'];

    systemPressureVariants.forEach((systemPressure) => {
      it(`GasBoilerSetup systemPressure="${systemPressure}" should be accepted`, () => {
        const setup: GasBoilerSetup = { ...baseGasBoilerSetup, systemPressure };
        expect(setup.systemPressure).toBe(systemPressure);
      });
    });

    // ─── leakTested x installationVerified cross-product ─────────────────────
    const boolCombinations: Array<[boolean, boolean]> = [
      [true, true],
      [true, false],
      [false, true],
      [false, false],
    ];

    boolCombinations.forEach(([leakTested, installationVerified]) => {
      it(`GasBoilerSetup leakTested=${leakTested} installationVerified=${installationVerified} should be valid`, () => {
        const setup: GasBoilerSetup = { ...baseGasBoilerSetup, leakTested, installationVerified };
        expect(setup.leakTested).toBe(leakTested);
        expect(setup.installationVerified).toBe(installationVerified);
        expect(typeof setup.leakTested).toBe('boolean');
        expect(typeof setup.installationVerified).toBe('boolean');
      });
    });

    // ─── JSON serialization ───────────────────────────────────────────────────
    it('GasBoilerSetup should be JSON serializable', () => {
      const parsed: GasBoilerSetup = JSON.parse(JSON.stringify(baseGasBoilerSetup));
      expect(parsed.gasType).toBe('natural');
      expect(parsed.leakTested).toBe(true);
      expect(Object.keys(parsed).length).toBe(6);
    });

    it('GasBoilerSetup spread should not mutate original', () => {
      const modified: GasBoilerSetup = { ...baseGasBoilerSetup, gasType: 'propane' };
      expect(baseGasBoilerSetup.gasType).toBe('natural');
      expect(modified.gasType).toBe('propane');
    });

    // ─── Required fields presence ─────────────────────────────────────────────
    const requiredGasBoilerFields = ['gasType', 'voltage', 'pressureSettings', 'systemPressure', 'leakTested', 'installationVerified'];

    requiredGasBoilerFields.forEach((field) => {
      it(`GasBoilerSetup should have required field: ${field}`, () => {
        expect(field in baseGasBoilerSetup).toBe(true);
      });
    });

    // ─── leakTested boolean type checks ──────────────────────────────────────
    it('GasBoilerSetup leakTested=true should be truthy', () => {
      const setup: GasBoilerSetup = { ...baseGasBoilerSetup, leakTested: true };
      expect(setup.leakTested).toBeTruthy();
    });

    it('GasBoilerSetup leakTested=false should be falsy', () => {
      const setup: GasBoilerSetup = { ...baseGasBoilerSetup, leakTested: false };
      expect(setup.leakTested).toBeFalsy();
    });

    it('GasBoilerSetup installationVerified=true should be truthy', () => {
      const setup: GasBoilerSetup = { ...baseGasBoilerSetup, installationVerified: true };
      expect(setup.installationVerified).toBeTruthy();
    });

    it('GasBoilerSetup installationVerified=false should be falsy', () => {
      const setup: GasBoilerSetup = { ...baseGasBoilerSetup, installationVerified: false };
      expect(setup.installationVerified).toBeFalsy();
    });

    // ─── Array usage ──────────────────────────────────────────────────────────
    it('array of GasBoilerSetups should work correctly', () => {
      const setups: GasBoilerSetup[] = boolCombinations.map(([leakTested, installationVerified]) => ({
        gasType: 'natural',
        voltage: '230V',
        pressureSettings: '20 mbar',
        systemPressure: '1.5 bar',
        leakTested,
        installationVerified,
      }));
      expect(setups.length).toBe(4);
      setups.forEach((s) => {
        expect(typeof s.leakTested).toBe('boolean');
        expect(typeof s.installationVerified).toBe('boolean');
      });
    });
  });
});
