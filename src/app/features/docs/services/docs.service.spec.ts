import { TestBed } from '@angular/core/testing';
import { DocsService } from './docs.service';
import { StorageService } from '../../../core/firebase/storage.service';
import { LoggerService } from '../../../core/logger/logger.service';

const mockStorageService = {
  listFolder: jasmine.createSpy('listFolder'),
  getFileUrl: jasmine.createSpy('getFileUrl'),
};

const mockLoggerService = {
  debug: jasmine.createSpy('debug'),
  error: jasmine.createSpy('error'),
};

describe('DocsService', () => {
  let service: DocsService;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        DocsService,
        { provide: StorageService, useValue: mockStorageService },
        { provide: LoggerService, useValue: mockLoggerService },
      ],
    });

    service = TestBed.inject(DocsService);

    mockStorageService.listFolder.calls.reset();
    mockStorageService.getFileUrl.calls.reset();
    mockLoggerService.debug.calls.reset();
    mockLoggerService.error.calls.reset();
  });

  // ==========================================
  // Inicijalno stanje
  // ==========================================

  describe('initial state', () => {
    it('should have empty entries array', () => {
      expect(service.entries).toEqual([]);
    });

    it('should have entries as Array instance', () => {
      expect(Array.isArray(service.entries)).toBeTrue();
    });

    it('should not be loading', () => {
      expect(service.isLoading).toBeFalse();
    });

    it('should be at root folder', () => {
      expect(service.isRoot).toBeTrue();
    });

    it('should have "Documents" as current path', () => {
      expect(service.currentPath).toBe('Documents');
    });

    it('should have "Documents" as current folder name', () => {
      expect(service.currentFolderName).toBe('Documents');
    });

    it('should not have called storage service', () => {
      expect(mockStorageService.listFolder).not.toHaveBeenCalled();
      expect(mockStorageService.getFileUrl).not.toHaveBeenCalled();
    });
  });

  // ==========================================
  // isRoot getter
  // ==========================================

  describe('isRoot', () => {
    it('should return true when at root path', () => {
      service.currentPath = 'Documents';
      expect(service.isRoot).toBeTrue();
    });

    it('should return false when in a subfolder', () => {
      service.currentPath = 'Documents/Uputstva';
      expect(service.isRoot).toBeFalse();
    });

    it('should return false when deeply nested', () => {
      service.currentPath = 'Documents/A/B/C';
      expect(service.isRoot).toBeFalse();
    });

    it('should return false for path with two segments', () => {
      service.currentPath = 'Documents/Katalozi';
      expect(service.isRoot).toBeFalse();
    });

    it('should return true only for exact "Documents" match', () => {
      service.currentPath = 'Documents2';
      expect(service.isRoot).toBeFalse();
    });
  });

  // ==========================================
  // currentFolderName getter
  // ==========================================

  describe('currentFolderName', () => {
    it('should return root folder name', () => {
      service.currentPath = 'Documents';
      expect(service.currentFolderName).toBe('Documents');
    });

    it('should return subfolder name', () => {
      service.currentPath = 'Documents/Uputstva';
      expect(service.currentFolderName).toBe('Uputstva');
    });

    it('should return deeply nested folder name', () => {
      service.currentPath = 'Documents/A/B/Instalacija';
      expect(service.currentFolderName).toBe('Instalacija');
    });

    it('should return last segment for any path depth', () => {
      service.currentPath = 'Documents/Level1/Level2/Level3/Target';
      expect(service.currentFolderName).toBe('Target');
    });

    it('should handle folder name with spaces', () => {
      service.currentPath = 'Documents/Moji Dokumenti';
      expect(service.currentFolderName).toBe('Moji Dokumenti');
    });

    it('should handle folder name with special characters', () => {
      service.currentPath = 'Documents/Uputstva (2024)';
      expect(service.currentFolderName).toBe('Uputstva (2024)');
    });

    it('should handle folder name with hyphens and underscores', () => {
      service.currentPath = 'Documents/servis_dokumenti-v2';
      expect(service.currentFolderName).toBe('servis_dokumenti-v2');
    });
  });

  // ==========================================
  // loadFolder — osnovno
  // ==========================================

  describe('loadFolder', () => {
    it('should call listFolder on storage service', async () => {
      mockStorageService.listFolder.and.returnValue(Promise.resolve({ folders: [], files: [] }));

      await service.loadFolder();

      expect(mockStorageService.listFolder).toHaveBeenCalledTimes(1);
    });

    it('should call listFolder with root path when no argument', async () => {
      mockStorageService.listFolder.and.returnValue(Promise.resolve({ folders: [], files: [] }));

      await service.loadFolder();

      expect(mockStorageService.listFolder).toHaveBeenCalledWith('Documents');
    });

    it('should call listFolder with given subfolder path', async () => {
      mockStorageService.listFolder.and.returnValue(Promise.resolve({ folders: [], files: [] }));

      await service.loadFolder('Documents/Uputstva');

      expect(mockStorageService.listFolder).toHaveBeenCalledWith('Documents/Uputstva');
    });

    it('should call listFolder with deeply nested path', async () => {
      mockStorageService.listFolder.and.returnValue(Promise.resolve({ folders: [], files: [] }));

      await service.loadFolder('Documents/A/B/C');

      expect(mockStorageService.listFolder).toHaveBeenCalledWith('Documents/A/B/C');
    });

    it('should default to root when undefined is passed', async () => {
      mockStorageService.listFolder.and.returnValue(Promise.resolve({ folders: [], files: [] }));

      await service.loadFolder(undefined);

      expect(service.currentPath).toBe('Documents');
    });
  });

  // ==========================================
  // loadFolder — mapiranje foldera
  // ==========================================

  describe('loadFolder folder mapping', () => {
    it('should map single folder correctly', async () => {
      mockStorageService.listFolder.and.returnValue(Promise.resolve({
        folders: ['Uputstva'],
        files: [],
      }));

      await service.loadFolder();

      expect(service.entries[0]).toEqual({
        name: 'Uputstva',
        fullPath: 'Documents/Uputstva',
        isFolder: true,
      });
    });

    it('should map multiple folders', async () => {
      mockStorageService.listFolder.and.returnValue(Promise.resolve({
        folders: ['Uputstva', 'Katalozi', 'Garancije'],
        files: [],
      }));

      await service.loadFolder();

      expect(service.entries.length).toBe(3);
      expect(service.entries.every(e => e.isFolder)).toBeTrue();
    });

    it('should set isFolder to true for all folders', async () => {
      mockStorageService.listFolder.and.returnValue(Promise.resolve({
        folders: ['A', 'B', 'C', 'D'],
        files: [],
      }));

      await service.loadFolder();

      service.entries.forEach(entry => {
        expect(entry.isFolder).toBeTrue();
      });
    });

    it('should construct fullPath by combining currentPath and folder name', async () => {
      mockStorageService.listFolder.and.returnValue(Promise.resolve({
        folders: ['SubFolder'],
        files: [],
      }));

      await service.loadFolder('Documents/Parent');

      expect(service.entries[0].fullPath).toBe('Documents/Parent/SubFolder');
    });

    it('should construct fullPath for root-level folders', async () => {
      mockStorageService.listFolder.and.returnValue(Promise.resolve({
        folders: ['Uputstva'],
        files: [],
      }));

      await service.loadFolder();

      expect(service.entries[0].fullPath).toBe('Documents/Uputstva');
    });

    it('should preserve folder name with spaces in fullPath', async () => {
      mockStorageService.listFolder.and.returnValue(Promise.resolve({
        folders: ['Moji Dokumenti'],
        files: [],
      }));

      await service.loadFolder();

      expect(service.entries[0].name).toBe('Moji Dokumenti');
      expect(service.entries[0].fullPath).toBe('Documents/Moji Dokumenti');
    });

    it('should preserve folder name with special characters', async () => {
      mockStorageService.listFolder.and.returnValue(Promise.resolve({
        folders: ['Katalozi (2024)'],
        files: [],
      }));

      await service.loadFolder();

      expect(service.entries[0].name).toBe('Katalozi (2024)');
    });

    it('should use folder name as entry name', async () => {
      mockStorageService.listFolder.and.returnValue(Promise.resolve({
        folders: ['TestFolder'],
        files: [],
      }));

      await service.loadFolder();

      expect(service.entries[0].name).toBe('TestFolder');
    });
  });

  // ==========================================
  // loadFolder — mapiranje fajlova
  // ==========================================

  describe('loadFolder file mapping', () => {
    it('should map single file correctly', async () => {
      mockStorageService.listFolder.and.returnValue(Promise.resolve({
        folders: [],
        files: [{ name: 'test.pdf', fullPath: 'Documents/test.pdf' }],
      }));

      await service.loadFolder();

      expect(service.entries[0]).toEqual({
        name: 'test.pdf',
        fullPath: 'Documents/test.pdf',
        isFolder: false,
      });
    });

    it('should map multiple files', async () => {
      mockStorageService.listFolder.and.returnValue(Promise.resolve({
        folders: [],
        files: [
          { name: 'a.pdf', fullPath: 'Documents/a.pdf' },
          { name: 'b.docx', fullPath: 'Documents/b.docx' },
          { name: 'c.jpg', fullPath: 'Documents/c.jpg' },
        ],
      }));

      await service.loadFolder();

      expect(service.entries.length).toBe(3);
      expect(service.entries.every(e => !e.isFolder)).toBeTrue();
    });

    it('should set isFolder to false for all files', async () => {
      mockStorageService.listFolder.and.returnValue(Promise.resolve({
        folders: [],
        files: [
          { name: 'a.pdf', fullPath: 'Documents/a.pdf' },
          { name: 'b.pdf', fullPath: 'Documents/b.pdf' },
        ],
      }));

      await service.loadFolder();

      service.entries.forEach(entry => {
        expect(entry.isFolder).toBeFalse();
      });
    });

    it('should use file fullPath from storage response directly', async () => {
      mockStorageService.listFolder.and.returnValue(Promise.resolve({
        folders: [],
        files: [{ name: 'manual.pdf', fullPath: 'Documents/Uputstva/manual.pdf' }],
      }));

      await service.loadFolder('Documents/Uputstva');

      expect(service.entries[0].fullPath).toBe('Documents/Uputstva/manual.pdf');
    });

    it('should handle PDF files', async () => {
      mockStorageService.listFolder.and.returnValue(Promise.resolve({
        folders: [],
        files: [{ name: 'garancija.pdf', fullPath: 'Documents/garancija.pdf' }],
      }));

      await service.loadFolder();

      expect(service.entries[0].name).toBe('garancija.pdf');
    });

    it('should handle DOCX files', async () => {
      mockStorageService.listFolder.and.returnValue(Promise.resolve({
        folders: [],
        files: [{ name: 'ugovor.docx', fullPath: 'Documents/ugovor.docx' }],
      }));

      await service.loadFolder();

      expect(service.entries[0].name).toBe('ugovor.docx');
    });

    it('should handle image files', async () => {
      mockStorageService.listFolder.and.returnValue(Promise.resolve({
        folders: [],
        files: [{ name: 'shema.jpg', fullPath: 'Documents/shema.jpg' }],
      }));

      await service.loadFolder();

      expect(service.entries[0].name).toBe('shema.jpg');
    });

    it('should handle files with multiple dots in name', async () => {
      mockStorageService.listFolder.and.returnValue(Promise.resolve({
        folders: [],
        files: [{ name: 'manual.v2.1.pdf', fullPath: 'Documents/manual.v2.1.pdf' }],
      }));

      await service.loadFolder();

      expect(service.entries[0].name).toBe('manual.v2.1.pdf');
    });

    it('should handle files with spaces in name', async () => {
      mockStorageService.listFolder.and.returnValue(Promise.resolve({
        folders: [],
        files: [{ name: 'korisničko uputstvo.pdf', fullPath: 'Documents/korisničko uputstvo.pdf' }],
      }));

      await service.loadFolder();

      expect(service.entries[0].name).toBe('korisničko uputstvo.pdf');
    });

    it('should handle files with unicode characters', async () => {
      mockStorageService.listFolder.and.returnValue(Promise.resolve({
        folders: [],
        files: [{ name: 'šema_čišćenja.pdf', fullPath: 'Documents/šema_čišćenja.pdf' }],
      }));

      await service.loadFolder();

      expect(service.entries[0].name).toBe('šema_čišćenja.pdf');
    });
  });

  // ==========================================
  // loadFolder — redosled entries
  // ==========================================

  describe('loadFolder entry ordering', () => {
    it('should place folders before files', async () => {
      mockStorageService.listFolder.and.returnValue(Promise.resolve({
        folders: ['FolderA'],
        files: [{ name: 'file.pdf', fullPath: 'Documents/file.pdf' }],
      }));

      await service.loadFolder();

      expect(service.entries[0].isFolder).toBeTrue();
      expect(service.entries[1].isFolder).toBeFalse();
    });

    it('should place multiple folders before multiple files', async () => {
      mockStorageService.listFolder.and.returnValue(Promise.resolve({
        folders: ['FolderA', 'FolderB'],
        files: [
          { name: 'file1.pdf', fullPath: 'Documents/file1.pdf' },
          { name: 'file2.pdf', fullPath: 'Documents/file2.pdf' },
        ],
      }));

      await service.loadFolder();

      expect(service.entries[0].isFolder).toBeTrue();
      expect(service.entries[1].isFolder).toBeTrue();
      expect(service.entries[2].isFolder).toBeFalse();
      expect(service.entries[3].isFolder).toBeFalse();
    });

    it('should preserve folder order from storage response', async () => {
      mockStorageService.listFolder.and.returnValue(Promise.resolve({
        folders: ['Zebra', 'Alpha', 'Middle'],
        files: [],
      }));

      await service.loadFolder();

      expect(service.entries[0].name).toBe('Zebra');
      expect(service.entries[1].name).toBe('Alpha');
      expect(service.entries[2].name).toBe('Middle');
    });

    it('should preserve file order from storage response', async () => {
      mockStorageService.listFolder.and.returnValue(Promise.resolve({
        folders: [],
        files: [
          { name: 'c.pdf', fullPath: 'Documents/c.pdf' },
          { name: 'a.pdf', fullPath: 'Documents/a.pdf' },
          { name: 'b.pdf', fullPath: 'Documents/b.pdf' },
        ],
      }));

      await service.loadFolder();

      expect(service.entries[0].name).toBe('c.pdf');
      expect(service.entries[1].name).toBe('a.pdf');
      expect(service.entries[2].name).toBe('b.pdf');
    });

    it('should compute correct total count for mixed entries', async () => {
      mockStorageService.listFolder.and.returnValue(Promise.resolve({
        folders: ['Uputstva', 'Katalozi'],
        files: [{ name: 'garancija.pdf', fullPath: 'Documents/garancija.pdf' }],
      }));

      await service.loadFolder();

      expect(service.entries.length).toBe(3);
    });
  });

  // ==========================================
  // loadFolder — stanje (state management)
  // ==========================================

  describe('loadFolder state management', () => {
    it('should update currentPath when loading subfolder', async () => {
      mockStorageService.listFolder.and.returnValue(Promise.resolve({ folders: [], files: [] }));

      await service.loadFolder('Documents/Uputstva');

      expect(service.currentPath).toBe('Documents/Uputstva');
    });

    it('should update isRoot to false when loading subfolder', async () => {
      mockStorageService.listFolder.and.returnValue(Promise.resolve({ folders: [], files: [] }));

      await service.loadFolder('Documents/Uputstva');

      expect(service.isRoot).toBeFalse();
    });

    it('should update currentFolderName when loading subfolder', async () => {
      mockStorageService.listFolder.and.returnValue(Promise.resolve({ folders: [], files: [] }));

      await service.loadFolder('Documents/Uputstva');

      expect(service.currentFolderName).toBe('Uputstva');
    });

    it('should reset currentPath to root when loading without path', async () => {
      mockStorageService.listFolder.and.returnValue(Promise.resolve({ folders: [], files: [] }));
      await service.loadFolder('Documents/Subfolder');

      await service.loadFolder();

      expect(service.currentPath).toBe('Documents');
    });

    it('should set isLoading to false after successful load', async () => {
      mockStorageService.listFolder.and.returnValue(Promise.resolve({ folders: [], files: [] }));

      await service.loadFolder();

      expect(service.isLoading).toBeFalse();
    });

    it('should set isLoading to false after error', async () => {
      mockStorageService.listFolder.and.returnValue(Promise.reject(new Error('fail')));

      await service.loadFolder();

      expect(service.isLoading).toBeFalse();
    });

    it('should clear previous entries before loading new folder', async () => {
      mockStorageService.listFolder.and.returnValue(Promise.resolve({
        folders: ['A'],
        files: [],
      }));
      await service.loadFolder();
      expect(service.entries.length).toBe(1);

      mockStorageService.listFolder.and.returnValue(Promise.resolve({ folders: [], files: [] }));
      await service.loadFolder('Documents/Empty');

      expect(service.entries).toEqual([]);
    });

    it('should replace entries when loading different folder', async () => {
      mockStorageService.listFolder.and.returnValue(Promise.resolve({
        folders: ['X'],
        files: [],
      }));
      await service.loadFolder();
      const firstEntry = service.entries[0];

      mockStorageService.listFolder.and.returnValue(Promise.resolve({
        folders: ['Y'],
        files: [],
      }));
      await service.loadFolder('Documents/Other');

      expect(service.entries[0]).not.toEqual(firstEntry);
      expect(service.entries[0].name).toBe('Y');
    });

    it('should handle empty folder', async () => {
      mockStorageService.listFolder.and.returnValue(Promise.resolve({ folders: [], files: [] }));

      await service.loadFolder();

      expect(service.entries).toEqual([]);
      expect(service.isLoading).toBeFalse();
    });

    it('should create new entries array reference on each load', async () => {
      mockStorageService.listFolder.and.returnValue(Promise.resolve({ folders: ['A'], files: [] }));
      await service.loadFolder();
      const firstRef = service.entries;

      mockStorageService.listFolder.and.returnValue(Promise.resolve({ folders: ['B'], files: [] }));
      await service.loadFolder('Documents/Other');

      expect(service.entries).not.toBe(firstRef);
    });
  });

  // ==========================================
  // loadFolder — guard (dupli load)
  // ==========================================

  describe('loadFolder guard', () => {
    it('should not load if already loading', async () => {
      mockStorageService.listFolder.and.returnValue(
        new Promise((resolve) => setTimeout(() => resolve({ folders: [], files: [] }), 100)),
      );

      const firstLoad = service.loadFolder();
      await service.loadFolder();

      expect(mockStorageService.listFolder).toHaveBeenCalledTimes(1);

      await firstLoad;
    });

    it('should return immediately when already loading', async () => {
      mockStorageService.listFolder.and.returnValue(
        new Promise((resolve) => setTimeout(() => resolve({ folders: [], files: [] }), 100)),
      );

      const firstLoad = service.loadFolder();
      const result = service.loadFolder();

      expect(result).toBeDefined();

      await firstLoad;
    });

    it('should allow loading again after first load completes', async () => {
      mockStorageService.listFolder.and.returnValue(Promise.resolve({ folders: [], files: [] }));

      await service.loadFolder();
      await service.loadFolder('Documents/Next');

      expect(mockStorageService.listFolder).toHaveBeenCalledTimes(2);
    });

    it('should allow loading again after error', async () => {
      mockStorageService.listFolder.and.returnValue(Promise.reject(new Error('fail')));
      await service.loadFolder();

      mockStorageService.listFolder.and.returnValue(Promise.resolve({ folders: [], files: [] }));
      await service.loadFolder();

      expect(mockStorageService.listFolder).toHaveBeenCalledTimes(2);
    });
  });

  // ==========================================
  // loadFolder — logovanje
  // ==========================================

  describe('loadFolder logging', () => {
    it('should log debug on successful load', async () => {
      mockStorageService.listFolder.and.returnValue(Promise.resolve({
        folders: ['A'],
        files: [{ name: 'b.pdf', fullPath: 'Documents/b.pdf' }],
      }));

      await service.loadFolder();

      expect(mockLoggerService.debug).toHaveBeenCalledWith(
        'Docs folder loaded',
        { path: 'Documents', folders: 1, files: 1 },
      );
    });

    it('should log correct folder count in debug', async () => {
      mockStorageService.listFolder.and.returnValue(Promise.resolve({
        folders: ['A', 'B', 'C'],
        files: [],
      }));

      await service.loadFolder();

      expect(mockLoggerService.debug).toHaveBeenCalledWith(
        'Docs folder loaded',
        jasmine.objectContaining({ folders: 3, files: 0 }),
      );
    });

    it('should log correct file count in debug', async () => {
      mockStorageService.listFolder.and.returnValue(Promise.resolve({
        folders: [],
        files: [
          { name: 'a.pdf', fullPath: 'Documents/a.pdf' },
          { name: 'b.pdf', fullPath: 'Documents/b.pdf' },
        ],
      }));

      await service.loadFolder();

      expect(mockLoggerService.debug).toHaveBeenCalledWith(
        'Docs folder loaded',
        jasmine.objectContaining({ folders: 0, files: 2 }),
      );
    });

    it('should log subfolder path in debug', async () => {
      mockStorageService.listFolder.and.returnValue(Promise.resolve({ folders: [], files: [] }));

      await service.loadFolder('Documents/Uputstva');

      expect(mockLoggerService.debug).toHaveBeenCalledWith(
        'Docs folder loaded',
        jasmine.objectContaining({ path: 'Documents/Uputstva' }),
      );
    });

    it('should log zero counts for empty folder', async () => {
      mockStorageService.listFolder.and.returnValue(Promise.resolve({ folders: [], files: [] }));

      await service.loadFolder();

      expect(mockLoggerService.debug).toHaveBeenCalledWith(
        'Docs folder loaded',
        { path: 'Documents', folders: 0, files: 0 },
      );
    });

    it('should not log debug on error', async () => {
      mockStorageService.listFolder.and.returnValue(Promise.reject(new Error('fail')));

      await service.loadFolder();

      expect(mockLoggerService.debug).not.toHaveBeenCalled();
    });

    it('should not log error on success', async () => {
      mockStorageService.listFolder.and.returnValue(Promise.resolve({ folders: [], files: [] }));

      await service.loadFolder();

      expect(mockLoggerService.error).not.toHaveBeenCalled();
    });
  });

  // ==========================================
  // loadFolder — error handling
  // ==========================================

  describe('loadFolder error handling', () => {
    it('should handle Storage error gracefully', async () => {
      mockStorageService.listFolder.and.returnValue(Promise.reject(new Error('Network error')));

      await service.loadFolder();

      expect(service.entries).toEqual([]);
      expect(service.isLoading).toBeFalse();
    });

    it('should log error with path on failure', async () => {
      mockStorageService.listFolder.and.returnValue(Promise.reject(new Error('Network error')));

      await service.loadFolder();

      expect(mockLoggerService.error).toHaveBeenCalledWith(
        'Failed to load docs folder',
        jasmine.objectContaining({ path: 'Documents' }),
      );
    });

    it('should log error with subfolder path on failure', async () => {
      mockStorageService.listFolder.and.returnValue(Promise.reject(new Error('Not found')));

      await service.loadFolder('Documents/Missing');

      expect(mockLoggerService.error).toHaveBeenCalledWith(
        'Failed to load docs folder',
        jasmine.objectContaining({ path: 'Documents/Missing' }),
      );
    });

    it('should include error string in log', async () => {
      mockStorageService.listFolder.and.returnValue(Promise.reject(new Error('Storage quota exceeded')));

      await service.loadFolder();

      expect(mockLoggerService.error).toHaveBeenCalledWith(
        'Failed to load docs folder',
        jasmine.objectContaining({ error: jasmine.stringContaining('Storage quota exceeded') }),
      );
    });

    it('should clear entries on error', async () => {
      mockStorageService.listFolder.and.returnValue(Promise.resolve({ folders: ['X'], files: [] }));
      await service.loadFolder();
      expect(service.entries.length).toBe(1);

      mockStorageService.listFolder.and.returnValue(Promise.reject(new Error('fail')));
      await service.loadFolder('Documents/Bad');

      expect(service.entries).toEqual([]);
    });

    it('should not throw when storage rejects', async () => {
      mockStorageService.listFolder.and.returnValue(Promise.reject(new Error('crash')));

      await expectAsync(service.loadFolder()).toBeResolved();
    });
  });

  // ==========================================
  // loadFolder — sekvencijalni pozivi
  // ==========================================

  describe('loadFolder sequential calls', () => {
    it('should load root then subfolder correctly', async () => {
      mockStorageService.listFolder.and.returnValue(Promise.resolve({
        folders: ['Uputstva'],
        files: [],
      }));
      await service.loadFolder();
      expect(service.entries[0].name).toBe('Uputstva');

      mockStorageService.listFolder.and.returnValue(Promise.resolve({
        folders: [],
        files: [{ name: 'manual.pdf', fullPath: 'Documents/Uputstva/manual.pdf' }],
      }));
      await service.loadFolder('Documents/Uputstva');

      expect(service.entries[0].name).toBe('manual.pdf');
      expect(service.currentPath).toBe('Documents/Uputstva');
    });

    it('should update state correctly on each sequential load', async () => {
      mockStorageService.listFolder.and.returnValue(Promise.resolve({ folders: ['A'], files: [] }));
      await service.loadFolder();
      expect(service.isRoot).toBeTrue();

      mockStorageService.listFolder.and.returnValue(Promise.resolve({ folders: ['B'], files: [] }));
      await service.loadFolder('Documents/A');
      expect(service.isRoot).toBeFalse();
      expect(service.currentFolderName).toBe('A');

      mockStorageService.listFolder.and.returnValue(Promise.resolve({ folders: [], files: [] }));
      await service.loadFolder();
      expect(service.isRoot).toBeTrue();
      expect(service.currentFolderName).toBe('Documents');
    });
  });

  // ==========================================
  // loadFolder — intermediate state (stanje tokom izvršavanja)
  // ==========================================

  describe('loadFolder intermediate state', () => {
    it('should set isLoading to true during execution', () => {
      let loadingDuringExecution = false;
      mockStorageService.listFolder.and.callFake(() => {
        loadingDuringExecution = service.isLoading;
        return Promise.resolve({ folders: [], files: [] });
      });

      service.loadFolder();

      expect(loadingDuringExecution).toBeTrue();
    });

    it('should clear entries before storage call', () => {
      let entriesDuringCall: any[] = [];
      mockStorageService.listFolder.and.callFake(() => {
        entriesDuringCall = [...service.entries];
        return Promise.resolve({ folders: ['A'], files: [] });
      });

      service.entries = [{ name: 'old', fullPath: 'Documents/old', isFolder: true }];
      service.loadFolder();

      expect(entriesDuringCall).toEqual([]);
    });

    it('should update currentPath before storage call', () => {
      let pathDuringCall = '';
      mockStorageService.listFolder.and.callFake(() => {
        pathDuringCall = service.currentPath;
        return Promise.resolve({ folders: [], files: [] });
      });

      service.loadFolder('Documents/Target');

      expect(pathDuringCall).toBe('Documents/Target');
    });

    it('should have isRoot false during subfolder load', () => {
      let isRootDuringCall = true;
      mockStorageService.listFolder.and.callFake(() => {
        isRootDuringCall = service.isRoot;
        return Promise.resolve({ folders: [], files: [] });
      });

      service.loadFolder('Documents/Sub');

      expect(isRootDuringCall).toBeFalse();
    });

    it('should update currentFolderName before storage call', () => {
      let folderNameDuringCall = '';
      mockStorageService.listFolder.and.callFake(() => {
        folderNameDuringCall = service.currentFolderName;
        return Promise.resolve({ folders: [], files: [] });
      });

      service.loadFolder('Documents/MyFolder');

      expect(folderNameDuringCall).toBe('MyFolder');
    });
  });

  // ==========================================
  // loadFolder — eksplicitni root path
  // ==========================================

  describe('loadFolder with explicit root path', () => {
    it('should treat explicit "Documents" same as no argument', async () => {
      mockStorageService.listFolder.and.returnValue(Promise.resolve({ folders: ['A'], files: [] }));

      await service.loadFolder('Documents');

      expect(service.currentPath).toBe('Documents');
      expect(service.isRoot).toBeTrue();
      expect(mockStorageService.listFolder).toHaveBeenCalledWith('Documents');
    });
  });

  // ==========================================
  // loadFolder — stanje posle greške
  // ==========================================

  describe('loadFolder error state details', () => {
    it('should preserve currentPath even on error', async () => {
      mockStorageService.listFolder.and.returnValue(Promise.reject(new Error('fail')));

      await service.loadFolder('Documents/ErrorFolder');

      expect(service.currentPath).toBe('Documents/ErrorFolder');
    });

    it('should update isRoot correctly even on error in subfolder', async () => {
      mockStorageService.listFolder.and.returnValue(Promise.reject(new Error('fail')));

      await service.loadFolder('Documents/Sub');

      expect(service.isRoot).toBeFalse();
    });

    it('should log error only once per failed load', async () => {
      mockStorageService.listFolder.and.returnValue(Promise.reject(new Error('fail')));

      await service.loadFolder();

      expect(mockLoggerService.error).toHaveBeenCalledTimes(1);
    });

    it('should log debug only once per successful load', async () => {
      mockStorageService.listFolder.and.returnValue(Promise.resolve({ folders: ['X'], files: [] }));

      await service.loadFolder();

      expect(mockLoggerService.debug).toHaveBeenCalledTimes(1);
    });
  });

  // ==========================================
  // goBack — sekvencijalni pozivi
  // ==========================================

  describe('goBack sequential navigation', () => {
    beforeEach(() => {
      mockStorageService.listFolder.and.returnValue(Promise.resolve({ folders: [], files: [] }));
    });

    it('should navigate back multiple levels sequentially', async () => {
      await service.loadFolder('Documents/A/B/C');
      mockStorageService.listFolder.calls.reset();

      service.goBack();
      expect(mockStorageService.listFolder).toHaveBeenCalledWith('Documents/A/B');
    });

    it('should construct correct parent after two goBack calls', async () => {
      service.currentPath = 'Documents/A/B/C';
      mockStorageService.listFolder.calls.reset();

      // Simuliramo da goBack učita parent koji menja currentPath
      mockStorageService.listFolder.and.callFake((path: string) => {
        service.currentPath = path;
        return Promise.resolve({ folders: [], files: [] });
      });

      service.goBack(); // Documents/A/B
      await Promise.resolve();

      service.goBack(); // Documents/A
      expect(mockStorageService.listFolder).toHaveBeenCalledWith('Documents/A');
    });
  });

  // ==========================================
  // openFile — sekvencijalni pozivi
  // ==========================================

  describe('openFile sequential calls', () => {
    it('should handle multiple openFile calls independently', async () => {
      mockStorageService.getFileUrl.and.returnValue(Promise.resolve('https://example.com/url'));

      await service.openFile({ name: 'a.pdf', fullPath: 'Documents/a.pdf', isFolder: false });
      await service.openFile({ name: 'b.pdf', fullPath: 'Documents/b.pdf', isFolder: false });

      expect(mockStorageService.getFileUrl).toHaveBeenCalledTimes(2);
      expect(mockStorageService.getFileUrl).toHaveBeenCalledWith('Documents/a.pdf');
      expect(mockStorageService.getFileUrl).toHaveBeenCalledWith('Documents/b.pdf');
    });

    it('should not affect loading state across multiple opens', async () => {
      mockStorageService.getFileUrl.and.returnValue(Promise.resolve('https://example.com/url'));

      await service.openFile({ name: 'a.pdf', fullPath: 'Documents/a.pdf', isFolder: false });
      expect(service.isLoading).toBeFalse();

      await service.openFile({ name: 'b.pdf', fullPath: 'Documents/b.pdf', isFolder: false });
      expect(service.isLoading).toBeFalse();
    });
  });

  // ==========================================
  // openFile
  // ==========================================

  // Napomena: Browser.open iz @capacitor/browser koristi Proxy objekat
  // koji se ne može mockati u unit testovima (spyOn / Object.defineProperty ne rade).
  // Testiramo ponašanje servisa indirektno — getFileUrl poziv i error handling.

  describe('openFile', () => {
    it('should request file URL from storage', async () => {
      mockStorageService.getFileUrl.and.returnValue(Promise.resolve('https://storage.example.com/file.pdf'));

      await service.openFile({ name: 'test.pdf', fullPath: 'Documents/test.pdf', isFolder: false });

      expect(mockStorageService.getFileUrl).toHaveBeenCalledWith('Documents/test.pdf');
    });

    it('should pass exact fullPath to getFileUrl', async () => {
      mockStorageService.getFileUrl.and.returnValue(Promise.resolve('https://example.com/url'));

      await service.openFile({ name: 'deep.pdf', fullPath: 'Documents/A/B/C/deep.pdf', isFolder: false });

      expect(mockStorageService.getFileUrl).toHaveBeenCalledWith('Documents/A/B/C/deep.pdf');
    });

    it('should not log error on successful file open', async () => {
      mockStorageService.getFileUrl.and.returnValue(Promise.resolve('https://storage.example.com/file.pdf'));

      await service.openFile({ name: 'test.pdf', fullPath: 'Documents/test.pdf', isFolder: false });

      expect(mockLoggerService.error).not.toHaveBeenCalled();
    });

    it('should log error when getFileUrl returns null (no URL)', async () => {
      mockStorageService.getFileUrl.and.resolveTo(null);

      await service.openFile({ name: 'missing.pdf', fullPath: 'Documents/missing.pdf', isFolder: false });

      expect(mockLoggerService.error).toHaveBeenCalledWith(
        'Failed to open document — no URL',
        jasmine.objectContaining({ path: 'Documents/missing.pdf' }),
      );
    });

    it('should log error without error key when getFileUrl returns null', async () => {
      mockStorageService.getFileUrl.and.resolveTo(null);

      await service.openFile({ name: 'secret.pdf', fullPath: 'Documents/secret.pdf', isFolder: false });

      expect(mockLoggerService.error).toHaveBeenCalledWith(
        'Failed to open document — no URL',
        { path: 'Documents/secret.pdf' },
      );
    });

    it('should not throw when getFileUrl returns null', async () => {
      mockStorageService.getFileUrl.and.resolveTo(null);

      await expectAsync(
        service.openFile({ name: 'x.pdf', fullPath: 'Documents/x.pdf', isFolder: false }),
      ).toBeResolved();
    });

    it('should call getFileUrl only once per openFile call', async () => {
      mockStorageService.getFileUrl.and.returnValue(Promise.resolve('https://example.com/url'));

      await service.openFile({ name: 'a.pdf', fullPath: 'Documents/a.pdf', isFolder: false });

      expect(mockStorageService.getFileUrl).toHaveBeenCalledTimes(1);
    });

    it('should not modify service state when opening file', async () => {
      mockStorageService.getFileUrl.and.returnValue(Promise.resolve('https://example.com/url'));

      const pathBefore = service.currentPath;
      const entriesBefore = service.entries;
      const loadingBefore = service.isLoading;

      await service.openFile({ name: 'a.pdf', fullPath: 'Documents/a.pdf', isFolder: false });

      expect(service.currentPath).toBe(pathBefore);
      expect(service.entries).toBe(entriesBefore);
      expect(service.isLoading).toBe(loadingBefore);
    });
  });

  // ==========================================
  // goBack
  // ==========================================

  describe('goBack', () => {
    beforeEach(() => {
      mockStorageService.listFolder.and.returnValue(Promise.resolve({ folders: [], files: [] }));
    });

    it('should navigate to parent folder', async () => {
      await service.loadFolder('Documents/Uputstva/Instalacija');
      mockStorageService.listFolder.calls.reset();

      service.goBack();

      expect(mockStorageService.listFolder).toHaveBeenCalledWith('Documents/Uputstva');
    });

    it('should navigate from first-level subfolder to root', async () => {
      await service.loadFolder('Documents/Uputstva');
      mockStorageService.listFolder.calls.reset();

      service.goBack();

      expect(mockStorageService.listFolder).toHaveBeenCalledWith('Documents');
    });

    it('should not go back from root', () => {
      service.currentPath = 'Documents';

      service.goBack();

      expect(mockStorageService.listFolder).not.toHaveBeenCalled();
    });

    it('should navigate from deeply nested to parent', async () => {
      await service.loadFolder('Documents/A/B/C/D');
      mockStorageService.listFolder.calls.reset();

      service.goBack();

      expect(mockStorageService.listFolder).toHaveBeenCalledWith('Documents/A/B/C');
    });

    it('should call loadFolder exactly once', async () => {
      await service.loadFolder('Documents/Sub');
      mockStorageService.listFolder.calls.reset();

      service.goBack();

      expect(mockStorageService.listFolder).toHaveBeenCalledTimes(1);
    });

    it('should handle path with special characters', async () => {
      await service.loadFolder('Documents/Uputstva (2024)');
      mockStorageService.listFolder.calls.reset();

      service.goBack();

      expect(mockStorageService.listFolder).toHaveBeenCalledWith('Documents');
    });
  });

  // ==========================================
  // reset
  // ==========================================

  describe('reset', () => {
    it('should clear entries', async () => {
      mockStorageService.listFolder.and.returnValue(Promise.resolve({
        folders: ['Test'],
        files: [],
      }));
      await service.loadFolder();
      expect(service.entries.length).toBe(1);

      service.reset();

      expect(service.entries).toEqual([]);
    });

    it('should set isLoading to false', () => {
      service.reset();

      expect(service.isLoading).toBeFalse();
    });

    it('should reset to root path', async () => {
      mockStorageService.listFolder.and.returnValue(Promise.resolve({ folders: [], files: [] }));
      await service.loadFolder('Documents/SomeFolder');

      service.reset();

      expect(service.currentPath).toBe('Documents');
    });

    it('should restore isRoot to true', async () => {
      mockStorageService.listFolder.and.returnValue(Promise.resolve({ folders: [], files: [] }));
      await service.loadFolder('Documents/SomeFolder');
      expect(service.isRoot).toBeFalse();

      service.reset();

      expect(service.isRoot).toBeTrue();
    });

    it('should restore currentFolderName to "Documents"', async () => {
      mockStorageService.listFolder.and.returnValue(Promise.resolve({ folders: [], files: [] }));
      await service.loadFolder('Documents/Uputstva');

      service.reset();

      expect(service.currentFolderName).toBe('Documents');
    });

    it('should allow loading after reset', async () => {
      service.reset();

      mockStorageService.listFolder.and.returnValue(Promise.resolve({ folders: ['A'], files: [] }));
      await service.loadFolder();

      expect(service.entries.length).toBe(1);
    });

    it('should not call any storage methods', () => {
      service.reset();

      expect(mockStorageService.listFolder).not.toHaveBeenCalled();
      expect(mockStorageService.getFileUrl).not.toHaveBeenCalled();
    });

    it('should reset after error state', async () => {
      mockStorageService.listFolder.and.returnValue(Promise.reject(new Error('fail')));
      await service.loadFolder('Documents/Bad');

      service.reset();

      expect(service.entries).toEqual([]);
      expect(service.isLoading).toBeFalse();
      expect(service.currentPath).toBe('Documents');
      expect(service.isRoot).toBeTrue();
    });
  });

  // ==========================================
  // clear() — implementacija Clearable interfejsa
  // ==========================================

  describe('clear()', () => {
    it('should clear entries via clear()', async () => {
      mockStorageService.listFolder.and.returnValue(Promise.resolve({
        folders: ['Test'],
        files: [],
      }));
      await service.loadFolder();
      expect(service.entries.length).toBe(1);

      service.clear();

      expect(service.entries).toEqual([]);
    });

    it('should reset currentPath to root via clear()', async () => {
      mockStorageService.listFolder.and.returnValue(Promise.resolve({ folders: [], files: [] }));
      await service.loadFolder('Documents/Sub');

      service.clear();

      expect(service.currentPath).toBe('Documents');
    });

    it('should set isLoading to false via clear()', () => {
      service.clear();
      expect(service.isLoading).toBeFalse();
    });

    it('should restore isRoot to true via clear()', async () => {
      mockStorageService.listFolder.and.returnValue(Promise.resolve({ folders: [], files: [] }));
      await service.loadFolder('Documents/Sub');

      service.clear();

      expect(service.isRoot).toBeTrue();
    });

    it('should behave identically to reset()', async () => {
      mockStorageService.listFolder.and.returnValue(Promise.resolve({ folders: ['A'], files: [] }));
      await service.loadFolder('Documents/Sub');

      service.clear();

      expect(service.entries).toEqual([]);
      expect(service.currentPath).toBe('Documents');
      expect(service.isLoading).toBeFalse();
    });
  });

  // ==========================================
  // loadFolder isLoading guard — edge cases
  // ==========================================

  describe('loadFolder isLoading guard edge cases', () => {
    it('should not update currentPath when skipping due to isLoading', async () => {
      let resolveFirst!: (value: any) => void;
      const firstPromise = new Promise((resolve) => { resolveFirst = resolve; });
      mockStorageService.listFolder.and.returnValue(firstPromise);

      const firstLoad = service.loadFolder('Documents/First');
      expect(service.currentPath).toBe('Documents/First');

      // Second call is blocked — currentPath should NOT change to 'Documents/Second'
      await service.loadFolder('Documents/Second');
      expect(service.currentPath).toBe('Documents/First');

      resolveFirst({ folders: [], files: [] });
      await firstLoad;
    });

    it('should not call storage when called while loading', async () => {
      let resolveFirst!: (value: any) => void;
      const firstPromise = new Promise((resolve) => { resolveFirst = resolve; });
      mockStorageService.listFolder.and.returnValue(firstPromise);

      const firstLoad = service.loadFolder();
      mockStorageService.listFolder.calls.reset();

      await service.loadFolder('Documents/Other');

      expect(mockStorageService.listFolder).not.toHaveBeenCalled();

      resolveFirst({ folders: [], files: [] });
      await firstLoad;
    });
  });

  // ==========================================
  // goBack — isLoading guard
  // ==========================================

  describe('goBack isLoading guard', () => {
    it('should still trigger goBack even when isLoading is true', async () => {
      // goBack calls loadFolder internally — the isLoading guard in loadFolder
      // will prevent the nested call from executing if already loading
      service.currentPath = 'Documents/Sub';
      mockStorageService.listFolder.and.returnValue(Promise.resolve({ folders: [], files: [] }));

      service.goBack();

      expect(mockStorageService.listFolder).toHaveBeenCalled();
    });

    it('should not go back when at root (parts.length === 1)', () => {
      service.currentPath = 'Documents';
      mockStorageService.listFolder.calls.reset();

      service.goBack();

      expect(mockStorageService.listFolder).not.toHaveBeenCalled();
    });

    it('should correctly split path on goBack from two-level path', () => {
      service.currentPath = 'Documents/Uputstva';
      mockStorageService.listFolder.and.returnValue(Promise.resolve({ folders: [], files: [] }));

      service.goBack();

      expect(mockStorageService.listFolder).toHaveBeenCalledWith('Documents');
    });
  });

  // ==========================================
  // openFile — isLoading state unchanged
  // ==========================================

  describe('openFile state invariants', () => {
    it('should not change isLoading state when opening a file', async () => {
      mockStorageService.getFileUrl.and.returnValue(Promise.resolve('https://example.com/file.pdf'));
      expect(service.isLoading).toBeFalse();

      await service.openFile({ name: 'a.pdf', fullPath: 'Documents/a.pdf', isFolder: false });

      expect(service.isLoading).toBeFalse();
    });

    it('should not change entries when opening a file', async () => {
      mockStorageService.listFolder.and.returnValue(Promise.resolve({
        folders: ['Folder'],
        files: [],
      }));
      await service.loadFolder();
      const entriesSnapshot = [...service.entries];

      mockStorageService.getFileUrl.and.returnValue(Promise.resolve('https://example.com/url'));
      await service.openFile({ name: 'a.pdf', fullPath: 'Documents/a.pdf', isFolder: false });

      expect(service.entries).toEqual(entriesSnapshot);
    });

    it('should log error with correct path when getFileUrl returns null on subfolder file', async () => {
      mockStorageService.getFileUrl.and.resolveTo(null);

      await service.openFile({ name: 'sub.pdf', fullPath: 'Documents/Sub/sub.pdf', isFolder: false });

      expect(mockLoggerService.error).toHaveBeenCalledWith(
        'Failed to open document — no URL',
        jasmine.objectContaining({ path: 'Documents/Sub/sub.pdf' }),
      );
    });
  });

  // ==========================================
  // EXPANSION — loadFolder path depth variations
  // ==========================================

  describe('loadFolder — folder depth variations (parameterized)', () => {
    const depthPaths: Array<{ path: string; depth: number }> = [
      { path: 'Documents', depth: 1 },
      { path: 'Documents/Level1', depth: 2 },
      { path: 'Documents/Level1/Level2', depth: 3 },
      { path: 'Documents/Level1/Level2/Level3', depth: 4 },
      { path: 'Documents/Level1/Level2/Level3/Level4', depth: 5 },
      { path: 'Documents/A/B/C/D/E/F/G/H/I/J', depth: 11 },
    ];

    depthPaths.forEach(({ path, depth }) => {
      it(`should correctly set currentPath for depth=${depth}: "${path}"`, async () => {
        mockStorageService.listFolder.and.returnValue(Promise.resolve({ folders: [], files: [] }));

        await service.loadFolder(path);

        expect(service.currentPath).toBe(path);
      });

      it(`isRoot should be ${depth === 1} for depth=${depth}`, async () => {
        mockStorageService.listFolder.and.returnValue(Promise.resolve({ folders: [], files: [] }));

        await service.loadFolder(path);

        expect(service.isRoot).toBe(depth === 1);
      });
    });
  });

  // ==========================================
  // EXPANSION — folder/file count variations
  // ==========================================

  describe('loadFolder — entry count variations (parameterized)', () => {
    const countCases = [0, 1, 5, 10, 50, 100];

    countCases.forEach((count) => {
      it(`should handle ${count} folders correctly`, async () => {
        const folders = Array.from({ length: count }, (_, i) => `Folder${i}`);
        mockStorageService.listFolder.and.returnValue(Promise.resolve({ folders, files: [] }));

        await service.loadFolder();

        expect(service.entries.length).toBe(count);
        expect(service.entries.every((e) => e.isFolder)).toBeTrue();
      });

      it(`should handle ${count} files correctly`, async () => {
        const files = Array.from({ length: count }, (_, i) => ({
          name: `file${i}.pdf`,
          fullPath: `Documents/file${i}.pdf`,
        }));
        mockStorageService.listFolder.and.returnValue(Promise.resolve({ folders: [], files }));

        await service.loadFolder();

        expect(service.entries.length).toBe(count);
        expect(service.entries.every((e) => !e.isFolder)).toBeTrue();
      });
    });
  });

  // ==========================================
  // EXPANSION — folder names with special chars
  // ==========================================

  describe('loadFolder — special characters in folder names', () => {
    const specialFolderNames = [
      'Folder With Spaces',
      'Folder (2024)',
      'Folder-with-hyphens',
      'Folder_with_underscores',
      'Folder.with.dots',
      'UPPERCASE FOLDER',
      'lowercase folder',
      'Folder123',
      'šumski dokumenti',
      'Документация',
    ];

    specialFolderNames.forEach((name) => {
      it(`should preserve folder name "${name}"`, async () => {
        mockStorageService.listFolder.and.returnValue(Promise.resolve({
          folders: [name],
          files: [],
        }));

        await service.loadFolder();

        expect(service.entries[0].name).toBe(name);
      });

      it(`should construct correct fullPath for folder "${name}"`, async () => {
        mockStorageService.listFolder.and.returnValue(Promise.resolve({
          folders: [name],
          files: [],
        }));

        await service.loadFolder();

        expect(service.entries[0].fullPath).toBe(`Documents/${name}`);
      });
    });
  });

  // ==========================================
  // EXPANSION — file names with special chars
  // ==========================================

  describe('loadFolder — special characters in file names', () => {
    const specialFileNames = [
      'report.pdf',
      'document with spaces.pdf',
      'file-with-hyphens.docx',
      'file_with_underscores.pdf',
      'UPPERCASE.PDF',
      'file.v2.1.pdf',
      'šema čišćenja.pdf',
      'Документ.pdf',
      'very_long_file_name_with_many_characters_that_could_potentially_cause_issues.pdf',
    ];

    specialFileNames.forEach((name) => {
      it(`should preserve file name "${name}"`, async () => {
        mockStorageService.listFolder.and.returnValue(Promise.resolve({
          folders: [],
          files: [{ name, fullPath: `Documents/${name}` }],
        }));

        await service.loadFolder();

        expect(service.entries[0].name).toBe(name);
      });
    });
  });

  // ==========================================
  // EXPANSION — currentFolderName for various paths
  // ==========================================

  describe('currentFolderName — parameterized path variations', () => {
    const pathCases: Array<{ path: string; expectedName: string }> = [
      { path: 'Documents', expectedName: 'Documents' },
      { path: 'Documents/A', expectedName: 'A' },
      { path: 'Documents/Alpha Beta', expectedName: 'Alpha Beta' },
      { path: 'Documents/Level1/Level2/DeepFolder', expectedName: 'DeepFolder' },
      { path: 'Documents/Katalozi (2024)', expectedName: 'Katalozi (2024)' },
      { path: 'Documents/šema_čišćenja', expectedName: 'šema_čišćenja' },
      { path: 'Documents/A/B', expectedName: 'B' },
      { path: 'Documents/x', expectedName: 'x' },
    ];

    pathCases.forEach(({ path, expectedName }) => {
      it(`path="${path}" should have currentFolderName="${expectedName}"`, () => {
        service.currentPath = path;
        expect(service.currentFolderName).toBe(expectedName);
      });
    });
  });

  // ==========================================
  // EXPANSION — goBack from various depths
  // ==========================================

  describe('goBack — from various path depths (parameterized)', () => {
    const goBackCases: Array<{ from: string; expectedParent: string }> = [
      { from: 'Documents/A', expectedParent: 'Documents' },
      { from: 'Documents/A/B', expectedParent: 'Documents/A' },
      { from: 'Documents/A/B/C', expectedParent: 'Documents/A/B' },
      { from: 'Documents/A/B/C/D', expectedParent: 'Documents/A/B/C' },
      { from: 'Documents/Uputstva (2024)', expectedParent: 'Documents' },
      { from: 'Documents/Special Folder/Sub', expectedParent: 'Documents/Special Folder' },
    ];

    goBackCases.forEach(({ from, expectedParent }) => {
      it(`goBack from "${from}" should navigate to "${expectedParent}"`, async () => {
        mockStorageService.listFolder.and.returnValue(Promise.resolve({ folders: [], files: [] }));
        service.currentPath = from;

        service.goBack();

        expect(mockStorageService.listFolder).toHaveBeenCalledWith(expectedParent);
      });
    });
  });

  // ==========================================
  // EXPANSION — openFile with various file types
  // ==========================================

  describe('openFile — various file types (parameterized)', () => {
    const fileTypes = [
      { name: 'document.pdf', fullPath: 'Documents/document.pdf' },
      { name: 'spreadsheet.xlsx', fullPath: 'Documents/spreadsheet.xlsx' },
      { name: 'image.jpg', fullPath: 'Documents/image.jpg' },
      { name: 'image.png', fullPath: 'Documents/image.png' },
      { name: 'word.docx', fullPath: 'Documents/word.docx' },
      { name: 'archive.zip', fullPath: 'Documents/archive.zip' },
      { name: 'text.txt', fullPath: 'Documents/text.txt' },
    ];

    fileTypes.forEach(({ name, fullPath }) => {
      it(`should call getFileUrl with correct path for "${name}"`, async () => {
        mockStorageService.getFileUrl.and.returnValue(Promise.resolve('https://example.com/url'));

        await service.openFile({ name, fullPath, isFolder: false });

        expect(mockStorageService.getFileUrl).toHaveBeenCalledWith(fullPath);
      });
    });
  });

  // ==========================================
  // EXPANSION — error messages logged
  // ==========================================

  describe('loadFolder — various error messages logged', () => {
    const errorMessages = [
      'Network error',
      'Storage quota exceeded',
      'Permission denied',
      'Not found',
      'Internal server error',
      'Timeout',
    ];

    errorMessages.forEach((msg) => {
      it(`should log error containing "${msg}"`, async () => {
        mockStorageService.listFolder.and.returnValue(Promise.reject(new Error(msg)));

        await service.loadFolder();

        expect(mockLoggerService.error).toHaveBeenCalledWith(
          'Failed to load docs folder',
          jasmine.objectContaining({ error: jasmine.stringContaining(msg) }),
        );
      });
    });
  });

  // ==========================================
  // EXPANSION — reset() idempotency
  // ==========================================

  describe('reset() — idempotency and state after multiple calls', () => {
    it('should remain in clean state after 3 consecutive resets', async () => {
      mockStorageService.listFolder.and.returnValue(Promise.resolve({ folders: ['A'], files: [] }));
      await service.loadFolder('Documents/Sub');

      service.reset();
      service.reset();
      service.reset();

      expect(service.entries).toEqual([]);
      expect(service.currentPath).toBe('Documents');
      expect(service.isRoot).toBeTrue();
      expect(service.isLoading).toBeFalse();
    });

    it('should be able to load after multiple resets', async () => {
      service.reset();
      service.reset();

      mockStorageService.listFolder.and.returnValue(Promise.resolve({ folders: ['X'], files: [] }));
      await service.loadFolder();

      expect(service.entries.length).toBe(1);
    });
  });
});
