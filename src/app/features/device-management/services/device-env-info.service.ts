import { Injectable, inject } from '@angular/core';
import { ModalController } from '@ionic/angular/standalone';
import { LoggerService } from '../../../core/logger/logger.service';
import { DeviceType } from '../../../shared/models/device.model';
import { InterventionService } from './intervention.service';
import { DeviceEnvInfoModalComponent } from '../components/device-env-info-modal/device-env-info-modal.component';

@Injectable({ providedIn: 'root' })
export class DeviceEnvInfoService {
  private readonly modalController = inject(ModalController);
  private readonly interventionService = inject(InterventionService);
  private readonly logger = inject(LoggerService);

  async collectEnvInfo(
    deviceType: DeviceType,
    sn: string,
    prefill: Record<string, string> | null,
  ): Promise<Record<string, string> | null> {
    const modal = await this.modalController.create({
      component: DeviceEnvInfoModalComponent,
      componentProps: {
        deviceType,
        prefillData: prefill,
        readOnly: false,
      },
      cssClass: 'fullscreen-modal',
    });

    await modal.present();
    const { data, role } = await modal.onDidDismiss<Record<string, string>>();

    if (role === 'save' && data) {
      this.logger.info('Env info collected', { sn, deviceType });
      return data;
    }

    this.logger.info('Env info collection cancelled', { sn });
    return null;
  }

  async viewEnvInfo(
    deviceType: DeviceType,
    envInfo: Record<string, string>,
  ): Promise<void> {
    const modal = await this.modalController.create({
      component: DeviceEnvInfoModalComponent,
      componentProps: {
        deviceType,
        prefillData: envInfo,
        readOnly: true,
      },
      cssClass: 'fullscreen-modal',
    });
    await modal.present();
  }

  async getLastEnvInfo(sn: string): Promise<Record<string, string> | null> {
    const interventions = await this.interventionService.getInterventionsBySn(sn);

    for (let i = interventions.length - 1; i >= 0; i--) {
      const envInfo = interventions[i].data['envInfo'] as Record<string, string> | undefined;
      if (envInfo && Object.keys(envInfo).length > 0) {
        return envInfo;
      }
    }

    return null;
  }
}
