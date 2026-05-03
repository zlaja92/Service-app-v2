import { ComponentFixture, TestBed } from '@angular/core/testing';
import { TranslocoTestingModule } from '@jsverse/transloco';
import { provideRouter } from '@angular/router';
import { DocsListPage } from './docs-list.page';
import { DocsService } from '../services/docs.service';
import { DocEntry } from '../models/doc.model';

const mockDocsService = {
  entries: [] as DocEntry[],
  isLoading: false,
  currentPath: 'Documents',
  isRoot: true,
  currentFolderName: 'Documents',
  loadFolder: jasmine.createSpy('loadFolder'),
  openFile: jasmine.createSpy('openFile'),
  goBack: jasmine.createSpy('goBack'),
  reset: jasmine.createSpy('reset'),
};

describe('DocsListPage', () => {
  let component: DocsListPage;
  let fixture: ComponentFixture<DocsListPage>;

  beforeEach(async () => {
    mockDocsService.entries = [];
    mockDocsService.isLoading = false;
    mockDocsService.currentPath = 'Documents';
    mockDocsService.isRoot = true;
    mockDocsService.currentFolderName = 'Documents';
    mockDocsService.loadFolder.calls.reset();
    mockDocsService.openFile.calls.reset();
    mockDocsService.goBack.calls.reset();
    mockDocsService.reset.calls.reset();

    await TestBed.configureTestingModule({
      imports: [
        DocsListPage,
        TranslocoTestingModule.forRoot({
          langs: {
            sr: {
              docs_title: 'Dokumentacija',
              docs_empty: 'Nema dostupnih dokumenata.',
            },
          },
          translocoConfig: {
            availableLangs: ['sr'],
            defaultLang: 'sr',
          },
          preloadLangs: true,
        }),
      ],
      providers: [
        provideRouter([]),
        { provide: DocsService, useValue: mockDocsService },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(DocsListPage);
    component = fixture.componentInstance;
  });

  // ==========================================
  // Kreiranje komponente
  // ==========================================

  describe('creation', () => {
    it('should create the component', () => {
      expect(component).toBeTruthy();
    });

    it('should inject DocsService', () => {
      expect((component as any).docsService).toBeTruthy();
    });
  });

  // ==========================================
  // ionViewWillEnter lifecycle
  // ==========================================

  describe('ionViewWillEnter', () => {
    it('should call loadFolder on view enter', () => {
      component.ionViewWillEnter();

      expect(mockDocsService.loadFolder).toHaveBeenCalled();
    });

    it('should call loadFolder without arguments (loads root)', () => {
      component.ionViewWillEnter();

      expect(mockDocsService.loadFolder).toHaveBeenCalledWith();
    });

    it('should call loadFolder exactly once', () => {
      component.ionViewWillEnter();

      expect(mockDocsService.loadFolder).toHaveBeenCalledTimes(1);
    });

    it('should not call openFile on view enter', () => {
      component.ionViewWillEnter();

      expect(mockDocsService.openFile).not.toHaveBeenCalled();
    });

    it('should not call goBack on view enter', () => {
      component.ionViewWillEnter();

      expect(mockDocsService.goBack).not.toHaveBeenCalled();
    });

    it('should not call reset on view enter', () => {
      component.ionViewWillEnter();

      expect(mockDocsService.reset).not.toHaveBeenCalled();
    });
  });

  // ==========================================
  // onEntryClick — folderi
  // ==========================================

  describe('onEntryClick with folders', () => {
    it('should call loadFolder when clicking a folder', () => {
      const folder: DocEntry = { name: 'Uputstva', fullPath: 'Documents/Uputstva', isFolder: true };

      component.onEntryClick(folder);

      expect(mockDocsService.loadFolder).toHaveBeenCalledWith('Documents/Uputstva');
    });

    it('should pass correct fullPath for nested folder', () => {
      const folder: DocEntry = { name: 'Sub', fullPath: 'Documents/Parent/Sub', isFolder: true };

      component.onEntryClick(folder);

      expect(mockDocsService.loadFolder).toHaveBeenCalledWith('Documents/Parent/Sub');
    });

    it('should not call openFile when clicking a folder', () => {
      const folder: DocEntry = { name: 'Folder', fullPath: 'Documents/Folder', isFolder: true };

      component.onEntryClick(folder);

      expect(mockDocsService.openFile).not.toHaveBeenCalled();
    });

    it('should call loadFolder only once per folder click', () => {
      const folder: DocEntry = { name: 'Folder', fullPath: 'Documents/Folder', isFolder: true };

      component.onEntryClick(folder);

      expect(mockDocsService.loadFolder).toHaveBeenCalledTimes(1);
    });
  });

  // ==========================================
  // onEntryClick — fajlovi
  // ==========================================

  describe('onEntryClick with files', () => {
    it('should call openFile when clicking a file', () => {
      const file: DocEntry = { name: 'test.pdf', fullPath: 'Documents/test.pdf', isFolder: false };

      component.onEntryClick(file);

      expect(mockDocsService.openFile).toHaveBeenCalledWith(file);
    });

    it('should pass the entire entry object to openFile', () => {
      const file: DocEntry = { name: 'manual.pdf', fullPath: 'Documents/Uputstva/manual.pdf', isFolder: false };

      component.onEntryClick(file);

      expect(mockDocsService.openFile).toHaveBeenCalledWith(file);
    });

    it('should not call loadFolder when clicking a file', () => {
      const file: DocEntry = { name: 'doc.pdf', fullPath: 'Documents/doc.pdf', isFolder: false };

      component.onEntryClick(file);

      expect(mockDocsService.loadFolder).not.toHaveBeenCalled();
    });

    it('should call openFile only once per file click', () => {
      const file: DocEntry = { name: 'x.pdf', fullPath: 'Documents/x.pdf', isFolder: false };

      component.onEntryClick(file);

      expect(mockDocsService.openFile).toHaveBeenCalledTimes(1);
    });

    it('should handle multiple file clicks sequentially', () => {
      const file1: DocEntry = { name: 'a.pdf', fullPath: 'Documents/a.pdf', isFolder: false };
      const file2: DocEntry = { name: 'b.pdf', fullPath: 'Documents/b.pdf', isFolder: false };

      component.onEntryClick(file1);
      component.onEntryClick(file2);

      expect(mockDocsService.openFile).toHaveBeenCalledTimes(2);
      expect(mockDocsService.openFile).toHaveBeenCalledWith(file1);
      expect(mockDocsService.openFile).toHaveBeenCalledWith(file2);
    });
  });

  // ==========================================
  // goBack
  // ==========================================

  describe('goBack', () => {
    it('should call docsService.goBack', () => {
      component.goBack();

      expect(mockDocsService.goBack).toHaveBeenCalledTimes(1);
    });

    it('should not call loadFolder directly', () => {
      component.goBack();

      expect(mockDocsService.loadFolder).not.toHaveBeenCalled();
    });

    it('should not call openFile', () => {
      component.goBack();

      expect(mockDocsService.openFile).not.toHaveBeenCalled();
    });
  });

  // ==========================================
  // Template — Header (root stanje)
  // ==========================================

  describe('template header at root', () => {
    beforeEach(() => {
      mockDocsService.isRoot = true;
      fixture.detectChanges();
    });

    it('should show ion-back-button', () => {
      const backButton = fixture.nativeElement.querySelector('ion-back-button');
      expect(backButton).toBeTruthy();
    });

    it('should set defaultHref to /home on back button', () => {
      const backButton = fixture.nativeElement.querySelector('ion-back-button');
      expect(backButton.getAttribute('defaulthref')).toBe('/home');
    });

    it('should not show arrow back ion-button', () => {
      const arrowButton = fixture.nativeElement.querySelector('ion-buttons[slot="start"] ion-button');
      expect(arrowButton).toBeFalsy();
    });

    it('should show translated title "Dokumentacija"', () => {
      const title = fixture.nativeElement.querySelector('ion-title');
      expect(title.textContent).toContain('Dokumentacija');
    });

    it('should not show folder name in title', () => {
      const title = fixture.nativeElement.querySelector('ion-title');
      expect(title.textContent).not.toContain('Uputstva');
    });

    it('should have menu button', () => {
      const menuButton = fixture.nativeElement.querySelector('ion-menu-button');
      expect(menuButton).toBeTruthy();
    });

    it('should have menu button in end slot', () => {
      const endSlot = fixture.nativeElement.querySelector('ion-buttons[slot="end"]');
      const menuButton = endSlot?.querySelector('ion-menu-button');
      expect(menuButton).toBeTruthy();
    });

    it('should have toolbar with primary color', () => {
      const toolbar = fixture.nativeElement.querySelector('ion-toolbar');
      expect(toolbar.getAttribute('color')).toBe('primary');
    });
  });

  // ==========================================
  // Template — Header (subfolder stanje)
  // ==========================================

  describe('template header in subfolder', () => {
    beforeEach(() => {
      mockDocsService.isRoot = false;
      mockDocsService.currentFolderName = 'Uputstva';
      fixture.detectChanges();
    });

    it('should not show ion-back-button', () => {
      const backButton = fixture.nativeElement.querySelector('ion-back-button');
      expect(backButton).toBeFalsy();
    });

    it('should show arrow back ion-button', () => {
      const arrowButton = fixture.nativeElement.querySelector('ion-buttons[slot="start"] ion-button');
      expect(arrowButton).toBeTruthy();
    });

    it('should have arrow-back-outline icon', () => {
      const icon = fixture.nativeElement.querySelector('ion-buttons[slot="start"] ion-button ion-icon');
      expect(icon).toBeTruthy();
    });

    it('should show folder name as title', () => {
      const title = fixture.nativeElement.querySelector('ion-title');
      expect(title.textContent).toContain('Uputstva');
    });

    it('should not show translated docs_title', () => {
      const title = fixture.nativeElement.querySelector('ion-title');
      expect(title.textContent).not.toContain('Dokumentacija');
    });

    it('should call goBack when arrow button is clicked', () => {
      const arrowButton = fixture.nativeElement.querySelector('ion-buttons[slot="start"] ion-button');
      arrowButton.click();

      expect(mockDocsService.goBack).toHaveBeenCalledTimes(1);
    });

    it('should show different folder names dynamically', () => {
      mockDocsService.currentFolderName = 'Katalozi';
      fixture.detectChanges();

      const title = fixture.nativeElement.querySelector('ion-title');
      expect(title.textContent).toContain('Katalozi');
    });

    it('should still have menu button', () => {
      const menuButton = fixture.nativeElement.querySelector('ion-menu-button');
      expect(menuButton).toBeTruthy();
    });
  });

  // ==========================================
  // Template — Loading state
  // ==========================================

  describe('template loading state', () => {
    beforeEach(() => {
      mockDocsService.isLoading = true;
      mockDocsService.entries = [];
      fixture.detectChanges();
    });

    it('should show skeleton list', () => {
      const list = fixture.nativeElement.querySelector('ion-list');
      expect(list).toBeTruthy();
    });

    it('should show exactly 5 skeleton items', () => {
      const skeletons = fixture.nativeElement.querySelectorAll('ion-skeleton-text');
      expect(skeletons.length).toBe(5);
    });

    it('should have skeleton items with animated attribute', () => {
      const skeletons = fixture.nativeElement.querySelectorAll('ion-skeleton-text');
      skeletons.forEach((skeleton: any) => {
        expect(skeleton.animated).toBeTrue();
      });
    });

    it('should show document-outline icon on each skeleton item', () => {
      const icons = fixture.nativeElement.querySelectorAll('ion-list ion-item ion-icon');
      expect(icons.length).toBe(5);
    });

    it('should not show data entries during loading', () => {
      mockDocsService.entries = [
        { name: 'test.pdf', fullPath: 'Documents/test.pdf', isFolder: false },
      ];
      fixture.detectChanges();

      const buttonItems = fixture.nativeElement.querySelectorAll('ion-item[button]');
      expect(buttonItems.length).toBe(0);
    });

    it('should not show empty state during loading', () => {
      const emptyState = fixture.nativeElement.querySelector('.empty-state');
      expect(emptyState).toBeFalsy();
    });
  });

  // ==========================================
  // Template — Loaded with no entries
  // ==========================================

  describe('template not loading, no entries', () => {
    beforeEach(() => {
      mockDocsService.isLoading = false;
      mockDocsService.entries = [];
      fixture.detectChanges();
    });

    it('should not show skeleton items', () => {
      const skeletons = fixture.nativeElement.querySelectorAll('ion-skeleton-text');
      expect(skeletons.length).toBe(0);
    });

    it('should not show data list', () => {
      const buttonItems = fixture.nativeElement.querySelectorAll('ion-item[button]');
      expect(buttonItems.length).toBe(0);
    });

    it('should show empty state', () => {
      const emptyState = fixture.nativeElement.querySelector('.empty-state');
      expect(emptyState).toBeTruthy();
    });

    it('should show translated empty message', () => {
      const emptyState = fixture.nativeElement.querySelector('.empty-state');
      expect(emptyState.textContent).toContain('Nema dostupnih dokumenata.');
    });

    it('should wrap empty message in <p> tag', () => {
      const p = fixture.nativeElement.querySelector('.empty-state p');
      expect(p).toBeTruthy();
    });
  });

  // ==========================================
  // Template — Entries list (samo folderi)
  // ==========================================

  describe('template entries - folders only', () => {
    beforeEach(() => {
      mockDocsService.isLoading = false;
      mockDocsService.entries = [
        { name: 'Uputstva', fullPath: 'Documents/Uputstva', isFolder: true },
        { name: 'Katalozi', fullPath: 'Documents/Katalozi', isFolder: true },
      ];
      fixture.detectChanges();
    });

    it('should render correct number of folder items', () => {
      const items = fixture.nativeElement.querySelectorAll('ion-item[button]');
      expect(items.length).toBe(2);
    });

    it('should show folder-outline icon for first folder', () => {
      const icon = fixture.nativeElement.querySelector('ion-item[button] ion-icon');
      expect(icon.name).toBe('folder-outline');
    });

    it('should show folder-outline icon for all folders', () => {
      const items = fixture.nativeElement.querySelectorAll('ion-item[button]');
      items.forEach((item: any) => {
        const icon = item.querySelector('ion-icon');
        expect(icon.name).toBe('folder-outline');
      });
    });

    it('should show detail arrow for all folders', () => {
      const items = fixture.nativeElement.querySelectorAll('ion-item[button]');
      items.forEach((item: any) => {
        expect(item.detail).toBeTrue();
      });
    });

    it('should render folder names in labels', () => {
      const labels = fixture.nativeElement.querySelectorAll('ion-item[button] ion-label');
      expect(labels[0].textContent).toContain('Uputstva');
      expect(labels[1].textContent).toContain('Katalozi');
    });

    it('should not show empty state', () => {
      const emptyState = fixture.nativeElement.querySelector('.empty-state');
      expect(emptyState).toBeFalsy();
    });

    it('should call loadFolder on folder click', () => {
      const items = fixture.nativeElement.querySelectorAll('ion-item[button]');
      items[0].click();

      expect(mockDocsService.loadFolder).toHaveBeenCalledWith('Documents/Uputstva');
    });

    it('should call loadFolder with correct path for second folder', () => {
      const items = fixture.nativeElement.querySelectorAll('ion-item[button]');
      items[1].click();

      expect(mockDocsService.loadFolder).toHaveBeenCalledWith('Documents/Katalozi');
    });
  });

  // ==========================================
  // Template — Entries list (samo fajlovi)
  // ==========================================

  describe('template entries - files only', () => {
    beforeEach(() => {
      mockDocsService.isLoading = false;
      mockDocsService.entries = [
        { name: 'garancija.pdf', fullPath: 'Documents/garancija.pdf', isFolder: false },
        { name: 'ugovor.docx', fullPath: 'Documents/ugovor.docx', isFolder: false },
      ];
      fixture.detectChanges();
    });

    it('should render correct number of file items', () => {
      const items = fixture.nativeElement.querySelectorAll('ion-item[button]');
      expect(items.length).toBe(2);
    });

    it('should show document-outline icon for files', () => {
      const items = fixture.nativeElement.querySelectorAll('ion-item[button]');
      items.forEach((item: any) => {
        const icon = item.querySelector('ion-icon');
        expect(icon.name).toBe('document-outline');
      });
    });

    it('should not show detail arrow for files', () => {
      const items = fixture.nativeElement.querySelectorAll('ion-item[button]');
      items.forEach((item: any) => {
        expect(item.detail).toBeFalse();
      });
    });

    it('should render file names in labels', () => {
      const labels = fixture.nativeElement.querySelectorAll('ion-item[button] ion-label');
      expect(labels[0].textContent).toContain('garancija.pdf');
      expect(labels[1].textContent).toContain('ugovor.docx');
    });

    it('should call openFile on file click', () => {
      const items = fixture.nativeElement.querySelectorAll('ion-item[button]');
      items[0].click();

      expect(mockDocsService.openFile).toHaveBeenCalled();
    });

    it('should not call loadFolder on file click', () => {
      const items = fixture.nativeElement.querySelectorAll('ion-item[button]');
      items[0].click();

      expect(mockDocsService.loadFolder).not.toHaveBeenCalled();
    });
  });

  // ==========================================
  // Template — Entries list (mešoviti sadržaj)
  // ==========================================

  describe('template entries - mixed content', () => {
    beforeEach(() => {
      mockDocsService.isLoading = false;
      mockDocsService.entries = [
        { name: 'FolderA', fullPath: 'Documents/FolderA', isFolder: true },
        { name: 'FolderB', fullPath: 'Documents/FolderB', isFolder: true },
        { name: 'file1.pdf', fullPath: 'Documents/file1.pdf', isFolder: false },
        { name: 'file2.pdf', fullPath: 'Documents/file2.pdf', isFolder: false },
      ];
      fixture.detectChanges();
    });

    it('should render all entries', () => {
      const items = fixture.nativeElement.querySelectorAll('ion-item[button]');
      expect(items.length).toBe(4);
    });

    it('should show folder-outline for folder entries', () => {
      const items = fixture.nativeElement.querySelectorAll('ion-item[button]');
      expect(items[0].querySelector('ion-icon').name).toBe('folder-outline');
      expect(items[1].querySelector('ion-icon').name).toBe('folder-outline');
    });

    it('should show document-outline for file entries', () => {
      const items = fixture.nativeElement.querySelectorAll('ion-item[button]');
      expect(items[2].querySelector('ion-icon').name).toBe('document-outline');
      expect(items[3].querySelector('ion-icon').name).toBe('document-outline');
    });

    it('should show detail arrow only for folders', () => {
      const items = fixture.nativeElement.querySelectorAll('ion-item[button]');
      expect(items[0].detail).toBeTrue();
      expect(items[1].detail).toBeTrue();
      expect(items[2].detail).toBeFalse();
      expect(items[3].detail).toBeFalse();
    });

    it('should render all names correctly', () => {
      const labels = fixture.nativeElement.querySelectorAll('ion-item[button] ion-label');
      expect(labels[0].textContent).toContain('FolderA');
      expect(labels[1].textContent).toContain('FolderB');
      expect(labels[2].textContent).toContain('file1.pdf');
      expect(labels[3].textContent).toContain('file2.pdf');
    });

    it('should call loadFolder when clicking folder item', () => {
      const items = fixture.nativeElement.querySelectorAll('ion-item[button]');
      items[0].click();

      expect(mockDocsService.loadFolder).toHaveBeenCalledWith('Documents/FolderA');
      expect(mockDocsService.openFile).not.toHaveBeenCalled();
    });

    it('should call openFile when clicking file item', () => {
      const items = fixture.nativeElement.querySelectorAll('ion-item[button]');
      items[2].click();

      expect(mockDocsService.openFile).toHaveBeenCalled();
      expect(mockDocsService.loadFolder).not.toHaveBeenCalled();
    });
  });

  // ==========================================
  // Template — Entries list (specijalni sadržaj)
  // ==========================================

  describe('template entries - special content', () => {
    it('should render single entry', () => {
      mockDocsService.entries = [
        { name: 'Solo.pdf', fullPath: 'Documents/Solo.pdf', isFolder: false },
      ];
      fixture.detectChanges();

      const items = fixture.nativeElement.querySelectorAll('ion-item[button]');
      expect(items.length).toBe(1);
    });

    it('should render many entries (10+)', () => {
      const entries: DocEntry[] = [];
      for (let i = 0; i < 15; i++) {
        entries.push({ name: `file${i}.pdf`, fullPath: `Documents/file${i}.pdf`, isFolder: false });
      }
      mockDocsService.entries = entries;
      fixture.detectChanges();

      const items = fixture.nativeElement.querySelectorAll('ion-item[button]');
      expect(items.length).toBe(15);
    });

    it('should render entry with long name', () => {
      mockDocsService.entries = [
        {
          name: 'Veoma_dugo_ime_dokumenta_za_servisiranje_uredjaja_model_XYZ-2024.pdf',
          fullPath: 'Documents/Veoma_dugo_ime_dokumenta_za_servisiranje_uredjaja_model_XYZ-2024.pdf',
          isFolder: false,
        },
      ];
      fixture.detectChanges();

      const label = fixture.nativeElement.querySelector('ion-item[button] ion-label');
      expect(label.textContent).toContain('Veoma_dugo_ime_dokumenta_za_servisiranje_uredjaja_model_XYZ-2024.pdf');
    });

    it('should render entry with unicode name', () => {
      mockDocsService.entries = [
        { name: 'šema_čišćenja.pdf', fullPath: 'Documents/šema_čišćenja.pdf', isFolder: false },
      ];
      fixture.detectChanges();

      const label = fixture.nativeElement.querySelector('ion-item[button] ion-label');
      expect(label.textContent).toContain('šema_čišćenja.pdf');
    });

    it('should render entry with spaces in name', () => {
      mockDocsService.entries = [
        { name: 'Moj Dokument.pdf', fullPath: 'Documents/Moj Dokument.pdf', isFolder: false },
      ];
      fixture.detectChanges();

      const label = fixture.nativeElement.querySelector('ion-item[button] ion-label');
      expect(label.textContent).toContain('Moj Dokument.pdf');
    });

    it('should render folder with special characters', () => {
      mockDocsService.entries = [
        { name: 'Katalozi (2024)', fullPath: 'Documents/Katalozi (2024)', isFolder: true },
      ];
      fixture.detectChanges();

      const label = fixture.nativeElement.querySelector('ion-item[button] ion-label');
      expect(label.textContent).toContain('Katalozi (2024)');
    });

    it('should have lines="full" on each entry item', () => {
      mockDocsService.entries = [
        { name: 'test.pdf', fullPath: 'Documents/test.pdf', isFolder: false },
      ];
      fixture.detectChanges();

      const item = fixture.nativeElement.querySelector('ion-item[button]');
      expect(item.getAttribute('lines')).toBe('full');
    });

    it('should have icon in start slot', () => {
      mockDocsService.entries = [
        { name: 'test.pdf', fullPath: 'Documents/test.pdf', isFolder: false },
      ];
      fixture.detectChanges();

      const icon = fixture.nativeElement.querySelector('ion-item[button] ion-icon');
      expect(icon.getAttribute('slot')).toBe('start');
    });
  });

  // ==========================================
  // Template — State transitions
  // ==========================================

  describe('template state transitions', () => {
    it('should switch from loading to entries', () => {
      mockDocsService.isLoading = true;
      mockDocsService.entries = [];
      fixture.detectChanges();

      let skeletons = fixture.nativeElement.querySelectorAll('ion-skeleton-text');
      expect(skeletons.length).toBe(5);

      mockDocsService.isLoading = false;
      mockDocsService.entries = [
        { name: 'test.pdf', fullPath: 'Documents/test.pdf', isFolder: false },
      ];
      fixture.detectChanges();

      skeletons = fixture.nativeElement.querySelectorAll('ion-skeleton-text');
      expect(skeletons.length).toBe(0);

      const items = fixture.nativeElement.querySelectorAll('ion-item[button]');
      expect(items.length).toBe(1);
    });

    it('should switch from loading to empty state', () => {
      mockDocsService.isLoading = true;
      fixture.detectChanges();

      expect(fixture.nativeElement.querySelector('.empty-state')).toBeFalsy();

      mockDocsService.isLoading = false;
      mockDocsService.entries = [];
      fixture.detectChanges();

      expect(fixture.nativeElement.querySelector('.empty-state')).toBeTruthy();
    });

    it('should switch from entries to empty state', () => {
      mockDocsService.isLoading = false;
      mockDocsService.entries = [
        { name: 'x.pdf', fullPath: 'Documents/x.pdf', isFolder: false },
      ];
      fixture.detectChanges();

      expect(fixture.nativeElement.querySelectorAll('ion-item[button]').length).toBe(1);

      mockDocsService.entries = [];
      fixture.detectChanges();

      expect(fixture.nativeElement.querySelectorAll('ion-item[button]').length).toBe(0);
      expect(fixture.nativeElement.querySelector('.empty-state')).toBeTruthy();
    });

    it('should switch from entries to loading', () => {
      mockDocsService.isLoading = false;
      mockDocsService.entries = [
        { name: 'x.pdf', fullPath: 'Documents/x.pdf', isFolder: false },
      ];
      fixture.detectChanges();

      expect(fixture.nativeElement.querySelectorAll('ion-item[button]').length).toBe(1);

      mockDocsService.isLoading = true;
      fixture.detectChanges();

      expect(fixture.nativeElement.querySelectorAll('ion-item[button]').length).toBe(0);
      expect(fixture.nativeElement.querySelectorAll('ion-skeleton-text').length).toBe(5);
    });

    it('should update title when switching from root to subfolder', () => {
      mockDocsService.isRoot = true;
      fixture.detectChanges();

      let title = fixture.nativeElement.querySelector('ion-title');
      expect(title.textContent).toContain('Dokumentacija');

      mockDocsService.isRoot = false;
      mockDocsService.currentFolderName = 'Uputstva';
      fixture.detectChanges();

      title = fixture.nativeElement.querySelector('ion-title');
      expect(title.textContent).toContain('Uputstva');
    });

    it('should update back button when switching from root to subfolder', () => {
      mockDocsService.isRoot = true;
      fixture.detectChanges();

      expect(fixture.nativeElement.querySelector('ion-back-button')).toBeTruthy();

      mockDocsService.isRoot = false;
      fixture.detectChanges();

      expect(fixture.nativeElement.querySelector('ion-back-button')).toBeFalsy();
      expect(fixture.nativeElement.querySelector('ion-buttons[slot="start"] ion-button')).toBeTruthy();
    });

    it('should update back button when switching from subfolder to root', () => {
      mockDocsService.isRoot = false;
      fixture.detectChanges();

      expect(fixture.nativeElement.querySelector('ion-back-button')).toBeFalsy();

      mockDocsService.isRoot = true;
      fixture.detectChanges();

      expect(fixture.nativeElement.querySelector('ion-back-button')).toBeTruthy();
    });
  });

  // ==========================================
  // Template — struktura DOM-a
  // ==========================================

  describe('template DOM structure', () => {
    beforeEach(() => {
      fixture.detectChanges();
    });

    it('should have ion-header element', () => {
      expect(fixture.nativeElement.querySelector('ion-header')).toBeTruthy();
    });

    it('should have ion-content element', () => {
      expect(fixture.nativeElement.querySelector('ion-content')).toBeTruthy();
    });

    it('should have ion-toolbar inside ion-header', () => {
      expect(fixture.nativeElement.querySelector('ion-header ion-toolbar')).toBeTruthy();
    });

    it('should have ion-title inside ion-toolbar', () => {
      expect(fixture.nativeElement.querySelector('ion-toolbar ion-title')).toBeTruthy();
    });

    it('should have start slot buttons', () => {
      expect(fixture.nativeElement.querySelector('ion-buttons[slot="start"]')).toBeTruthy();
    });

    it('should have end slot buttons', () => {
      expect(fixture.nativeElement.querySelector('ion-buttons[slot="end"]')).toBeTruthy();
    });
  });

  // ==========================================
  // Template — skeleton detalji
  // ==========================================

  describe('template skeleton details', () => {
    beforeEach(() => {
      mockDocsService.isLoading = true;
      fixture.detectChanges();
    });

    it('should have icon-only slot on skeleton icons', () => {
      const icons = fixture.nativeElement.querySelectorAll('ion-list ion-item ion-icon');
      icons.forEach((icon: any) => {
        expect(icon.getAttribute('slot')).toBe('start');
      });
    });

    it('should wrap skeleton text inside ion-label', () => {
      const labels = fixture.nativeElement.querySelectorAll('ion-list ion-item ion-label');
      expect(labels.length).toBe(5);
      labels.forEach((label: any) => {
        expect(label.querySelector('ion-skeleton-text')).toBeTruthy();
      });
    });

    it('should have ion-list wrapper for skeletons', () => {
      const list = fixture.nativeElement.querySelector('ion-content ion-list');
      expect(list).toBeTruthy();
      expect(list.querySelectorAll('ion-skeleton-text').length).toBe(5);
    });
  });

  // ==========================================
  // Template — subfolder back button detalji
  // ==========================================

  describe('template subfolder back button details', () => {
    beforeEach(() => {
      mockDocsService.isRoot = false;
      fixture.detectChanges();
    });

    it('should have icon with slot="icon-only"', () => {
      const icon = fixture.nativeElement.querySelector('ion-buttons[slot="start"] ion-button ion-icon');
      expect(icon.getAttribute('slot')).toBe('icon-only');
    });

    it('should not call loadFolder when clicking back', () => {
      const arrowButton = fixture.nativeElement.querySelector('ion-buttons[slot="start"] ion-button');
      arrowButton.click();

      expect(mockDocsService.loadFolder).not.toHaveBeenCalled();
    });

    it('should not call openFile when clicking back', () => {
      const arrowButton = fixture.nativeElement.querySelector('ion-buttons[slot="start"] ion-button');
      arrowButton.click();

      expect(mockDocsService.openFile).not.toHaveBeenCalled();
    });
  });

  // ==========================================
  // ionViewWillEnter — višestruki pozivi
  // ==========================================

  describe('ionViewWillEnter multiple calls', () => {
    it('should call loadFolder on each view enter', () => {
      component.ionViewWillEnter();
      component.ionViewWillEnter();
      component.ionViewWillEnter();

      expect(mockDocsService.loadFolder).toHaveBeenCalledTimes(3);
    });
  });

  // ==========================================
  // Interakcije — mešovite operacije
  // ==========================================

  describe('mixed interactions', () => {
    it('should handle folder click followed by file click', () => {
      const folder: DocEntry = { name: 'F', fullPath: 'Documents/F', isFolder: true };
      const file: DocEntry = { name: 'x.pdf', fullPath: 'Documents/x.pdf', isFolder: false };

      component.onEntryClick(folder);
      component.onEntryClick(file);

      expect(mockDocsService.loadFolder).toHaveBeenCalledWith('Documents/F');
      expect(mockDocsService.openFile).toHaveBeenCalledWith(file);
    });

    it('should handle file click followed by folder click', () => {
      const file: DocEntry = { name: 'x.pdf', fullPath: 'Documents/x.pdf', isFolder: false };
      const folder: DocEntry = { name: 'F', fullPath: 'Documents/F', isFolder: true };

      component.onEntryClick(file);
      component.onEntryClick(folder);

      expect(mockDocsService.openFile).toHaveBeenCalledTimes(1);
      expect(mockDocsService.loadFolder).toHaveBeenCalledTimes(1);
    });

    it('should handle clicking same folder twice', () => {
      const folder: DocEntry = { name: 'F', fullPath: 'Documents/F', isFolder: true };

      component.onEntryClick(folder);
      component.onEntryClick(folder);

      expect(mockDocsService.loadFolder).toHaveBeenCalledTimes(2);
    });

    it('should handle clicking same file twice', () => {
      const file: DocEntry = { name: 'x.pdf', fullPath: 'Documents/x.pdf', isFolder: false };

      component.onEntryClick(file);
      component.onEntryClick(file);

      expect(mockDocsService.openFile).toHaveBeenCalledTimes(2);
    });

    it('should handle goBack called multiple times', () => {
      component.goBack();
      component.goBack();

      expect(mockDocsService.goBack).toHaveBeenCalledTimes(2);
    });

    it('should handle entry click then goBack', () => {
      const folder: DocEntry = { name: 'F', fullPath: 'Documents/F', isFolder: true };

      component.onEntryClick(folder);
      component.goBack();

      expect(mockDocsService.loadFolder).toHaveBeenCalledWith('Documents/F');
      expect(mockDocsService.goBack).toHaveBeenCalledTimes(1);
    });
  });

  // ==========================================
  // Template — entries list wrapper
  // ==========================================

  describe('template entries list structure', () => {
    it('should wrap entries in ion-list', () => {
      mockDocsService.isLoading = false;
      mockDocsService.entries = [
        { name: 'test.pdf', fullPath: 'Documents/test.pdf', isFolder: false },
      ];
      fixture.detectChanges();

      const list = fixture.nativeElement.querySelectorAll('ion-content ion-list');
      const buttonItems = list[0]?.querySelectorAll('ion-item[button]');
      expect(buttonItems?.length).toBe(1);
    });

    it('should not wrap empty state in ion-list', () => {
      mockDocsService.isLoading = false;
      mockDocsService.entries = [];
      fixture.detectChanges();

      const emptyState = fixture.nativeElement.querySelector('.empty-state');
      expect(emptyState).toBeTruthy();
      expect(emptyState.closest('ion-list')).toBeFalsy();
    });
  });

  // ==========================================
  // Template — mutual exclusivity (tri stanja)
  // ==========================================

  describe('template mutual exclusivity', () => {
    it('loading: shows skeleton, hides entries, hides empty', () => {
      mockDocsService.isLoading = true;
      mockDocsService.entries = [];
      fixture.detectChanges();

      expect(fixture.nativeElement.querySelectorAll('ion-skeleton-text').length).toBe(5);
      expect(fixture.nativeElement.querySelectorAll('ion-item[button]').length).toBe(0);
      expect(fixture.nativeElement.querySelector('.empty-state')).toBeFalsy();
    });

    it('has entries: shows entries, hides skeleton, hides empty', () => {
      mockDocsService.isLoading = false;
      mockDocsService.entries = [
        { name: 'a.pdf', fullPath: 'Documents/a.pdf', isFolder: false },
      ];
      fixture.detectChanges();

      expect(fixture.nativeElement.querySelectorAll('ion-skeleton-text').length).toBe(0);
      expect(fixture.nativeElement.querySelectorAll('ion-item[button]').length).toBe(1);
      expect(fixture.nativeElement.querySelector('.empty-state')).toBeFalsy();
    });

    it('empty: shows empty, hides skeleton, hides entries', () => {
      mockDocsService.isLoading = false;
      mockDocsService.entries = [];
      fixture.detectChanges();

      expect(fixture.nativeElement.querySelectorAll('ion-skeleton-text').length).toBe(0);
      expect(fixture.nativeElement.querySelectorAll('ion-item[button]').length).toBe(0);
      expect(fixture.nativeElement.querySelector('.empty-state')).toBeTruthy();
    });

    it('loading with existing entries: shows skeleton only', () => {
      mockDocsService.isLoading = true;
      mockDocsService.entries = [
        { name: 'x.pdf', fullPath: 'Documents/x.pdf', isFolder: false },
      ];
      fixture.detectChanges();

      expect(fixture.nativeElement.querySelectorAll('ion-skeleton-text').length).toBe(5);
      expect(fixture.nativeElement.querySelectorAll('ion-item[button]').length).toBe(0);
      expect(fixture.nativeElement.querySelector('.empty-state')).toBeFalsy();
    });
  });

  // ==========================================
  // EXPANSION — onEntryClick parameterized
  // ==========================================

  describe('onEntryClick — folder paths (parameterized)', () => {
    const folderPaths: Array<{ name: string; fullPath: string }> = [
      { name: 'Root Folder', fullPath: 'Documents/Root Folder' },
      { name: 'Level1', fullPath: 'Documents/Level1' },
      { name: 'Level2', fullPath: 'Documents/Level1/Level2' },
      { name: 'Level3', fullPath: 'Documents/Level1/Level2/Level3' },
      { name: 'Deep', fullPath: 'Documents/A/B/C/D/E/Deep' },
      { name: 'Folder with spaces', fullPath: 'Documents/Folder with spaces' },
      { name: 'Folder (2024)', fullPath: 'Documents/Folder (2024)' },
      { name: 'šumski', fullPath: 'Documents/šumski' },
    ];

    folderPaths.forEach(({ name, fullPath }) => {
      it(`should call loadFolder with "${fullPath}" when clicking folder "${name}"`, () => {
        const folder: DocEntry = { name, fullPath, isFolder: true };
        component.onEntryClick(folder);
        expect(mockDocsService.loadFolder).toHaveBeenCalledWith(fullPath);
      });

      it(`should NOT call openFile when clicking folder "${name}"`, () => {
        const folder: DocEntry = { name, fullPath, isFolder: true };
        component.onEntryClick(folder);
        expect(mockDocsService.openFile).not.toHaveBeenCalled();
      });
    });
  });

  describe('onEntryClick — file paths (parameterized)', () => {
    const filePaths: Array<{ name: string; fullPath: string }> = [
      { name: 'document.pdf', fullPath: 'Documents/document.pdf' },
      { name: 'manual.docx', fullPath: 'Documents/manual.docx' },
      { name: 'image.jpg', fullPath: 'Documents/image.jpg' },
      { name: 'deep-file.pdf', fullPath: 'Documents/A/B/C/deep-file.pdf' },
      { name: 'file with spaces.pdf', fullPath: 'Documents/file with spaces.pdf' },
      { name: 'šema.pdf', fullPath: 'Documents/šema.pdf' },
      { name: 'file.v2.1.pdf', fullPath: 'Documents/file.v2.1.pdf' },
    ];

    filePaths.forEach(({ name, fullPath }) => {
      it(`should call openFile for file "${name}"`, () => {
        const file: DocEntry = { name, fullPath, isFolder: false };
        component.onEntryClick(file);
        expect(mockDocsService.openFile).toHaveBeenCalledWith(file);
      });

      it(`should NOT call loadFolder for file "${name}"`, () => {
        const file: DocEntry = { name, fullPath, isFolder: false };
        component.onEntryClick(file);
        expect(mockDocsService.loadFolder).not.toHaveBeenCalled();
      });
    });
  });

  // ==========================================
  // EXPANSION — folder name in title (parameterized)
  // ==========================================

  describe('template — subfolder names in title (parameterized)', () => {
    const folderNames = [
      'Uputstva',
      'Katalozi',
      'My Documents',
      'Folder (2024)',
      'šumski dokumenti',
      'UPPERCASE',
      'mixedCase',
    ];

    folderNames.forEach((name) => {
      it(`should show folder name "${name}" as title when in subfolder`, () => {
        mockDocsService.isRoot = false;
        mockDocsService.currentFolderName = name;
        fixture.detectChanges();

        const title = fixture.nativeElement.querySelector('ion-title');
        expect(title.textContent).toContain(name);
      });
    });
  });

  // ==========================================
  // EXPANSION — entry counts in template
  // ==========================================

  describe('template — various entry counts rendered', () => {
    const entryCounts = [1, 2, 5, 10, 15, 20];

    entryCounts.forEach((count) => {
      it(`should render exactly ${count} folder items`, () => {
        mockDocsService.isLoading = false;
        mockDocsService.entries = Array.from({ length: count }, (_, i) => ({
          name: `Folder${i}`,
          fullPath: `Documents/Folder${i}`,
          isFolder: true,
        }));
        fixture.detectChanges();

        const items = fixture.nativeElement.querySelectorAll('ion-item[button]');
        expect(items.length).toBe(count);
      });

      it(`should render exactly ${count} file items`, () => {
        mockDocsService.isLoading = false;
        mockDocsService.entries = Array.from({ length: count }, (_, i) => ({
          name: `file${i}.pdf`,
          fullPath: `Documents/file${i}.pdf`,
          isFolder: false,
        }));
        fixture.detectChanges();

        const items = fixture.nativeElement.querySelectorAll('ion-item[button]');
        expect(items.length).toBe(count);
      });
    });
  });
});
