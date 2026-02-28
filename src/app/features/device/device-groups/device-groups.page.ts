import { Component, inject } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import {
  IonHeader, IonToolbar, IonTitle, IonContent, IonButtons, IonBackButton,
  IonList, IonItem, IonLabel, IonSkeletonText, IonMenuButton, ViewWillEnter,
} from '@ionic/angular/standalone';
import { DeviceGroupsService } from '../services/device-groups.service';
import { Group } from '../../../shared/models/group.model';

@Component({
  selector: 'app-device-groups',
  templateUrl: './device-groups.page.html',
  styleUrls: ['./device-groups.page.scss'],
  imports: [
    IonHeader, IonToolbar, IonTitle, IonContent, IonButtons, IonBackButton,
    IonList, IonItem, IonLabel, IonSkeletonText, IonMenuButton,
  ],
})
export class DeviceGroupsPage implements ViewWillEnter {
  protected groupsService = inject(DeviceGroupsService);
  private route = inject(ActivatedRoute);
  private router = inject(Router);

  private deviceCode = '';

  ionViewWillEnter(): void {
    this.deviceCode = this.route.snapshot.paramMap.get('code') ?? '';
    this.groupsService.load(this.deviceCode);
  }

  onGroupClick(group: Group): void {
    this.router.navigate(['/device', this.deviceCode, 'device-groups', group.id, 'device-parts']);
  }
}
