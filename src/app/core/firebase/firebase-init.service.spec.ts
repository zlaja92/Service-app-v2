import { TestBed } from '@angular/core/testing';
import { Capacitor } from '@capacitor/core';
import { FirebaseInitService } from './firebase-init.service';
import { LoggerService } from '../logger/logger.service';
import { createMockLoggerService } from '../../testing/mock-factories';

// Firebase se koristi isključivo kroz native plugine; FirebaseInitService više
// ne inicijalizuje web JS SDK. initialize() je bezbedan no-op koji samo loguje.
describe('FirebaseInitService', () => {
  let service: FirebaseInitService;
  let mockLogger: jasmine.SpyObj<LoggerService>;

  beforeEach(() => {
    mockLogger = createMockLoggerService();

    TestBed.configureTestingModule({
      providers: [
        FirebaseInitService,
        { provide: LoggerService, useValue: mockLogger },
      ],
    });

    service = TestBed.inject(FirebaseInitService);
  });

  it('TC-FI01: initialize() ne baca na native platformi', () => {
    spyOn(Capacitor, 'isNativePlatform').and.returnValue(true);
    expect(() => service.initialize()).not.toThrow();
    expect(mockLogger.debug).toHaveBeenCalled();
  });

  it('TC-FI02: initialize() ne baca na web platformi (web SDK se ne koristi)', () => {
    spyOn(Capacitor, 'isNativePlatform').and.returnValue(false);
    expect(() => service.initialize()).not.toThrow();
    expect(mockLogger.debug).toHaveBeenCalled();
  });
});
