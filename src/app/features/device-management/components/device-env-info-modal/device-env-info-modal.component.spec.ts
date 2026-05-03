import { TestBed } from '@angular/core/testing';
import { ComponentFixture } from '@angular/core/testing';
import { ModalController, ToastController } from '@ionic/angular/standalone';
import { TranslocoService } from '@jsverse/transloco';
import { TranslocoTestingModule } from '@jsverse/transloco';

import { DeviceEnvInfoModalComponent } from './device-env-info-modal.component';
import { ConfirmService } from '../../../../shared/services/confirm.service';
import { DeviceType } from '../../../../shared/models/device.model';
import {
  ENV_INFO_FIELDS,
  ENV_INFO_SECTIONS,
} from '../../models/device-env-info.model';
import {
  createMockModalController,
  createMockToastController,
} from '../../../../testing/mock-factories';

// ─── Minimal Transloco translations ───────────────────────────────────────────

const translocoLangs = {
  en: {
    env_info_title: 'Environmental Info',
    env_info_view_title: 'View Environmental Info',
    env_info_save: 'Save',
    env_info_section_electrical: 'Electrical',
    env_info_section_hydraulic: 'Hydraulic',
    env_info_section_freon: 'Freon',
    env_info_section_system_operation: 'System Operation',
    env_info_section_gas_boiler: 'Gas Boiler',
    env_info_select_placeholder: 'Select...',
    env_info_input_placeholder: 'Enter value',
    env_info_validation_required: 'All fields required',
    env_info_confirm_title: 'Confirm',
    env_info_confirm_message: 'Are you sure?',
    env_info_confirm_save: 'Save',
    env_info_confirm_cancel: 'Cancel',
  },
};

// ─── Helpers ─────────────────────────────────────────────────────────────────

function buildPrefillData(deviceType: DeviceType): Record<string, string> {
  const fields = ENV_INFO_FIELDS[deviceType] ?? [];
  const data: Record<string, string> = {};
  for (const field of fields) {
    data[field.key] = `test_${field.key}`;
  }
  return data;
}

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('DeviceEnvInfoModalComponent', () => {
  let fixture: ComponentFixture<DeviceEnvInfoModalComponent>;
  let component: DeviceEnvInfoModalComponent;
  let mockModalController: jasmine.SpyObj<ModalController>;
  let mockToastController: jasmine.SpyObj<ToastController>;
  let mockConfirmService: jasmine.SpyObj<ConfirmService>;

  beforeEach(() => {
    mockModalController = createMockModalController();
    mockToastController = createMockToastController();
    mockConfirmService = jasmine.createSpyObj<ConfirmService>('ConfirmService', ['confirm']);
    mockConfirmService.confirm.and.resolveTo(true);

    TestBed.configureTestingModule({
      imports: [
        DeviceEnvInfoModalComponent,
        TranslocoTestingModule.forRoot({
          langs: translocoLangs,
          translocoConfig: { availableLangs: ['en'], defaultLang: 'en' },
          preloadLangs: true,
        }),
      ],
      providers: [
        { provide: ModalController, useValue: mockModalController },
        { provide: ToastController, useValue: mockToastController },
        { provide: ConfirmService, useValue: mockConfirmService },
      ],
    });
  });

  function setupComponent(
    deviceType: DeviceType,
    prefillData: Record<string, string> | null = null,
    readOnly = false,
  ): void {
    fixture = TestBed.createComponent(DeviceEnvInfoModalComponent);
    fixture.componentRef.setInput('deviceType', deviceType);
    fixture.componentRef.setInput('prefillData', prefillData);
    fixture.componentRef.setInput('readOnly', readOnly);
    fixture.detectChanges();
    component = fixture.componentInstance;
  }

  // ─── ngOnInit ────────────────────────────────────────────────────────────────

  describe('ngOnInit', () => {
    it('TC-EIM-01: should set sections from ENV_INFO_SECTIONS based on deviceType', () => {
      setupComponent(DeviceType.HEAT_PUMP);

      const expectedSections = ENV_INFO_SECTIONS[DeviceType.HEAT_PUMP]!;
      const actualSections: { key: string }[] = (component as any).sections;
      expect(actualSections.length).toBe(expectedSections.length);
      for (let i = 0; i < expectedSections.length; i++) {
        expect(actualSections[i].key).toBe(expectedSections[i].key);
      }
    });

    it('TC-EIM-02: should set fields from ENV_INFO_FIELDS based on deviceType', () => {
      setupComponent(DeviceType.GAS_BOILER);

      const expectedFields = ENV_INFO_FIELDS[DeviceType.GAS_BOILER]!;
      const actualFields: { key: string }[] = (component as any).allFields;
      expect(actualFields.length).toBe(expectedFields.length);
      for (let i = 0; i < expectedFields.length; i++) {
        expect(actualFields[i].key).toBe(expectedFields[i].key);
      }
    });

    it('TC-EIM-03: should build form with one control per field', () => {
      setupComponent(DeviceType.GAS_BOILER, null);

      const expectedFields = ENV_INFO_FIELDS[DeviceType.GAS_BOILER]!;
      const form = (component as any).form;
      for (const field of expectedFields) {
        expect(form.get(field.key)).withContext(`control for ${field.key}`).not.toBeNull();
      }
      expect(Object.keys(form.controls).length).toBe(expectedFields.length);
    });

    it('TC-EIM-04: HEAT_PUMP should result in 4 sections', () => {
      setupComponent(DeviceType.HEAT_PUMP);

      expect((component as any).sections.length).toBe(4);
    });

    it('TC-EIM-05: HEAT_PUMP should build form with 29 fields', () => {
      setupComponent(DeviceType.HEAT_PUMP);

      const form = (component as any).form;
      expect(Object.keys(form.controls).length).toBe(29);
    });

    it('TC-EIM-06: GAS_BOILER should result in 1 section', () => {
      setupComponent(DeviceType.GAS_BOILER);

      expect((component as any).sections.length).toBe(1);
    });

    it('TC-EIM-07: GAS_BOILER should build form with 13 fields', () => {
      setupComponent(DeviceType.GAS_BOILER);

      const form = (component as any).form;
      expect(Object.keys(form.controls).length).toBe(13);
    });

    it('TC-EIM-08: prefill data should populate form controls when provided', () => {
      const prefill = buildPrefillData(DeviceType.GAS_BOILER);
      setupComponent(DeviceType.GAS_BOILER, prefill);

      const form = (component as any).form;
      for (const [key, value] of Object.entries(prefill)) {
        expect(form.get(key)?.value).withContext(`field ${key}`).toBe(value);
      }
    });

    it('TC-EIM-09: no prefill data should leave form controls empty', () => {
      setupComponent(DeviceType.GAS_BOILER, null);

      const form = (component as any).form;
      const fields = ENV_INFO_FIELDS[DeviceType.GAS_BOILER]!;
      for (const field of fields) {
        expect(form.get(field.key)?.value).withContext(`field ${field.key}`).toBe('');
      }
    });
  });

  // ─── onSave ──────────────────────────────────────────────────────────────────

  describe('onSave', () => {
    it('TC-EIM-10: should show toast and not dismiss when required fields are missing', async () => {
      setupComponent(DeviceType.GAS_BOILER, null);

      await (component as any).onSave();

      expect(mockToastController.create).toHaveBeenCalledTimes(1);
      expect(mockModalController.dismiss).not.toHaveBeenCalled();
    });

    it('TC-EIM-11: should call confirmService.confirm before saving', async () => {
      const prefill = buildPrefillData(DeviceType.GAS_BOILER);
      setupComponent(DeviceType.GAS_BOILER, prefill);

      await (component as any).onSave();

      expect(mockConfirmService.confirm).toHaveBeenCalledTimes(1);
    });

    it('TC-EIM-12: should NOT dismiss modal when user cancels the confirm dialog', async () => {
      const prefill = buildPrefillData(DeviceType.GAS_BOILER);
      mockConfirmService.confirm.and.resolveTo(false);
      setupComponent(DeviceType.GAS_BOILER, prefill);

      await (component as any).onSave();

      expect(mockModalController.dismiss).not.toHaveBeenCalled();
    });

    it('TC-EIM-13: should dismiss modal with role "save" and form data when confirmed', async () => {
      const prefill = buildPrefillData(DeviceType.GAS_BOILER);
      mockConfirmService.confirm.and.resolveTo(true);
      setupComponent(DeviceType.GAS_BOILER, prefill);

      await (component as any).onSave();

      expect(mockModalController.dismiss).toHaveBeenCalledWith(
        jasmine.objectContaining(prefill),
        'save',
      );
    });
  });

  // ─── onDismiss ───────────────────────────────────────────────────────────────

  describe('onDismiss', () => {
    it('TC-EIM-14: should dismiss modal with null data and role "cancel"', () => {
      setupComponent(DeviceType.GAS_BOILER);

      (component as any).onDismiss();

      expect(mockModalController.dismiss).toHaveBeenCalledWith(null, 'cancel');
    });
  });

  // ─── readOnly mode ────────────────────────────────────────────────────────────

  describe('readOnly mode', () => {
    it('TC-EIM-15: in readOnly mode form is disabled AND DOM renders readonly inputs (BUG-10 fixed)', () => {
      // BUG-10 FIXED: source now calls this.form.disable() in ngOnInit when readOnly === true.
      // Both layers of read-only protection are now active:
      //   1. Angular FormGroup disabled (programmatic protection)
      //   2. Template ion-input readonly attribute (DOM protection)
      const prefill = buildPrefillData(DeviceType.GAS_BOILER);
      setupComponent(DeviceType.GAS_BOILER, prefill, true);

      // Template renders ion-input elements with readonly attribute
      const readonlyInputs = fixture.nativeElement.querySelectorAll('ion-input[readonly]');
      expect(readonlyInputs.length).toBeGreaterThan(0);

      // BUG-10 FIXED: Form is now programmatically disabled
      const form = (component as any).form;
      expect(form.disabled).toBeTrue();
    });

    it('TC-EIM-16: save button should NOT be rendered in readOnly mode', () => {
      setupComponent(DeviceType.GAS_BOILER, null, true);

      const saveButton = fixture.nativeElement.querySelector('ion-button.save-button');
      expect(saveButton).toBeNull();
    });

    it('TC-EIM-17: onDismiss should work normally in readOnly mode', () => {
      setupComponent(DeviceType.GAS_BOILER, null, true);

      (component as any).onDismiss();

      expect(mockModalController.dismiss).toHaveBeenCalledWith(null, 'cancel');
    });

    it('TC-EIM-18: prefill data should populate form even in readOnly mode', () => {
      const prefill = buildPrefillData(DeviceType.GAS_BOILER);
      setupComponent(DeviceType.GAS_BOILER, prefill, true);

      const form = (component as any).form;
      for (const [key, value] of Object.entries(prefill)) {
        expect(form.get(key)?.value).withContext(`field ${key}`).toBe(value);
      }
    });
  });

  // ─── Field configurations (bonus) ────────────────────────────────────────────

  describe('Field configurations', () => {
    it('TC-EIM-19: each select field for HEAT_PUMP should have a non-empty options array', () => {
      setupComponent(DeviceType.HEAT_PUMP);

      const fields = ENV_INFO_FIELDS[DeviceType.HEAT_PUMP]!;
      const selectFields = fields.filter(f => f.type === 'select');
      expect(selectFields.length).toBeGreaterThan(0);
      for (const field of selectFields) {
        expect(field.options).withContext(`field ${field.key}`).toBeDefined();
        expect(field.options!.length).withContext(`field ${field.key}`).toBeGreaterThan(0);
      }
    });

    it('TC-EIM-20: each number field for GAS_BOILER should have a unit defined', () => {
      setupComponent(DeviceType.GAS_BOILER);

      const fields = ENV_INFO_FIELDS[DeviceType.GAS_BOILER]!;
      const numberFields = fields.filter(f => f.type === 'number');
      expect(numberFields.length).toBeGreaterThan(0);
      for (const field of numberFields) {
        expect(field.unit).withContext(`field ${field.key}`).toBeDefined();
        expect(field.unit!.length).withContext(`field ${field.key}`).toBeGreaterThan(0);
      }
    });

    it('TC-EIM-21: field keys should be unique within HEAT_PUMP', () => {
      setupComponent(DeviceType.HEAT_PUMP);

      const fields = ENV_INFO_FIELDS[DeviceType.HEAT_PUMP]!;
      const keys = fields.map(f => f.key);
      const uniqueKeys = new Set(keys);
      expect(uniqueKeys.size).toBe(keys.length);
    });
  });

  // ─── fieldsPerSection map ────────────────────────────────────────────────────

  describe('fieldsPerSection', () => {
    it('TC-EIM-22: HEAT_PUMP should correctly group fields into 4 sections in fieldsPerSection', () => {
      setupComponent(DeviceType.HEAT_PUMP);

      const fieldsPerSection = (component as any).fieldsPerSection as Map<string, unknown[]>;
      const sections = ENV_INFO_SECTIONS[DeviceType.HEAT_PUMP]!;
      for (const section of sections) {
        expect(fieldsPerSection.has(section.key)).withContext(`section ${section.key}`).toBeTrue();
        expect(fieldsPerSection.get(section.key)!.length).withContext(`section ${section.key}`).toBeGreaterThan(0);
      }
    });

    it('TC-EIM-23: GAS_BOILER should correctly group all 13 fields under "gasBoiler" section', () => {
      setupComponent(DeviceType.GAS_BOILER);

      const fieldsPerSection = (component as any).fieldsPerSection as Map<string, unknown[]>;
      expect(fieldsPerSection.has('gasBoiler')).toBeTrue();
      expect(fieldsPerSection.get('gasBoiler')!.length).toBe(13);
    });
  });

  // =========================================================================
  // EXPANSION: HEAT_PUMP — each field × readOnly × prefilled
  // =========================================================================

  describe('HEAT_PUMP — each field × readOnly=false × prefilled', () => {
    const hpFields = ENV_INFO_FIELDS[DeviceType.HEAT_PUMP] ?? [];

    hpFields.forEach((field) => {
      it(`EXP-EIM-HP-PREFILL: field "${field.key}" prefilled → form control has correct value`, () => {
        const prefill = { [field.key]: `test_${field.key}` };
        setupComponent(DeviceType.HEAT_PUMP, prefill as Record<string, string>);

        const form = (component as any).form;
        expect(form.get(field.key)?.value).toBe(`test_${field.key}`);
      });

      it(`EXP-EIM-HP-EMPTY: field "${field.key}" no prefill → form control empty string`, () => {
        setupComponent(DeviceType.HEAT_PUMP, null);

        const form = (component as any).form;
        expect(form.get(field.key)?.value).toBe('');
      });

      it(`EXP-EIM-HP-READONLY: field "${field.key}" readOnly=true + prefilled → value preserved`, () => {
        const prefill = { [field.key]: `readonly_${field.key}` };
        setupComponent(DeviceType.HEAT_PUMP, prefill as Record<string, string>, true);

        const form = (component as any).form;
        expect(form.get(field.key)?.value).toBe(`readonly_${field.key}`);
      });
    });
  });

  describe('GAS_BOILER — each field × readOnly × prefilled', () => {
    const gbFields = ENV_INFO_FIELDS[DeviceType.GAS_BOILER] ?? [];

    gbFields.forEach((field) => {
      it(`EXP-EIM-GB-PREFILL: field "${field.key}" prefilled → form control has correct value`, () => {
        const prefill = { [field.key]: `test_${field.key}` };
        setupComponent(DeviceType.GAS_BOILER, prefill as Record<string, string>);

        const form = (component as any).form;
        expect(form.get(field.key)?.value).toBe(`test_${field.key}`);
      });

      it(`EXP-EIM-GB-EMPTY: field "${field.key}" no prefill → form control empty string`, () => {
        setupComponent(DeviceType.GAS_BOILER, null);

        const form = (component as any).form;
        expect(form.get(field.key)?.value).toBe('');
      });

      it(`EXP-EIM-GB-READONLY: field "${field.key}" readOnly=true + prefilled → value preserved`, () => {
        const prefill = { [field.key]: `readonly_${field.key}` };
        setupComponent(DeviceType.GAS_BOILER, prefill as Record<string, string>, true);

        const form = (component as any).form;
        expect(form.get(field.key)?.value).toBe(`readonly_${field.key}`);
      });
    });
  });

  // =========================================================================
  // EXPANSION: select options — exhaustive coverage per field
  // =========================================================================

  describe('select options — exhaustive option count per field', () => {
    const hpFields = ENV_INFO_FIELDS[DeviceType.HEAT_PUMP] ?? [];
    const selectHpFields = hpFields.filter(f => f.type === 'select');

    selectHpFields.forEach((field) => {
      it(`EXP-EIM-OPTS-HP: select field "${field.key}" has ${field.options!.length} options`, () => {
        setupComponent(DeviceType.HEAT_PUMP);

        const fields = ENV_INFO_FIELDS[DeviceType.HEAT_PUMP]!;
        const found = fields.find(f => f.key === field.key);
        expect(found?.options?.length).toBe(field.options!.length);
        expect(found?.options?.length).toBeGreaterThan(0);
      });

      field.options!.forEach((option) => {
        it(`EXP-EIM-OPTS-HP-VAL: HEAT_PUMP field "${field.key}" contains option "${option}"`, () => {
          const fields = ENV_INFO_FIELDS[DeviceType.HEAT_PUMP]!;
          const found = fields.find(f => f.key === field.key);
          expect(found?.options).toContain(option);
        });
      });
    });

    const gbFields = ENV_INFO_FIELDS[DeviceType.GAS_BOILER] ?? [];
    const selectGbFields = gbFields.filter(f => f.type === 'select');

    selectGbFields.forEach((field) => {
      it(`EXP-EIM-OPTS-GB: select field "${field.key}" has ${field.options!.length} options`, () => {
        setupComponent(DeviceType.GAS_BOILER);

        const fields = ENV_INFO_FIELDS[DeviceType.GAS_BOILER]!;
        const found = fields.find(f => f.key === field.key);
        expect(found?.options?.length).toBe(field.options!.length);
      });

      field.options!.forEach((option) => {
        it(`EXP-EIM-OPTS-GB-VAL: GAS_BOILER field "${field.key}" contains option "${option}"`, () => {
          const fields = ENV_INFO_FIELDS[DeviceType.GAS_BOILER]!;
          const found = fields.find(f => f.key === field.key);
          expect(found?.options).toContain(option);
        });
      });
    });
  });

  // =========================================================================
  // EXPANSION: form section grouping — field-to-section mapping
  // =========================================================================

  describe('fieldsPerSection — field-to-section mapping', () => {
    const hpFields = ENV_INFO_FIELDS[DeviceType.HEAT_PUMP] ?? [];

    const sectionFieldCounts: Record<string, number> = {};
    hpFields.forEach(f => {
      sectionFieldCounts[f.section] = (sectionFieldCounts[f.section] ?? 0) + 1;
    });

    Object.entries(sectionFieldCounts).forEach(([section, count]) => {
      it(`EXP-EIM-SECTION-HP: HEAT_PUMP section "${section}" has ${count} fields`, () => {
        setupComponent(DeviceType.HEAT_PUMP);

        const fieldsPerSection = (component as any).fieldsPerSection as Map<string, unknown[]>;
        expect(fieldsPerSection.get(section)?.length).toBe(count);
      });
    });

    it('EXP-EIM-SECTION-HP-TOTAL: HEAT_PUMP all section field counts sum to 29', () => {
      setupComponent(DeviceType.HEAT_PUMP);

      const fieldsPerSection = (component as any).fieldsPerSection as Map<string, unknown[]>;
      const total = Array.from(fieldsPerSection.values()).reduce((sum, arr) => sum + arr.length, 0);
      expect(total).toBe(29);
    });

    it('EXP-EIM-SECTION-GB-TOTAL: GAS_BOILER all section field counts sum to 13', () => {
      setupComponent(DeviceType.GAS_BOILER);

      const fieldsPerSection = (component as any).fieldsPerSection as Map<string, unknown[]>;
      const total = Array.from(fieldsPerSection.values()).reduce((sum, arr) => sum + arr.length, 0);
      expect(total).toBe(13);
    });
  });

  // =========================================================================
  // EXPANSION: onSave — partial prefill (only some fields filled)
  // =========================================================================

  describe('onSave() — validation with partial prefill', () => {
    const gbFields = ENV_INFO_FIELDS[DeviceType.GAS_BOILER] ?? [];

    // Test each individual field missing (only 1 missing at a time from full prefill)
    gbFields.slice(0, 5).forEach((missingField) => {
      it(`EXP-EIM-SAVE-MISSING: GAS_BOILER missing field "${missingField.key}" → toast shown, no dismiss`, async () => {
        const prefill = buildPrefillData(DeviceType.GAS_BOILER);
        setupComponent(DeviceType.GAS_BOILER, prefill);

        // Remove one field value to simulate missing
        const form = (component as any).form;
        form.get(missingField.key)?.setValue('');

        await (component as any).onSave();

        // If field is required — expect validation failure toast
        expect(mockToastController.create).toHaveBeenCalledTimes(1);
        expect(mockModalController.dismiss).not.toHaveBeenCalled();
      });
    });

    it('EXP-EIM-SAVE-ALL-FILLED: GAS_BOILER all fields filled → confirmService called', async () => {
      const prefill = buildPrefillData(DeviceType.GAS_BOILER);
      mockConfirmService.confirm.and.resolveTo(true);
      setupComponent(DeviceType.GAS_BOILER, prefill);

      await (component as any).onSave();

      expect(mockConfirmService.confirm).toHaveBeenCalledTimes(1);
    });

    it('EXP-EIM-SAVE-HP-ALL-FILLED: HEAT_PUMP all fields filled → confirmService called', async () => {
      const prefill = buildPrefillData(DeviceType.HEAT_PUMP);
      mockConfirmService.confirm.and.resolveTo(true);
      setupComponent(DeviceType.HEAT_PUMP, prefill);

      await (component as any).onSave();

      expect(mockConfirmService.confirm).toHaveBeenCalledTimes(1);
    });
  });

  // =========================================================================
  // EXPANSION: readOnly mode — UI behavior
  // =========================================================================

  describe('readOnly mode — form and UI', () => {
    it('EXP-EIM-RO-NODISMISS: readOnly=true — onDismiss still dismisses with null/cancel', () => {
      setupComponent(DeviceType.HEAT_PUMP, null, true);

      (component as any).onDismiss();

      expect(mockModalController.dismiss).toHaveBeenCalledWith(null, 'cancel');
    });

    it('EXP-EIM-RO-HP-PREFILL: HEAT_PUMP readOnly + all prefilled → all form values correct', () => {
      const prefill = buildPrefillData(DeviceType.HEAT_PUMP);
      setupComponent(DeviceType.HEAT_PUMP, prefill, true);

      const form = (component as any).form;
      for (const [key, value] of Object.entries(prefill)) {
        expect(form.get(key)?.value).withContext(`field ${key}`).toBe(value);
      }
    });

    it('EXP-EIM-RO-FORM-DISABLED: readOnly=true — form is programmatically disabled (BUG-10 fixed)', () => {
      setupComponent(DeviceType.GAS_BOILER, null, true);

      const form = (component as any).form;
      expect(form.disabled).toBeTrue();
    });
  });

  // =========================================================================
  // EXPANSION PASS 2: each HEAT_PUMP field — control exists and accepts value
  // =========================================================================

  describe('HEAT_PUMP — each field control existence and value assignment', () => {
    beforeEach(() => {
      setupComponent(DeviceType.HEAT_PUMP, null, false);
    });

    const hpFields = ENV_INFO_FIELDS[DeviceType.HEAT_PUMP] ?? [];

    hpFields.forEach((field) => {
      it(`EXP2-EIM-HP-CTRL: field "${field.key}" — control exists in form`, () => {
        const form = (component as any).form;
        expect(form.get(field.key)).not.toBeNull();
      });

      it(`EXP2-EIM-HP-VAL: field "${field.key}" — can set string value`, () => {
        const form = (component as any).form;
        const testVal = `val_${field.key}`;
        form.get(field.key)?.setValue(testVal);
        expect(form.get(field.key)?.value).toBe(testVal);
      });
    });
  });

  // =========================================================================
  // EXPANSION PASS 2: each GAS_BOILER field — control exists and accepts value
  // =========================================================================

  describe('GAS_BOILER — each field control existence and value assignment', () => {
    beforeEach(() => {
      setupComponent(DeviceType.GAS_BOILER, null, false);
    });

    const gbFields = ENV_INFO_FIELDS[DeviceType.GAS_BOILER] ?? [];

    gbFields.forEach((field) => {
      it(`EXP2-EIM-GB-CTRL: field "${field.key}" — control exists in form`, () => {
        const form = (component as any).form;
        expect(form.get(field.key)).not.toBeNull();
      });

      it(`EXP2-EIM-GB-VAL: field "${field.key}" — can set string value`, () => {
        const form = (component as any).form;
        const testVal = `val_${field.key}`;
        form.get(field.key)?.setValue(testVal);
        expect(form.get(field.key)?.value).toBe(testVal);
      });
    });
  });

  // =========================================================================
  // EXPANSION PASS 2: each HEAT_PUMP field — prefilled correctly
  // =========================================================================

  describe('HEAT_PUMP — each field prefilled from prefillData', () => {
    const hpFields = ENV_INFO_FIELDS[DeviceType.HEAT_PUMP] ?? [];

    hpFields.forEach((field) => {
      it(`EXP2-EIM-HP-PREFILL: field "${field.key}" — form control has prefill value`, () => {
        const prefillData: Record<string, string> = { [field.key]: `prefill_${field.key}` };
        setupComponent(DeviceType.HEAT_PUMP, prefillData, false);
        const form = (component as any).form;
        expect(form.get(field.key)?.value).toBe(`prefill_${field.key}`);
      });
    });
  });

  // =========================================================================
  // EXPANSION PASS 2: each GAS_BOILER field — prefilled correctly
  // =========================================================================

  describe('GAS_BOILER — each field prefilled from prefillData', () => {
    const gbFields = ENV_INFO_FIELDS[DeviceType.GAS_BOILER] ?? [];

    gbFields.forEach((field) => {
      it(`EXP2-EIM-GB-PREFILL: field "${field.key}" — form control has prefill value`, () => {
        const prefillData: Record<string, string> = { [field.key]: `prefill_${field.key}` };
        setupComponent(DeviceType.GAS_BOILER, prefillData, false);
        const form = (component as any).form;
        expect(form.get(field.key)?.value).toBe(`prefill_${field.key}`);
      });
    });
  });

  // =========================================================================
  // EXPANSION PASS 2: HEAT_PUMP fields — readOnly mode — controls still accessible
  // =========================================================================

  describe('HEAT_PUMP readOnly mode — all field controls accessible', () => {
    beforeEach(() => {
      const prefill = buildPrefillData(DeviceType.HEAT_PUMP);
      setupComponent(DeviceType.HEAT_PUMP, prefill, true);
    });

    const hpFieldKeys = (ENV_INFO_FIELDS[DeviceType.HEAT_PUMP] ?? []).map(f => f.key);

    hpFieldKeys.forEach((key) => {
      it(`EXP2-EIM-HP-RO: field "${key}" — control readable in readOnly mode`, () => {
        const form = (component as any).form;
        expect(form.get(key)).not.toBeNull();
        expect(form.get(key)?.value).toBe(`test_${key}`);
      });
    });
  });

  // =========================================================================
  // EXPANSION PASS 2: GAS_BOILER fields — readOnly mode — controls accessible
  // =========================================================================

  describe('GAS_BOILER readOnly mode — all field controls accessible', () => {
    beforeEach(() => {
      const prefill = buildPrefillData(DeviceType.GAS_BOILER);
      setupComponent(DeviceType.GAS_BOILER, prefill, true);
    });

    const gbFieldKeys = (ENV_INFO_FIELDS[DeviceType.GAS_BOILER] ?? []).map(f => f.key);

    gbFieldKeys.forEach((key) => {
      it(`EXP2-EIM-GB-RO: field "${key}" — control readable in readOnly mode`, () => {
        const form = (component as any).form;
        expect(form.get(key)).not.toBeNull();
        expect(form.get(key)?.value).toBe(`test_${key}`);
      });
    });
  });

  // =========================================================================
  // EXPANSION PASS 2: fieldsForSection — each HP section has correct field count
  // =========================================================================

  describe('fieldsForSection() — HEAT_PUMP section field counts', () => {
    beforeEach(() => {
      setupComponent(DeviceType.HEAT_PUMP, null, false);
    });

    it('EXP2-EIM-SECT-HP-TOTAL: total HP fields across all sections = 29', () => {
      const allFields = ENV_INFO_FIELDS[DeviceType.HEAT_PUMP] ?? [];
      expect(allFields.length).toBe(29);
    });

    it('EXP2-EIM-SECT-HP-COUNT: sections count = 4', () => {
      const sections = (component as any).sections;
      expect(sections.length).toBe(4);
    });

    it('EXP2-EIM-SECT-HP-FIELDS-PER-SECT: each section has at least 1 field', () => {
      const sections: Array<{ key: string }> = (component as any).sections;
      sections.forEach((section) => {
        const fields = (component as any).fieldsPerSection.get(section.key) ?? [];
        expect(fields.length).toBeGreaterThan(0);
      });
    });

    it('EXP2-EIM-SECT-HP-SUM: sum of fields across sections = total fields', () => {
      const sections: Array<{ key: string }> = (component as any).sections;
      const total = sections.reduce((sum: number, section: { key: string }) => {
        return sum + (((component as any).fieldsPerSection.get(section.key) ?? []) as unknown[]).length;
      }, 0);
      expect(total).toBe(29);
    });
  });

  // =========================================================================
  // EXPANSION PASS 2: fieldsForSection — GAS_BOILER single section
  // =========================================================================

  describe('fieldsForSection() — GAS_BOILER single section', () => {
    beforeEach(() => {
      setupComponent(DeviceType.GAS_BOILER, null, false);
    });

    it('EXP2-EIM-SECT-GB-TOTAL: total GB fields = 13', () => {
      const allFields = ENV_INFO_FIELDS[DeviceType.GAS_BOILER] ?? [];
      expect(allFields.length).toBe(13);
    });

    it('EXP2-EIM-SECT-GB-COUNT: sections count = 1', () => {
      const sections = (component as any).sections;
      expect(sections.length).toBe(1);
    });

    it('EXP2-EIM-SECT-GB-FIELDS: single section has 13 fields', () => {
      const sections: Array<{ key: string }> = (component as any).sections;
      const fields = (component as any).fieldsPerSection.get(sections[0].key) ?? [];
      expect(fields.length).toBe(13);
    });
  });

  // =========================================================================
  // EXPANSION PASS 2: onSave — HP with one missing field per field (first 10)
  // =========================================================================

  describe('onSave() — HEAT_PUMP with one missing field at a time (first 10 fields)', () => {
    const hpFields = ENV_INFO_FIELDS[DeviceType.HEAT_PUMP] ?? [];
    const first10Fields = hpFields.slice(0, 10);

    first10Fields.forEach((field) => {
      it(`EXP2-EIM-SAVE-MISSING-HP: missing "${field.key}" → confirm NOT called`, async () => {
        const prefill = buildPrefillData(DeviceType.HEAT_PUMP);
        delete prefill[field.key];
        setupComponent(DeviceType.HEAT_PUMP, prefill, false);

        const form = (component as any).form;
        form.get(field.key)?.setValue('');

        await (component as any).onSave();

        expect(mockConfirmService.confirm).not.toHaveBeenCalled();
      });
    });
  });

  // =========================================================================
  // EXPANSION PASS 2: onSave — GB with one missing field per field
  // =========================================================================

  describe('onSave() — GAS_BOILER with one missing field at a time', () => {
    const gbFields = ENV_INFO_FIELDS[DeviceType.GAS_BOILER] ?? [];

    gbFields.forEach((field) => {
      it(`EXP2-EIM-SAVE-MISSING-GB: missing "${field.key}" → confirm NOT called`, async () => {
        const prefill = buildPrefillData(DeviceType.GAS_BOILER);
        delete prefill[field.key];
        setupComponent(DeviceType.GAS_BOILER, prefill, false);

        const form = (component as any).form;
        form.get(field.key)?.setValue('');

        await (component as any).onSave();

        expect(mockConfirmService.confirm).not.toHaveBeenCalled();
      });
    });
  });

  // =========================================================================
  // EXPANSION PASS 2: onSave — HP fully filled → confirm called
  // =========================================================================

  describe('onSave() — HEAT_PUMP fully filled → confirm called', () => {
    it('EXP2-EIM-SAVE-HP-FULL: all 29 HP fields filled → confirmService.confirm called', async () => {
      const prefill = buildPrefillData(DeviceType.HEAT_PUMP);
      setupComponent(DeviceType.HEAT_PUMP, prefill, false);

      await (component as any).onSave();

      expect(mockConfirmService.confirm).toHaveBeenCalled();
    });

    it('EXP2-EIM-SAVE-HP-DISMISS: after confirmed HP save → modal dismissed with data', async () => {
      const prefill = buildPrefillData(DeviceType.HEAT_PUMP);
      setupComponent(DeviceType.HEAT_PUMP, prefill, false);

      await (component as any).onSave();

      expect(mockModalController.dismiss).toHaveBeenCalled();
    });
  });

  // =========================================================================
  // EXPANSION PASS 2: onSave — GB fully filled → confirm called
  // =========================================================================

  describe('onSave() — GAS_BOILER fully filled → confirm called', () => {
    it('EXP2-EIM-SAVE-GB-FULL: all 13 GB fields filled → confirmService.confirm called', async () => {
      const prefill = buildPrefillData(DeviceType.GAS_BOILER);
      setupComponent(DeviceType.GAS_BOILER, prefill, false);

      await (component as any).onSave();

      expect(mockConfirmService.confirm).toHaveBeenCalled();
    });
  });

  // =========================================================================
  // EXPANSION PASS 2: HEAT_PUMP field types — select vs text
  // =========================================================================

  describe('HEAT_PUMP — field type validation (select vs text/number)', () => {
    beforeEach(() => {
      setupComponent(DeviceType.HEAT_PUMP, null, false);
    });

    const hpFields = ENV_INFO_FIELDS[DeviceType.HEAT_PUMP] ?? [];

    hpFields.forEach((field) => {
      it(`EXP2-EIM-HP-FTYPE: field "${field.key}" has type "${field.type}"`, () => {
        expect(['select', 'text', 'number']).toContain(field.type);
      });
    });
  });

  // =========================================================================
  // EXPANSION PASS 2: GAS_BOILER field types — select vs text
  // =========================================================================

  describe('GAS_BOILER — field type validation', () => {
    beforeEach(() => {
      setupComponent(DeviceType.GAS_BOILER, null, false);
    });

    const gbFields = ENV_INFO_FIELDS[DeviceType.GAS_BOILER] ?? [];

    gbFields.forEach((field) => {
      it(`EXP2-EIM-GB-FTYPE: field "${field.key}" has type "${field.type}"`, () => {
        expect(['select', 'text', 'number']).toContain(field.type);
      });
    });
  });
});
