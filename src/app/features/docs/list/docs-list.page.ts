import { Component, inject } from '@angular/core';
import {
  IonHeader, IonToolbar, IonTitle, IonContent, IonButtons, IonBackButton,
  IonList, IonItem, IonLabel, IonIcon, IonButton, IonSkeletonText, IonMenuButton,
  ViewWillEnter,
} from '@ionic/angular/standalone';
import { addIcons } from 'ionicons';
import { documentOutline, folderOutline, arrowBackOutline } from 'ionicons/icons';
import { TranslocoModule } from '@jsverse/transloco';
import { DocsService } from '../services/docs.service';
import { DocEntry } from '../models/doc.model';

@Component({
  selector: 'app-docs-list',
  templateUrl: './docs-list.page.html',
  styleUrls: ['./docs-list.page.scss'],
  imports: [
    IonHeader, IonToolbar, IonTitle, IonContent, IonButtons, IonBackButton,
    IonList, IonItem, IonLabel, IonIcon, IonButton, IonSkeletonText, IonMenuButton,
    TranslocoModule,
  ],
})
export class DocsListPage implements ViewWillEnter {
  protected docsService = inject(DocsService);

  constructor() {
    addIcons({ documentOutline, folderOutline, arrowBackOutline });
  }

  ionViewWillEnter(): void {
    this.docsService.loadFolder();
  }

  onEntryClick(entry: DocEntry): void {
    if (entry.isFolder) {
      this.docsService.loadFolder(entry.fullPath);
    } else {
      this.docsService.openFile(entry);
    }
  }

  goBack(): void {
    this.docsService.goBack();
  }
}
