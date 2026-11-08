import { Component, CUSTOM_ELEMENTS_SCHEMA, DebugElement } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { By } from '@angular/platform-browser';
import { DatePickerDirective } from './date-picker.directive';

// ion-input is not defined as a web component in unit tests; the host element
// gets a fake getInputElement() returning a real <input type="date">.
@Component({
  template: `<ion-input type="date"></ion-input>`,
  imports: [DatePickerDirective],
  schemas: [CUSTOM_ELEMENTS_SCHEMA],
})
class HostComponent {}

describe('DatePickerDirective', () => {
  let debugEl: DebugElement;
  let nativeInput: HTMLInputElement & { showPicker: jasmine.Spy };

  beforeEach(() => {
    const fixture = TestBed.configureTestingModule({ imports: [HostComponent] }).createComponent(HostComponent);
    fixture.detectChanges();
    debugEl = fixture.debugElement.query(By.directive(DatePickerDirective));

    nativeInput = Object.assign(document.createElement('input'), { type: 'date' }) as typeof nativeInput;
    nativeInput.showPicker = jasmine.createSpy('showPicker');
    (debugEl.nativeElement as { getInputElement: () => Promise<HTMLInputElement> }).getInputElement =
      () => Promise.resolve(nativeInput);
  });

  it('applies to <ion-input type="date">', () => {
    expect(debugEl).toBeTruthy();
  });

  it('opens the native picker when the field is tapped', async () => {
    await debugEl.injector.get(DatePickerDirective).openPicker();

    expect(nativeInput.showPicker).toHaveBeenCalledTimes(1);
  });

  it('opens the picker on a click on the host element', async () => {
    const directive = debugEl.injector.get(DatePickerDirective);
    const spy = spyOn(directive, 'openPicker').and.resolveTo();

    (debugEl.nativeElement as HTMLElement).click();

    expect(spy).toHaveBeenCalled();
  });

  it('ignores showPicker errors (unsupported or already open)', async () => {
    nativeInput.showPicker.and.throwError(new DOMException('already open', 'InvalidStateError'));

    await expectAsync(debugEl.injector.get(DatePickerDirective).openPicker()).toBeResolved();
  });
});
