import { Component, inject } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import {
  IonHeader, IonToolbar, IonTitle, IonContent, IonButtons, IonBackButton,
  IonList, IonItem, IonLabel, IonSkeletonText, IonMenuButton, ViewWillEnter,
} from '@ionic/angular/standalone';
import { DevicePartsService } from '../services/device-parts.service';
import { DeviceGroupsService } from '../services/device-groups.service';

@Component({
  selector: 'app-device-parts',
  templateUrl: './device-parts.page.html',
  styleUrls: ['./device-parts.page.scss'],
  imports: [
    IonHeader, IonToolbar, IonTitle, IonContent, IonButtons, IonBackButton,
    IonList, IonItem, IonLabel, IonSkeletonText, IonMenuButton,
  ],
})
export class DevicePartsPage implements ViewWillEnter {
  protected partsService = inject(DevicePartsService);
  private groupsService = inject(DeviceGroupsService);
  private route = inject(ActivatedRoute);

  ionViewWillEnter(): void {
    const code = this.route.snapshot.paramMap.get('code') ?? '';
    const groupId = this.route.snapshot.paramMap.get('groupId') ?? '';
    const groupPhoto = this.groupsService.groups.find((g) => g.id === groupId)?.groupPhoto ?? '';

    this.partsService.load(code, groupId, groupPhoto);
  }
}
