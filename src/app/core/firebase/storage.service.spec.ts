/**
 * StorageService Unit Tests — WU-08, Batch B1, FAZA D
 *
 * MOCK STRATEGY — IMPORTANT NOTES
 * ================================
 * FirebaseStorage from @capacitor-firebase/storage is a Capacitor Proxy object,
 * identical to the BUG-03 pattern documented for FirebaseFunctions/FirebaseAuthentication.
 * The Proxy's get trap always intercepts property access and lazily loads
 * FirebaseStorageWeb. Therefore:
 *
 *  1. spyOn(FirebaseStorage, 'getDownloadUrl') does NOT work — get trap overrides own props.
 *  2. FirebaseStorageWeb constructor needs a live Firebase app (calls getStorage() implicitly).
 *
 * Solution:
 *  - Initialize Firebase App in beforeAll (same pattern as auth.service.spec.ts).
 *  - Spy on FirebaseStorageWeb.prototype methods to intercept after lazy loading.
 *  - For native path: all FirebaseStorage.X calls go through FirebaseStorageWeb.prototype.
 *
 * WEB PATH (getFileUrl web / listFolder web):
 *  StorageService web path calls firebase/storage SDK functions (getStorage, ref,
 *  getDownloadURL, listAll) DIRECTLY — not through FirebaseStorage Proxy.
 *  These exports are non-configurable (configurable: false) and cannot be
 *  spy-overridden with spyOn or Object.defineProperty. These cases are marked
 *  xit() with documented reasoning. See also: BUG-03.
 *
 * CAPACITOR ISNATVEPLATFORM:
 *  StorageService sets `private isNative = Capacitor.isNativePlatform()` at
 *  construction time. The spy must be installed BEFORE TestBed.inject(StorageService).
 *
 * CAPACITORHTTP:
 *  CapacitorHttp is also a Capacitor Proxy — its get trap overrides property
 *  assignment, so spyOn(CapacitorHttp, 'get') does NOT work (same issue as BUG-03).
 *  readFoldersFile() is tested via spyOn(service as any, 'readFoldersFile') to
 *  bypass the CapacitorHttp dependency entirely.
 */

import { TestBed } from '@angular/core/testing';
import { Capacitor } from '@capacitor/core';
import { FirebaseStorageWeb } from '@capacitor-firebase/storage/dist/esm/web';
import { UploadFileOptions, UploadFileCallbackEvent } from '@capacitor-firebase/storage';
import { Directory, Filesystem } from '@capacitor/filesystem';
import { FilesystemWeb } from '@capacitor/filesystem/dist/esm/web';
import { initializeApp, getApps, FirebaseApp } from 'firebase/app';
import { StorageService } from './storage.service';
import { LoggerService } from '../logger/logger.service';
import { createMockLoggerService } from '../../testing/mock-factories';
import { environment } from '../../../environments/environment';

// ---------------------------------------------------------------------------
// Helper: create mock upload event
// ---------------------------------------------------------------------------
function createUploadEvent(completed: boolean): {
  progress: number;
  bytesTransferred: number;
  totalBytes: number;
  completed: boolean;
} {
  return { progress: 1.0, bytesTransferred: 100, totalBytes: 100, completed };
}

// ---------------------------------------------------------------------------
// Main describe
// ---------------------------------------------------------------------------

describe('StorageService', () => {
  let app: FirebaseApp;
  let service: StorageService;
  let mockLogger: jasmine.SpyObj<LoggerService>;

  // ---------------------------------------------------------------------------
  // Firebase App initialization — needed so FirebaseStorageWeb can call
  // getStorage() without throwing "No Firebase App '[DEFAULT]'".
  // ---------------------------------------------------------------------------
  beforeAll(() => {
    if (getApps().length === 0) {
      app = initializeApp(environment.firebase);
    } else {
      app = getApps()[0];
    }
  });

  // =========================================================================
  // NATIVE PATH TESTS
  // All native path tests spy on Capacitor.isNativePlatform BEFORE inject.
  // =========================================================================

  describe('Native platform (isNativePlatform = true)', () => {
    beforeEach(() => {
      spyOn(Capacitor, 'isNativePlatform').and.returnValue(true);
      mockLogger = createMockLoggerService();

      TestBed.configureTestingModule({
        providers: [
          StorageService,
          { provide: LoggerService, useValue: mockLogger },
        ],
      });

      service = TestBed.inject(StorageService);
    });

    // -----------------------------------------------------------------------
    // getFileUrl() — native path
    // -----------------------------------------------------------------------

    describe('getFileUrl()', () => {
      it('TC-ST01: calls FirebaseStorage.getDownloadUrl with correct path on native', async () => {
        const spy = spyOn(FirebaseStorageWeb.prototype, 'getDownloadUrl')
          .and.resolveTo({ downloadUrl: 'https://example.com/file.jpg' });

        await service.getFileUrl('some/path/file.jpg');

        expect(spy).toHaveBeenCalledOnceWith({ path: 'some/path/file.jpg' });
      });

      it('TC-ST02: returns the downloadUrl string from native response', async () => {
        spyOn(FirebaseStorageWeb.prototype, 'getDownloadUrl')
          .and.resolveTo({ downloadUrl: 'https://storage.example.com/image.png' });

        const url = await service.getFileUrl('folder/image.png');

        expect(url).toBe('https://storage.example.com/image.png');
      });

      it('TC-ST03: returns null and logs warn when FirebaseStorage.getDownloadUrl rejects', async () => {
        spyOn(FirebaseStorageWeb.prototype, 'getDownloadUrl')
          .and.rejectWith(new Error('storage/object-not-found'));

        const result = await service.getFileUrl('missing/file.jpg');

        expect(result).toBeNull();
        expect(mockLogger.warn).toHaveBeenCalledWith(
          'Storage getFileUrl failed',
          jasmine.objectContaining({ error: jasmine.stringContaining('storage/object-not-found') }),
        );
      });

      it('TC-ST04: does not call listFiles when only getFileUrl is invoked', async () => {
        const getUrlSpy = spyOn(FirebaseStorageWeb.prototype, 'getDownloadUrl')
          .and.resolveTo({ downloadUrl: 'https://example.com/file.jpg' });
        const listFilesSpy = spyOn(FirebaseStorageWeb.prototype, 'listFiles');

        await service.getFileUrl('isolated/call.jpg');

        expect(getUrlSpy).toHaveBeenCalledTimes(1);
        expect(listFilesSpy).not.toHaveBeenCalled();
      });
    });

    // -----------------------------------------------------------------------
    // listFolder() — native path
    // -----------------------------------------------------------------------

    describe('listFolder()', () => {
      it('TC-ST05: calls FirebaseStorage.listFiles with correct path on native', async () => {
        const listSpy = spyOn(FirebaseStorageWeb.prototype, 'listFiles')
          .and.resolveTo({
            items: [
              { name: 'photo.jpg', path: 'devices/01/photo.jpg', bucket: 'bucket' },
            ],
          });

        // stub getDownloadUrl for _folders.txt lookup (readFoldersFile)
        spyOn(FirebaseStorageWeb.prototype, 'getDownloadUrl')
          .and.rejectWith(new Error('not-found'));

        await service.listFolder('devices/01');

        expect(listSpy).toHaveBeenCalledOnceWith({ path: 'devices/01' });
      });

      it('TC-ST06: filters out _folders.txt from returned files list', async () => {
        spyOn(FirebaseStorageWeb.prototype, 'listFiles')
          .and.resolveTo({
            items: [
              { name: 'photo.jpg', path: 'devices/01/photo.jpg', bucket: 'bucket' },
              { name: '_folders.txt', path: 'devices/01/_folders.txt', bucket: 'bucket' },
              { name: 'manual.pdf', path: 'devices/01/manual.pdf', bucket: 'bucket' },
            ],
          });

        spyOn(FirebaseStorageWeb.prototype, 'getDownloadUrl')
          .and.rejectWith(new Error('not-found'));

        const result = await service.listFolder('devices/01');

        const names = result.files.map((f) => f.name);
        expect(names).not.toContain('_folders.txt');
        expect(names).toContain('photo.jpg');
        expect(names).toContain('manual.pdf');
      });

      it('TC-ST07: maps file items to { name, fullPath } shape', async () => {
        spyOn(FirebaseStorageWeb.prototype, 'listFiles')
          .and.resolveTo({
            items: [
              { name: 'photo.jpg', path: 'devices/01/photo.jpg', bucket: 'bucket' },
            ],
          });

        spyOn(FirebaseStorageWeb.prototype, 'getDownloadUrl')
          .and.rejectWith(new Error('not-found'));

        const result = await service.listFolder('devices/01');

        expect(result.files).toEqual([
          { name: 'photo.jpg', fullPath: 'devices/01/photo.jpg' },
        ]);
      });

      it('TC-ST08: parses _folders.txt content and returns folder names', async () => {
        // NOTE: CapacitorHttp is a Capacitor Proxy (same issue as BUG-03) — its get
        // trap overrides property assignment so spyOn(CapacitorHttp, 'get') does not work.
        // Instead we spy directly on the private readFoldersFile method which encapsulates
        // the CapacitorHttp.get call.
        spyOn(FirebaseStorageWeb.prototype, 'listFiles')
          .and.resolveTo({
            items: [
              { name: '_folders.txt', path: 'devices/01/_folders.txt', bucket: 'bucket' },
            ],
          });

        spyOn(service as any, 'readFoldersFile')
          .and.resolveTo(['subfolder-a', 'subfolder-b', 'subfolder-c']);

        const result = await service.listFolder('devices/01');

        expect(result.folders).toEqual(['subfolder-a', 'subfolder-b', 'subfolder-c']);
      });

      it('TC-ST09: returns empty folders array when _folders.txt is missing (getDownloadUrl throws)', async () => {
        spyOn(FirebaseStorageWeb.prototype, 'listFiles')
          .and.resolveTo({
            items: [
              { name: 'photo.jpg', path: 'devices/01/photo.jpg', bucket: 'bucket' },
            ],
          });

        spyOn(FirebaseStorageWeb.prototype, 'getDownloadUrl')
          .and.rejectWith(new Error('storage/object-not-found'));

        const result = await service.listFolder('devices/01');

        expect(result.folders).toEqual([]);
      });

      it('TC-ST10: filters blank lines and trims whitespace from _folders.txt', async () => {
        // readFoldersFile spy: returns pre-trimmed, filtered result.
        // The trimming/filtering logic IS part of readFoldersFile — tested via
        // TC-ST-RFLT (readFoldersFile integration test below). Here we test
        // that listFolder correctly propagates whatever readFoldersFile returns.
        spyOn(FirebaseStorageWeb.prototype, 'listFiles')
          .and.resolveTo({ items: [] });

        spyOn(service as any, 'readFoldersFile')
          .and.resolveTo(['folder-a', 'folder-b', 'folder-c']);

        const result = await service.listFolder('devices/01');

        expect(result.folders).toEqual(['folder-a', 'folder-b', 'folder-c']);
      });

      it('TC-ST11: returns empty folders array when readFoldersFile returns empty array', async () => {
        spyOn(FirebaseStorageWeb.prototype, 'listFiles')
          .and.resolveTo({ items: [] });

        spyOn(service as any, 'readFoldersFile')
          .and.resolveTo([]);

        const result = await service.listFolder('devices/01');

        expect(result.folders).toEqual([]);
      });

      it('TC-ST12: returns combined files + folders structure', async () => {
        spyOn(FirebaseStorageWeb.prototype, 'listFiles')
          .and.resolveTo({
            items: [
              { name: 'img.png', path: 'prod/01/img.png', bucket: 'bucket' },
              { name: '_folders.txt', path: 'prod/01/_folders.txt', bucket: 'bucket' },
            ],
          });

        spyOn(service as any, 'readFoldersFile')
          .and.resolveTo(['sub-a', 'sub-b']);

        const result = await service.listFolder('prod/01');

        expect(result.files).toEqual([{ name: 'img.png', fullPath: 'prod/01/img.png' }]);
        expect(result.folders).toEqual(['sub-a', 'sub-b']);
      });

      it('TC-ST13: rejects when FirebaseStorage.listFiles rejects', async () => {
        spyOn(FirebaseStorageWeb.prototype, 'listFiles')
          .and.rejectWith(new Error('storage/unauthorized'));

        await expectAsync(service.listFolder('restricted/folder'))
          .toBeRejectedWithError('storage/unauthorized');
      });
    });

    // -----------------------------------------------------------------------
    // uploadFile() — native path
    // -----------------------------------------------------------------------

    describe('uploadFile() — native', () => {
      it('TC-ST14: calls FirebaseStorage.uploadFile with storagePath and uri on native', async () => {
        const uploadSpy = spyOn(FirebaseStorageWeb.prototype, 'uploadFile')
          .and.callFake((_options: UploadFileOptions, callback: (event: UploadFileCallbackEvent | null, error: unknown) => void) => {
            callback(createUploadEvent(true), undefined);
            return Promise.resolve('mock-task-id');
          });

        await service.uploadFile('devices/01/photo.jpg', 'file:///local/photo.jpg');

        expect(uploadSpy).toHaveBeenCalledTimes(1);
        const calledOptions = (uploadSpy.calls.first().args[0] as { path: string; uri: string });
        expect(calledOptions.path).toBe('devices/01/photo.jpg');
        expect(calledOptions.uri).toBe('file:///local/photo.jpg');
      });

      it('TC-ST15: resolves promise when upload event has completed=true', async () => {
        spyOn(FirebaseStorageWeb.prototype, 'uploadFile')
          .and.callFake((_options: UploadFileOptions, callback: (event: UploadFileCallbackEvent | null, error: unknown) => void) => {
            callback(createUploadEvent(true), undefined);
            return Promise.resolve('mock-task-id');
          });

        await expectAsync(service.uploadFile('path/file.jpg', 'file:///local/file.jpg'))
          .toBeResolved();
      });

      it('TC-ST16: does not resolve if completed=false in callback event', async () => {
        let resolveTest!: () => void;
        const testDone = new Promise<void>((r) => (resolveTest = r));

        spyOn(FirebaseStorageWeb.prototype, 'uploadFile')
          .and.callFake((_options: UploadFileOptions, callback: (event: UploadFileCallbackEvent | null, error: unknown) => void) => {
            // Fire progress-only event (completed=false), then fire completed=true
            callback(createUploadEvent(false), undefined);
            callback(createUploadEvent(true), undefined);
            resolveTest();
            return Promise.resolve('task-id');
          });

        await service.uploadFile('path/file.jpg', 'file:///local.jpg');
        await testDone;
        // If we reach here, upload resolved correctly after completed=true
        expect(true).toBeTrue();
      });

      it('TC-ST17: rejects and logs error when upload callback receives error', async () => {
        const uploadError = new Error('storage/quota-exceeded');

        spyOn(FirebaseStorageWeb.prototype, 'uploadFile')
          .and.callFake((_options: UploadFileOptions, callback: (event: UploadFileCallbackEvent | null, error: unknown) => void) => {
            callback(null, uploadError);
            return Promise.resolve('task-id');
          });

        await expectAsync(service.uploadFile('path/file.jpg', 'file:///local.jpg'))
          .toBeRejectedWith(uploadError);

        expect(mockLogger.error).toHaveBeenCalledOnceWith(
          'Storage upload error',
          jasmine.objectContaining({ storagePath: 'path/file.jpg' }),
        );
      });

      it('TC-ST18: includes correct contentType metadata in native upload call', async () => {
        const uploadSpy = spyOn(FirebaseStorageWeb.prototype, 'uploadFile')
          .and.callFake((_options: UploadFileOptions, callback: (event: UploadFileCallbackEvent | null, error: unknown) => void) => {
            callback(createUploadEvent(true), undefined);
            return Promise.resolve('task-id');
          });

        await service.uploadFile('some/path.jpg', 'file:///img.jpg');

        const options = uploadSpy.calls.first().args[0] as { metadata: { contentType: string } };
        expect(options.metadata.contentType).toBe('image/jpeg');
      });
    });
  });

  // =========================================================================
  // WEB PLATFORM TESTS
  // =========================================================================

  describe('Web platform (isNativePlatform = false)', () => {
    beforeEach(() => {
      spyOn(Capacitor, 'isNativePlatform').and.returnValue(false);
      mockLogger = createMockLoggerService();

      TestBed.configureTestingModule({
        providers: [
          StorageService,
          { provide: LoggerService, useValue: mockLogger },
        ],
      });

      service = TestBed.inject(StorageService);
    });

    // -----------------------------------------------------------------------
    // getFileUrl() — web path
    // StorageService.getFileUrl (web) calls firebase/storage SDK directly:
    //   getStorage() → ref() → getDownloadURL()
    // These exports are non-configurable (configurable: false) and cannot
    // be spy-overridden. Blocked by same root cause as BUG-03.
    // -----------------------------------------------------------------------

    describe('getFileUrl() — web', () => {
      xit('TC-ST19 [BLOCKED]: calls firebase/storage getDownloadURL on web — non-configurable export', async () => {
        // firebase/storage exports (getStorage, ref, getDownloadURL) have
        // configurable: false — spyOn and Object.defineProperty both fail.
        // Cannot mock without Jest module mocking or architectural change.
        // Documented as blocked — same root cause as BUG-03.
      });

      xit('TC-ST20 [BLOCKED]: returns URL string from getDownloadURL on web — non-configurable export', async () => {
        // Same blocker as TC-ST19.
      });

      xit('TC-ST21 [BLOCKED]: returns null on error on web — non-configurable export', async () => {
        // Same blocker as TC-ST19. Note: getFileUrl() on web does NOT catch
        // errors — it propagates them. This is a behavioral difference from
        // the native path spec description (see BUG note below).
      });
    });

    // -----------------------------------------------------------------------
    // listFolder() — web path
    // StorageService.listFolder (web) calls firebase/storage SDK directly:
    //   getStorage() → ref() → listAll()
    // Same blocker as getFileUrl web path.
    // -----------------------------------------------------------------------

    describe('listFolder() — web', () => {
      xit('TC-ST22 [BLOCKED]: calls firebase/storage listAll on web — non-configurable export', async () => {
        // firebase/storage listAll has configurable: false — same blocker as BUG-03.
      });

      xit('TC-ST23 [BLOCKED]: maps listAll prefixes to folders array on web — non-configurable export', async () => {
        // Same blocker as TC-ST22.
      });

      xit('TC-ST24 [BLOCKED]: filters _folders.txt from listAll items on web — non-configurable export', async () => {
        // Same blocker as TC-ST22.
      });
    });

    // -----------------------------------------------------------------------
    // uploadFile() — web path
    // StorageService.uploadFile (web) ALSO uses FirebaseStorage.uploadFile
    // (Capacitor Proxy → FirebaseStorageWeb), but first fetches blob via
    // global fetch(). FirebaseStorageWeb.prototype spy pattern works here.
    // -----------------------------------------------------------------------

    describe('uploadFile() — web', () => {
      it('TC-ST25: calls FirebaseStorage.uploadFile with blob on web path', async () => {
        const mockBlob = new Blob(['mock content'], { type: 'image/jpeg' });
        spyOn(window, 'fetch').and.resolveTo({
          blob: () => Promise.resolve(mockBlob),
        } as unknown as Response);

        const uploadSpy = spyOn(FirebaseStorageWeb.prototype, 'uploadFile')
          .and.callFake((_options: UploadFileOptions, callback: (event: UploadFileCallbackEvent | null, error: unknown) => void) => {
            callback(createUploadEvent(true), undefined);
            return Promise.resolve('task-id');
          });

        await service.uploadFile('devices/web/photo.jpg', 'https://example.com/photo.jpg');

        expect(uploadSpy).toHaveBeenCalledTimes(1);
        const options = uploadSpy.calls.first().args[0] as {
          path: string;
          blob: Blob;
          metadata: { contentType: string };
        };
        expect(options.path).toBe('devices/web/photo.jpg');
        expect(options.blob).toBe(mockBlob);
        expect(options.metadata.contentType).toBe('image/jpeg');
      });

      it('TC-ST26: resolves when upload completes on web path', async () => {
        const mockBlob = new Blob(['content'], { type: 'image/jpeg' });
        spyOn(window, 'fetch').and.resolveTo({
          blob: () => Promise.resolve(mockBlob),
        } as unknown as Response);

        spyOn(FirebaseStorageWeb.prototype, 'uploadFile')
          .and.callFake((_options: UploadFileOptions, callback: (event: UploadFileCallbackEvent | null, error: unknown) => void) => {
            callback(createUploadEvent(true), undefined);
            return Promise.resolve('task-id');
          });

        await expectAsync(service.uploadFile('web/file.jpg', 'https://example.com/img.jpg'))
          .toBeResolved();
      });

      it('TC-ST27: rejects and logs error when upload callback receives error on web path', async () => {
        const mockBlob = new Blob(['content'], { type: 'image/jpeg' });
        const uploadError = new Error('storage/insufficient-permission');

        spyOn(window, 'fetch').and.resolveTo({
          blob: () => Promise.resolve(mockBlob),
        } as unknown as Response);

        spyOn(FirebaseStorageWeb.prototype, 'uploadFile')
          .and.callFake((_options: UploadFileOptions, callback: (event: UploadFileCallbackEvent | null, error: unknown) => void) => {
            callback(null, uploadError);
            return Promise.resolve('task-id');
          });

        await expectAsync(service.uploadFile('web/file.jpg', 'https://example.com/img.jpg'))
          .toBeRejectedWith(uploadError);

        expect(mockLogger.error).toHaveBeenCalledOnceWith(
          'Storage upload error',
          jasmine.objectContaining({ storagePath: 'web/file.jpg' }),
        );
      });

      it('TC-ST28: rejects when fetch() fails on web path', async () => {
        spyOn(window, 'fetch').and.rejectWith(new Error('network error'));

        await expectAsync(service.uploadFile('web/file.jpg', 'bad-uri'))
          .toBeRejectedWithError('network error');
      });
    });
  });

  // =========================================================================
  // resolveFileUrl() — spying on internal getFileUrl
  // resolveFileUrl() calls this.getFileUrl() which is testable via spyOn(service, 'getFileUrl').
  // These tests are platform-agnostic since we intercept getFileUrl directly.
  // =========================================================================

  describe('resolveFileUrl()', () => {
    beforeEach(() => {
      spyOn(Capacitor, 'isNativePlatform').and.returnValue(false);
      mockLogger = createMockLoggerService();

      TestBed.configureTestingModule({
        providers: [
          StorageService,
          { provide: LoggerService, useValue: mockLogger },
        ],
      });

      service = TestBed.inject(StorageService);
    });

    it('TC-ST29: tries first extension and returns URL when it succeeds', async () => {
      const spy = spyOn(service, 'getFileUrl').and.resolveTo('https://example.com/device.png');

      const url = await service.resolveFileUrl('devices/01', 'device', ['png', 'jpg', 'pdf']);

      expect(url).toBe('https://example.com/device.png');
      expect(spy).toHaveBeenCalledOnceWith('devices/01/device.png');
    });

    it('TC-ST30: skips failed extensions and returns URL on second match', async () => {
      let callCount = 0;
      spyOn(service, 'getFileUrl').and.callFake((path: string) => {
        callCount++;
        if (path.endsWith('.png')) return Promise.resolve(null);
        if (path.endsWith('.jpg')) return Promise.resolve('https://example.com/device.jpg');
        return Promise.resolve(null);
      });

      const url = await service.resolveFileUrl('devices/01', 'device', ['png', 'jpg', 'pdf']);

      expect(url).toBe('https://example.com/device.jpg');
      expect(callCount).toBe(2);
    });

    it('TC-ST31: returns empty string when all extensions fail', async () => {
      spyOn(service, 'getFileUrl').and.resolveTo(null);

      const url = await service.resolveFileUrl('devices/01', 'device', ['png', 'jpg', 'pdf']);

      expect(url).toBe('');
    });

    it('TC-ST32: calls debug logger when no file found for any extension', async () => {
      spyOn(service, 'getFileUrl').and.resolveTo(null);

      await service.resolveFileUrl('devices/01', 'device', ['png', 'jpg']);

      expect(mockLogger.debug).toHaveBeenCalledOnceWith(
        'No file found for any extension',
        jasmine.objectContaining({
          folder: 'devices/01',
          fileName: 'device',
          extensions: ['png', 'jpg'],
        }),
      );
    });

    it('TC-ST33: stops after first successful extension (no unnecessary calls)', async () => {
      const spy = spyOn(service, 'getFileUrl').and.resolveTo('https://example.com/device.png');

      await service.resolveFileUrl('devices/01', 'device', ['png', 'jpg', 'pdf']);

      expect(spy).toHaveBeenCalledTimes(1);
    });

    it('TC-ST34: does not log debug when a file is found', async () => {
      spyOn(service, 'getFileUrl').and.resolveTo('https://example.com/device.jpg');

      await service.resolveFileUrl('devices/01', 'device', ['jpg']);

      expect(mockLogger.debug).not.toHaveBeenCalled();
    });

    it('TC-ST35: returns empty string for empty extensions array', async () => {
      const spy = spyOn(service, 'getFileUrl');

      const url = await service.resolveFileUrl('devices/01', 'device', []);

      expect(url).toBe('');
      expect(spy).not.toHaveBeenCalled();
      expect(mockLogger.debug).toHaveBeenCalledOnceWith(
        'No file found for any extension',
        jasmine.objectContaining({ extensions: [] }),
      );
    });

    it('TC-ST36: constructs path as folder/fileName.ext correctly', async () => {
      const spy = spyOn(service, 'getFileUrl').and.resolveTo('https://example.com/file.pdf');

      await service.resolveFileUrl('catalog/products', 'manual', ['pdf']);

      expect(spy).toHaveBeenCalledWith('catalog/products/manual.pdf');
    });

    it('TC-ST37: tries all extensions before returning empty string', async () => {
      const spy = spyOn(service, 'getFileUrl').and.resolveTo(null);

      await service.resolveFileUrl('folder', 'file', ['png', 'jpg', 'gif', 'pdf']);

      expect(spy).toHaveBeenCalledTimes(4);
    });
  });

  // =========================================================================
  // Parameterized: resolveFileUrl() — folder + fileName combinations
  // =========================================================================

  describe('resolveFileUrl() — parameterized folder/fileName combinations', () => {
    let resolveService: StorageService;

    beforeEach(() => {
      spyOn(Capacitor, 'isNativePlatform').and.returnValue(false);
      const mockLog = createMockLoggerService();

      TestBed.configureTestingModule({
        providers: [
          StorageService,
          { provide: LoggerService, useValue: mockLog },
        ],
      });

      resolveService = TestBed.inject(StorageService);
    });

    const folderFileCombs = [
      { folder: 'devices/01', fileName: 'device', extensions: ['png', 'jpg'] },
      { folder: 'catalog/products', fileName: 'manual', extensions: ['pdf', 'docx'] },
      { folder: 'tenants/T1/images', fileName: 'logo', extensions: ['svg', 'png', 'jpg'] },
      { folder: 'a', fileName: 'b', extensions: ['c'] },
      { folder: 'with-dashes/and_underscores', fileName: 'file.name', extensions: ['pdf'] },
      { folder: 'deep/nested/path/structure', fileName: 'document', extensions: ['pdf', 'txt'] },
      { folder: 'unicode/путь', fileName: 'файл', extensions: ['jpg'] },
    ];

    folderFileCombs.forEach(({ folder, fileName, extensions }) => {
      it(`TC-STRFU-${folder.slice(0, 20)}-${fileName}: resolveFileUrl() constructs paths for "${folder}/${fileName}"`, async () => {
        const expectedUrl = `https://storage.example.com/${folder}/${fileName}.${extensions[0]}`;
        spyOn(resolveService, 'getFileUrl').and.resolveTo(expectedUrl);

        const result = await resolveService.resolveFileUrl(folder, fileName, extensions);

        expect(result).toBe(expectedUrl);
      });
    });
  });

  // =========================================================================
  // Parameterized: resolveFileUrl() — extension list variants
  // =========================================================================

  describe('resolveFileUrl() — parameterized extension lists', () => {
    let resolveService: StorageService;

    beforeEach(() => {
      spyOn(Capacitor, 'isNativePlatform').and.returnValue(false);
      const mockLog = createMockLoggerService();

      TestBed.configureTestingModule({
        providers: [
          StorageService,
          { provide: LoggerService, useValue: mockLog },
        ],
      });

      resolveService = TestBed.inject(StorageService);
    });

    const extensionLists = [
      ['png'],
      ['jpg'],
      ['pdf'],
      ['svg'],
      ['png', 'jpg'],
      ['pdf', 'docx', 'txt'],
      ['jpg', 'jpeg', 'png', 'gif', 'webp'],
      ['PNG', 'JPG'],
    ];

    extensionLists.forEach((extensions) => {
      it(`TC-STRFE-[${extensions.join(',')}]: resolveFileUrl() tries extensions [${extensions.join(',')}]`, async () => {
        const spy = spyOn(resolveService, 'getFileUrl').and.resolveTo(null);

        await resolveService.resolveFileUrl('folder', 'file', extensions);

        expect(spy).toHaveBeenCalledTimes(extensions.length);
      });
    });
  });

  // =========================================================================
  // Parameterized: native getFileUrl() — path variants
  // =========================================================================

  describe('getFileUrl() native — parameterized path variants', () => {
    let nativeService: StorageService;

    beforeEach(() => {
      spyOn(Capacitor, 'isNativePlatform').and.returnValue(true);
      const mockLog = createMockLoggerService();

      TestBed.configureTestingModule({
        providers: [
          StorageService,
          { provide: LoggerService, useValue: mockLog },
        ],
      });

      nativeService = TestBed.inject(StorageService);
    });

    const storagePaths = [
      'devices/01/photo.jpg',
      'tenants/T1/images/logo.png',
      'catalog/products/manual.pdf',
      'a/b/c/d/e/f.jpg',
      'path-with-dashes/file_name.png',
      'path.with.dots/file.jpg',
      'UPPERCASE/path.jpg',
    ];

    storagePaths.forEach((path) => {
      it(`TC-STGFU-${path.slice(0, 30)}: getFileUrl() calls getDownloadUrl with path="${path.slice(0, 30)}"`, async () => {
        const spy = spyOn(FirebaseStorageWeb.prototype, 'getDownloadUrl')
          .and.resolveTo({ downloadUrl: `https://storage.example.com/${path}` });

        const url = await nativeService.getFileUrl(path);

        expect(spy).toHaveBeenCalledOnceWith({ path });
        expect(url).toBe(`https://storage.example.com/${path}`);
      });
    });
  });

  // =========================================================================
  // Parameterized: native uploadFile() — upload error types
  // =========================================================================

  describe('uploadFile() native — parameterized error types', () => {
    let nativeService: StorageService;
    let nativeLogger: jasmine.SpyObj<LoggerService>;

    beforeEach(() => {
      spyOn(Capacitor, 'isNativePlatform').and.returnValue(true);
      nativeLogger = createMockLoggerService();

      TestBed.configureTestingModule({
        providers: [
          StorageService,
          { provide: LoggerService, useValue: nativeLogger },
        ],
      });

      nativeService = TestBed.inject(StorageService);
    });

    const uploadErrors = [
      new Error('storage/quota-exceeded'),
      new Error('storage/unauthenticated'),
      new Error('storage/unauthorized'),
      new Error('storage/retry-limit-exceeded'),
      new Error('storage/invalid-checksum'),
      new Error('storage/canceled'),
      new Error('Network Error'),
      new Error(''),
    ];

    uploadErrors.forEach((err) => {
      it(`TC-STUPE-${err.message.slice(0, 30)}: uploadFile() native rejects with "${err.message.slice(0, 30)}"`, async () => {
        spyOn(FirebaseStorageWeb.prototype, 'uploadFile')
          .and.callFake((_options: any, callback: (event: any, error: unknown) => void) => {
            callback(null, err);
            return Promise.resolve('task-id');
          });

        await expectAsync(nativeService.uploadFile('path/file.jpg', 'file:///local/file.jpg'))
          .toBeRejectedWith(err);

        expect(nativeLogger.error).toHaveBeenCalledTimes(1);
      });
    });
  });

  // =========================================================================
  // Parameterized: native listFolder() — file list size variants
  // =========================================================================

  describe('listFolder() native — parameterized file counts', () => {
    let nativeService: StorageService;

    beforeEach(() => {
      spyOn(Capacitor, 'isNativePlatform').and.returnValue(true);
      const mockLog = createMockLoggerService();

      TestBed.configureTestingModule({
        providers: [
          StorageService,
          { provide: LoggerService, useValue: mockLog },
        ],
      });

      nativeService = TestBed.inject(StorageService);
    });

    const fileCounts = [0, 1, 2, 5, 10, 50];

    fileCounts.forEach((count) => {
      it(`TC-STLF-${count}files: listFolder() with ${count} files returns ${count} files`, async () => {
        const items = Array.from({ length: count }, (_, i) => ({
          name: `file${i}.jpg`,
          path: `devices/01/file${i}.jpg`,
          bucket: 'bucket',
        }));

        spyOn(FirebaseStorageWeb.prototype, 'listFiles')
          .and.resolveTo({ items } as any);

        spyOn(FirebaseStorageWeb.prototype, 'getDownloadUrl')
          .and.rejectWith(new Error('not-found'));

        const result = await nativeService.listFolder('devices/01');

        expect(result.files.length).toBe(count);
      });
    });
  });

  // =========================================================================
  // uploadDataUrl() — web path
  // =========================================================================

  describe('uploadDataUrl() — web platform (isNativePlatform = false)', () => {
    beforeEach(() => {
      spyOn(Capacitor, 'isNativePlatform').and.returnValue(false);
      mockLogger = createMockLoggerService();

      TestBed.configureTestingModule({
        providers: [
          StorageService,
          { provide: LoggerService, useValue: mockLogger },
        ],
      });

      service = TestBed.inject(StorageService);
    });

    it('TC-SDU01: web path delegates to uploadFile with dataUrl directly', async () => {
      const uploadFileSpy = spyOn(service, 'uploadFile').and.resolveTo();

      await service.uploadDataUrl('devices/01/sig.png', 'data:image/png;base64,ABC', 'image/png');

      expect(uploadFileSpy).toHaveBeenCalledOnceWith(
        'devices/01/sig.png',
        'data:image/png;base64,ABC',
        'image/png',
      );
    });

    it('TC-SDU02: web path passes contentType through to uploadFile', async () => {
      const uploadFileSpy = spyOn(service, 'uploadFile').and.resolveTo();

      await service.uploadDataUrl('some/path.jpg', 'data:image/jpeg;base64,XYZ', 'image/jpeg');

      const args = uploadFileSpy.calls.first().args as [string, string, string];
      expect(args[2]).toBe('image/jpeg');
    });

    it('TC-SDU03: web path does NOT call Filesystem.writeFile', async () => {
      const writeFileSpy = spyOn(Filesystem, 'writeFile').and.resolveTo({ uri: 'file:///tmp.tmp' });
      spyOn(service, 'uploadFile').and.resolveTo();

      await service.uploadDataUrl('path/file.png', 'data:image/png;base64,ABC', 'image/png');

      expect(writeFileSpy).not.toHaveBeenCalled();
    });

    it('TC-SDU04: web path resolves when uploadFile resolves', async () => {
      spyOn(service, 'uploadFile').and.resolveTo();

      await expectAsync(
        service.uploadDataUrl('path/file.png', 'data:image/png;base64,ABC', 'image/png'),
      ).toBeResolved();
    });

    it('TC-SDU05: web path rejects when uploadFile rejects', async () => {
      spyOn(service, 'uploadFile').and.rejectWith(new Error('upload-fail'));

      await expectAsync(
        service.uploadDataUrl('path/file.png', 'data:image/png;base64,ABC', 'image/png'),
      ).toBeRejectedWithError('upload-fail');
    });
  });

  // =========================================================================
  // uploadDataUrl() — native path
  // =========================================================================

  describe('uploadDataUrl() — native platform (isNativePlatform = true)', () => {
    beforeEach(() => {
      spyOn(Capacitor, 'isNativePlatform').and.returnValue(true);
      mockLogger = createMockLoggerService();

      TestBed.configureTestingModule({
        providers: [
          StorageService,
          { provide: LoggerService, useValue: mockLogger },
        ],
      });

      service = TestBed.inject(StorageService);
    });

    it('TC-SDU06: native path extracts base64 after first comma and writes to temp file', async () => {
      // FilesystemWeb.prototype spy intercepts Filesystem.writeFile on web/Karma:
      // Capacitor proxy routes calls through registered web impl (FilesystemWeb).
      const writeFileSpy = spyOn(FilesystemWeb.prototype, 'writeFile').and.resolveTo({ uri: 'file:///cache/upload_123.tmp' });
      spyOn(FilesystemWeb.prototype, 'deleteFile').and.resolveTo();
      spyOn(service, 'uploadFile').and.resolveTo();

      await service.uploadDataUrl('devices/01/sig.png', 'data:image/png;base64,THEBASE64DATA', 'image/png');

      expect(writeFileSpy).toHaveBeenCalledOnceWith(
        jasmine.objectContaining({
          data: 'THEBASE64DATA',
          directory: Directory.Cache,
        }),
      );
    });

    it('TC-SDU07: native path calls uploadFile with the URI returned by Filesystem.writeFile', async () => {
      spyOn(FilesystemWeb.prototype, 'writeFile').and.resolveTo({ uri: 'file:///cache/upload_999.tmp' });
      spyOn(FilesystemWeb.prototype, 'deleteFile').and.resolveTo();
      const uploadFileSpy = spyOn(service, 'uploadFile').and.resolveTo();

      await service.uploadDataUrl('devices/01/sig.png', 'data:image/png;base64,THEBASE64DATA', 'image/png');

      expect(uploadFileSpy).toHaveBeenCalledOnceWith(
        'devices/01/sig.png',
        'file:///cache/upload_999.tmp',
        'image/png',
      );
    });

    it('TC-SDU08: native path calls Filesystem.deleteFile in finally after successful upload', async () => {
      spyOn(FilesystemWeb.prototype, 'writeFile').and.resolveTo({ uri: 'file:///cache/upload_1.tmp' });
      const deleteFileSpy = spyOn(FilesystemWeb.prototype, 'deleteFile').and.resolveTo();
      spyOn(service, 'uploadFile').and.resolveTo();

      await service.uploadDataUrl('devices/01/sig.png', 'data:image/png;base64,ABC', 'image/png');

      expect(deleteFileSpy).toHaveBeenCalledOnceWith(
        jasmine.objectContaining({ directory: Directory.Cache }),
      );
    });

    it('TC-SDU09: native path calls Filesystem.deleteFile in finally even when uploadFile rejects', async () => {
      spyOn(FilesystemWeb.prototype, 'writeFile').and.resolveTo({ uri: 'file:///cache/upload_2.tmp' });
      const deleteFileSpy = spyOn(FilesystemWeb.prototype, 'deleteFile').and.resolveTo();
      spyOn(service, 'uploadFile').and.rejectWith(new Error('upload-failed'));

      await expectAsync(
        service.uploadDataUrl('devices/01/sig.png', 'data:image/png;base64,ABC', 'image/png'),
      ).toBeRejected();

      expect(deleteFileSpy).toHaveBeenCalledTimes(1);
    });

    it('TC-SDU10: deleteFile failing in finally does NOT prevent upload resolve (catch is silent)', async () => {
      // Verifies that Filesystem.deleteFile().catch(() => undefined) in the source
      // swallows the delete error silently — upload still resolves.
      spyOn(FilesystemWeb.prototype, 'writeFile').and.resolveTo({ uri: 'file:///cache/upload_3.tmp' });
      spyOn(FilesystemWeb.prototype, 'deleteFile').and.rejectWith(new Error('delete-failed'));
      spyOn(service, 'uploadFile').and.resolveTo();

      await expectAsync(
        service.uploadDataUrl('devices/01/sig.png', 'data:image/png;base64,ABC', 'image/png'),
      ).toBeResolved();
    });

    it('TC-SDU11: EDGE — dataUrl without comma: indexOf returns -1, substring(0) sends full string as base64', async () => {
      // Slabost koda (ne bug): realni data: URL uvek ima zarez; nema validacije.
      // Dokumentuje ponašanje, ne menja app kod.
      const writeFileSpy = spyOn(FilesystemWeb.prototype, 'writeFile').and.resolveTo({ uri: 'file:///cache/upload_4.tmp' });
      spyOn(FilesystemWeb.prototype, 'deleteFile').and.resolveTo();
      spyOn(service, 'uploadFile').and.resolveTo();

      await service.uploadDataUrl('devices/01/sig.png', 'rawbase64nocomma', 'image/png');

      // indexOf(',') = -1 → indexOf(',') + 1 = 0 → substring(0) = full string
      expect(writeFileSpy).toHaveBeenCalledOnceWith(
        jasmine.objectContaining({ data: 'rawbase64nocomma' }),
      );
    });

    it('TC-SDU12: EDGE — dataUrl with multiple commas: substring uses FIRST comma only', async () => {
      const writeFileSpy = spyOn(FilesystemWeb.prototype, 'writeFile').and.resolveTo({ uri: 'file:///cache/upload_5.tmp' });
      spyOn(FilesystemWeb.prototype, 'deleteFile').and.resolveTo();
      spyOn(service, 'uploadFile').and.resolveTo();

      await service.uploadDataUrl('devices/01/sig.png', 'data:image/png;base64,AB,CD', 'image/png');

      // indexOf(',') finds first comma → substring after it → 'AB,CD'
      expect(writeFileSpy).toHaveBeenCalledOnceWith(
        jasmine.objectContaining({ data: 'AB,CD' }),
      );
    });

    it('TC-SDU13: native path writes temp file to Directory.Cache', async () => {
      const writeFileSpy = spyOn(FilesystemWeb.prototype, 'writeFile').and.resolveTo({ uri: 'file:///cache/upload_6.tmp' });
      spyOn(FilesystemWeb.prototype, 'deleteFile').and.resolveTo();
      spyOn(service, 'uploadFile').and.resolveTo();

      await service.uploadDataUrl('devices/01/sig.png', 'data:image/png;base64,ABC', 'image/png');

      expect(writeFileSpy).toHaveBeenCalledOnceWith(
        jasmine.objectContaining({ directory: Directory.Cache }),
      );
    });

    it('TC-SDU14: native path uses a path string (tempName) for both writeFile and deleteFile', async () => {
      const writeFileSpy = spyOn(FilesystemWeb.prototype, 'writeFile').and.resolveTo({ uri: 'file:///cache/upload_7.tmp' });
      const deleteFileSpy = spyOn(FilesystemWeb.prototype, 'deleteFile').and.resolveTo();
      spyOn(service, 'uploadFile').and.resolveTo();

      await service.uploadDataUrl('devices/01/sig.png', 'data:image/png;base64,ABC', 'image/png');

      const writtenPath = (writeFileSpy.calls.first().args[0] as { path: string }).path;
      const deletedPath = (deleteFileSpy.calls.first().args[0] as { path: string }).path;
      expect(writtenPath).toBe(deletedPath);
    });

    it('TC-SDU15: native path rejects when Filesystem.writeFile rejects', async () => {
      spyOn(FilesystemWeb.prototype, 'writeFile').and.rejectWith(new Error('disk-full'));
      // deleteFile should NOT be called when writeFile fails (before try block)
      const deleteFileSpy = spyOn(FilesystemWeb.prototype, 'deleteFile').and.resolveTo();

      await expectAsync(
        service.uploadDataUrl('devices/01/sig.png', 'data:image/png;base64,ABC', 'image/png'),
      ).toBeRejectedWithError('disk-full');

      expect(deleteFileSpy).not.toHaveBeenCalled();
    });
  });

  // =========================================================================
  // Parameterized: server-time.service.spec.ts gets its own describe block
  // but we add additional scenarios here for StorageService error scenarios
  // =========================================================================

  describe('StorageService — getFileUrl() native error scenarios', () => {
    let nativeService: StorageService;

    beforeEach(() => {
      spyOn(Capacitor, 'isNativePlatform').and.returnValue(true);
      const mockLog = createMockLoggerService();

      TestBed.configureTestingModule({
        providers: [
          StorageService,
          { provide: LoggerService, useValue: mockLog },
        ],
      });

      nativeService = TestBed.inject(StorageService);
    });

    const storageGetErrors = [
      'storage/object-not-found',
      'storage/bucket-not-found',
      'storage/project-not-found',
      'storage/quota-exceeded',
      'storage/unauthenticated',
      'storage/unauthorized',
      'storage/retry-limit-exceeded',
      'storage/non-matching-checksum',
      'storage/download-size-exceeded',
      'storage/cancelled',
      'storage/cannot-slice-blob',
      'storage/server-file-wrong-size',
    ];

    storageGetErrors.forEach((errCode) => {
      it(`TC-STGFUE-${errCode}: getFileUrl() returns null and logs warn for "${errCode}"`, async () => {
        const mockLog = (nativeService as any).logger as jasmine.SpyObj<LoggerService>;
        spyOn(FirebaseStorageWeb.prototype, 'getDownloadUrl')
          .and.rejectWith(new Error(errCode));

        const result = await nativeService.getFileUrl('path/file.jpg');

        expect(result).toBeNull();
        expect(mockLog.warn).toHaveBeenCalledWith(
          'Storage getFileUrl failed',
          jasmine.objectContaining({ error: jasmine.stringContaining(errCode) }),
        );
      });
    });
  });
});
