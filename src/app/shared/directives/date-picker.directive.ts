import { Directive, ElementRef, inject } from '@angular/core';

/**
 * Opens the native calendar when anywhere on an <ion-input type="date"> is
 * tapped. Newer Android WebViews render the date input as editable
 * day/month/year segments that open the calendar only through a small
 * indicator icon; tapping a segment just selects it. Calling showPicker()
 * makes the whole field behave the same on every WebView version.
 */
@Directive({
  selector: 'ion-input[type="date"]',
  host: { '(click)': 'openPicker()' },
})
export class DatePickerDirective {
  private readonly host = inject<ElementRef<HTMLIonInputElement>>(ElementRef);

  async openPicker(): Promise<void> {
    const input = await this.host.nativeElement.getInputElement();
    try {
      // Unsupported on old WebViews; throws if the picker is already open.
      input.showPicker?.();
    } catch {
      // The field stays usable through the platform's own behaviour.
    }
  }
}
