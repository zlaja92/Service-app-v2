import { Component } from '@angular/core';
import { IonRouterOutlet } from '@ionic/angular/standalone';
import { MenuComponent } from '../menu/menu.component';

@Component({
  selector: 'app-shell',
  template: `
    <app-menu />
    <ion-router-outlet id="main-content" />
  `,
  imports: [IonRouterOutlet, MenuComponent],
})
export class ShellComponent {}
