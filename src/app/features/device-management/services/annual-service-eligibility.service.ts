import { Injectable, inject } from '@angular/core';
import { LoggerService } from '../../../core/logger/logger.service';
import { ServerTimeService } from '../../../core/firebase/server-time.service';
import { Clearable } from '../../../core/session/clearable';
import { Device } from '../../../shared/models/device.model';
import { InterventionService } from './intervention.service';
import { InterventionType } from '../models/intervention.model';

export interface ServiceWindowParams {
  firstServiceYear: number;
  serviceWindowStart: number;
  serviceWindowEnd: number;
  warrantyMonths: number;
}

export type DisableReason =
  | 'no_service_period_params'
  | 'no_warranty_document_field'
  | 'not_in_warranty'
  | 'no_purchase_date'
  | 'warranty_expired'
  | 'missed_annual_service'
  | 'already_serviced'
  | 'outside_window'
  | 'server_time_unavailable'
  | null;

@Injectable({ providedIn: 'root' })
export class AnnualServiceEligibilityService implements Clearable {
  private readonly interventionService = inject(InterventionService);
  private readonly serverTimeService = inject(ServerTimeService);
  private readonly logger = inject(LoggerService);

  isEligible = false;
  isChecking = false;
  disableReason: DisableReason = null;

  async checkEligibility(sn: string, device: Device): Promise<void> {
    this.isChecking = true;
    this.isEligible = false;
    this.disableReason = null;

    try {
      this.logger.info('Eligibility check started', { sn, deviceType: device.type });

      const params = this.extractParams(device);
      if (!params) {
        this.disableReason = 'no_service_period_params';
        this.logger.warn('Eligibility: missing service period params', { sn });
        return;
      }

      const registration = await this.interventionService.getRegistration(sn);
      if (!registration) {
        this.disableReason = 'no_warranty_document_field';
        this.logger.warn('Eligibility: no registration found', { sn });
        return;
      }

      const warrantyStatus = registration['warrantyStatus'];
      if (warrantyStatus == null) {
        this.disableReason = 'no_warranty_document_field';
        this.logger.warn('Eligibility: warrantyStatus field missing', { sn });
        return;
      }

      if (warrantyStatus !== 'in_warranty') {
        this.disableReason = 'not_in_warranty';
        this.logger.warn('Eligibility: device not in warranty', { sn, warrantyStatus });
        return;
      }

      const commissioningDate = this.toDate(registration['dateOfPurchase']);
      if (!commissioningDate) {
        this.disableReason = 'no_purchase_date';
        this.logger.warn('Eligibility: no purchase date', { sn });
        return;
      }

      const extendedWarrantyMonths = Number(registration['extendedWarrantyMonths']) || 0;

      const now = await this.serverTimeService.getServerTime();
      if (!now) {
        this.disableReason = 'server_time_unavailable';
        this.logger.warn('Eligibility: server time unavailable', { sn });
        return;
      }

      const interventions = await this.interventionService.getInterventionsBySn(sn, device.type);
      const annualServiceDates = interventions
        .filter(i => i.data['interventionType'] === InterventionType.ANNUAL_SERVICE)
        .map(i => this.toDate(i.data['addedDate']))
        .filter((d): d is Date => d !== null);

      this.logger.info('Eligibility data', {
        sn,
        commissioningDate: commissioningDate.toLocaleString(),
        serverTime: now.toLocaleString(),
        extendedWarrantyMonths,
        annualServiceCount: annualServiceDates.length,
        params,
      });

      const result = this.determineEligibility(
        params,
        commissioningDate,
        now,
        annualServiceDates,
        extendedWarrantyMonths,
      );

      this.isEligible = result.eligible;
      this.disableReason = result.reason;

      this.logger.info('Eligibility check complete', {
        sn,
        eligible: result.eligible,
        reason: result.reason,
      });
    } catch (error) {
      this.logger.error('Eligibility check failed', { sn, error: String(error) });
      this.isEligible = false;
      this.disableReason = null;
    } finally {
      this.isChecking = false;
    }
  }

  determineEligibility(
    params: ServiceWindowParams,
    commissioningDate: Date,
    now: Date,
    annualServiceDates: Date[],
    extendedWarrantyMonths: number,
  ): { eligible: boolean; reason: DisableReason } {
    const effectiveWarranty = params.warrantyMonths + extendedWarrantyMonths;
    const monthsElapsed = this.monthsDiff(commissioningDate, now);

    if (monthsElapsed > effectiveWarranty) {
      return { eligible: false, reason: 'warranty_expired' };
    }

    for (let n = params.firstServiceYear; ; n++) {
      const windowStart = (n - 1) * 12 + params.serviceWindowStart;
      const windowEnd = (n - 1) * 12 + params.serviceWindowEnd;

      if (windowStart > effectiveWarranty) break;

      if (monthsElapsed > windowEnd) {
        const hasService = this.hasServiceInWindow(
          annualServiceDates, commissioningDate, windowStart, windowEnd,
        );
        if (!hasService) {
          return { eligible: false, reason: 'missed_annual_service' };
        }
        continue;
      }

      if (monthsElapsed >= windowStart) {
        const hasService = this.hasServiceInWindow(
          annualServiceDates, commissioningDate, windowStart, windowEnd,
        );
        if (hasService) {
          return { eligible: false, reason: 'already_serviced' };
        }
        return { eligible: true, reason: null };
      }

      return { eligible: false, reason: 'outside_window' };
    }

    return { eligible: false, reason: 'outside_window' };
  }

  clear(): void {
    this.isEligible = false;
    this.isChecking = false;
    this.disableReason = null;
  }

  private hasServiceInWindow(
    serviceDates: Date[],
    commissioningDate: Date,
    windowStart: number,
    windowEnd: number,
  ): boolean {
    return serviceDates.some(date => {
      const months = this.monthsDiff(commissioningDate, date);
      return months >= windowStart && months <= windowEnd;
    });
  }

  private monthsDiff(from: Date, to: Date): number {
    return (to.getFullYear() - from.getFullYear()) * 12
      + (to.getMonth() - from.getMonth());
  }

  private extractParams(device: Device): ServiceWindowParams | null {
    if (
      device.firstServiceYear == null
      || device.serviceWindowStart == null
      || device.serviceWindowEnd == null
      || device.warrantyMonths == null
    ) {
      return null;
    }

    const firstServiceYear = Number(device.firstServiceYear);
    const serviceWindowStart = Number(device.serviceWindowStart);
    const serviceWindowEnd = Number(device.serviceWindowEnd);
    const warrantyMonths = Number(device.warrantyMonths);

    if ([firstServiceYear, serviceWindowStart, serviceWindowEnd, warrantyMonths].some(isNaN)) {
      return null;
    }

    if (firstServiceYear < 1) {
      this.logger.warn('extractParams: firstServiceYear must be >= 1', { firstServiceYear });
      return null;
    }

    return { firstServiceYear, serviceWindowStart, serviceWindowEnd, warrantyMonths };
  }

  private toDate(value: unknown): Date | null {
    if (!value) return null;
    if (value instanceof Date) return value;
    if (typeof value === 'object' && value !== null && 'seconds' in value) {
      return new Date((value as { seconds: number }).seconds * 1000);
    }
    if (typeof value === 'string') {
      const d = new Date(value);
      return isNaN(d.getTime()) ? null : d;
    }
    return null;
  }

}
