import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ActionSheetController, ModalController } from '@ionic/angular/standalone';
import { TranslocoTestingModule } from '@jsverse/transloco';

import { PhotoUploadPage } from './photo-upload.page';
import { PhotoService } from './services/photo.service';
import { CapturedPhoto } from './models/photo.model';
import { PhotoRequirement } from '../../core/config/config.model';
import { createMockModalController } from '../../testing/mock-factories';

// ─── Helper factories ─────────────────────────────────────────────────────────

function createMockPhoto(overrides: Partial<CapturedPhoto> = {}): CapturedPhoto {
  return {
    id: 'photo-id-1',
    webPath: 'blob:http://localhost/fake-path',
    uri: 'file:///fake/path/photo.jpg',
    ...overrides,
  };
}

function createMockRequirement(overrides: Partial<PhotoRequirement> = {}): PhotoRequirement {
  return {
    maxPhotos: 5,
    requiredPhotos: 1,
    requireSparePartPhotos: false,
    description: 'photo_description_key',
    ...overrides,
  };
}

interface MockPhotoService {
  photos: CapturedPhoto[];
  requirement: PhotoRequirement | null;
  canTakeMore: boolean;
  isMinimumMet: boolean;
  takePhoto: jasmine.Spy;
  pickFromGallery: jasmine.Spy;
  removePhoto: jasmine.Spy;
  setRequirement: jasmine.Spy;
  uploadPhotos: jasmine.Spy;
  clear: jasmine.Spy;
}

function createMockPhotoService(overrides: Partial<MockPhotoService> = {}): MockPhotoService {
  return {
    photos: [],
    requirement: createMockRequirement(),
    canTakeMore: true,
    isMinimumMet: false,
    takePhoto: jasmine.createSpy('takePhoto').and.resolveTo(true),
    pickFromGallery: jasmine.createSpy('pickFromGallery').and.resolveTo(true),
    removePhoto: jasmine.createSpy('removePhoto').and.stub(),
    setRequirement: jasmine.createSpy('setRequirement').and.stub(),
    uploadPhotos: jasmine.createSpy('uploadPhotos').and.resolveTo(),
    clear: jasmine.createSpy('clear').and.stub(),
    ...overrides,
  };
}

function createMockActionSheetController(): jasmine.SpyObj<ActionSheetController> {
  const mockActionSheet = {
    present: jasmine.createSpy('present').and.resolveTo(),
    dismiss: jasmine.createSpy('dismiss').and.resolveTo(true),
    onDidDismiss: jasmine.createSpy('onDidDismiss').and.resolveTo({ data: undefined, role: 'backdrop' }),
  } as unknown as HTMLIonActionSheetElement;

  const mock = jasmine.createSpyObj<ActionSheetController>('ActionSheetController', ['create', 'dismiss', 'getTop']);
  mock.create.and.resolveTo(mockActionSheet);
  mock.dismiss.and.resolveTo(true);
  mock.getTop.and.resolveTo(undefined);

  return mock;
}

// ─── Transloco translations ───────────────────────────────────────────────────

const translocoLangs = {
  sr: {
    photo_title: 'Fotografije',
    photo_take: 'Fotografisi',
    photo_gallery: 'Galerija',
    photo_cancel: 'Otkazhi',
    photo_ok: 'Potvrdi',
    photo_added: 'Dodato',
    photo_description_key: 'Opis',
  },
};

// ─── Suite ────────────────────────────────────────────────────────────────────

describe('PhotoUploadPage', () => {
  let fixture: ComponentFixture<PhotoUploadPage>;
  let component: PhotoUploadPage;
  let mockPhotoService: MockPhotoService;
  let mockModalCtrl: jasmine.SpyObj<ModalController>;
  let mockActionSheetCtrl: jasmine.SpyObj<ActionSheetController>;

  beforeEach(async () => {
    mockPhotoService = createMockPhotoService();
    mockModalCtrl = createMockModalController();
    mockActionSheetCtrl = createMockActionSheetController();

    await TestBed.configureTestingModule({
      imports: [
        PhotoUploadPage,
        TranslocoTestingModule.forRoot({
          langs: translocoLangs,
          translocoConfig: { availableLangs: ['sr'], defaultLang: 'sr' },
          preloadLangs: true,
        }),
      ],
      providers: [
        { provide: PhotoService, useValue: mockPhotoService },
        { provide: ModalController, useValue: mockModalCtrl },
        { provide: ActionSheetController, useValue: mockActionSheetCtrl },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(PhotoUploadPage);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  // ─── TC-PU-01: Component creates ─────────────────────────────────────────────

  it('TC-PU-01: should create the component', () => {
    expect(component).toBeTruthy();
  });

  // ─── TC-PU-02: onAddPhoto opens action sheet with camera + gallery options ────

  it('TC-PU-02: should open action sheet with camera and gallery buttons when onAddPhoto is called', async () => {
    await component.onAddPhoto();

    expect(mockActionSheetCtrl.create).toHaveBeenCalledTimes(1);

    const createArgs = mockActionSheetCtrl.create.calls.mostRecent().args[0] as { buttons: Array<{ icon: string }> };
    const buttonIcons = createArgs.buttons.map((b: { icon: string }) => b.icon);

    expect(buttonIcons).toContain('camera-outline');
    expect(buttonIcons).toContain('image-outline');
  });

  // ─── TC-PU-03: Action sheet "Take photo" calls PhotoService.takePhoto ─────────

  it('TC-PU-03: should call PhotoService.takePhoto when Take Photo button handler is invoked', async () => {
    await component.onAddPhoto();

    const createArgs = mockActionSheetCtrl.create.calls.mostRecent().args[0] as {
      buttons: Array<{ icon: string; handler?: () => void }>;
    };
    const cameraButton = createArgs.buttons.find((b: { icon: string }) => b.icon === 'camera-outline');

    expect(cameraButton).toBeTruthy();
    expect(cameraButton!.handler).toBeDefined();

    cameraButton!.handler!();

    // Allow microtask to flush
    await Promise.resolve();

    expect(mockPhotoService.takePhoto).toHaveBeenCalledTimes(1);
  });

  // ─── TC-PU-04: Action sheet "Gallery" calls PhotoService.pickFromGallery ─────

  it('TC-PU-04: should call PhotoService.pickFromGallery when Gallery button handler is invoked', async () => {
    await component.onAddPhoto();

    const createArgs = mockActionSheetCtrl.create.calls.mostRecent().args[0] as {
      buttons: Array<{ icon: string; handler?: () => void }>;
    };
    const galleryButton = createArgs.buttons.find((b: { icon: string }) => b.icon === 'image-outline');

    expect(galleryButton).toBeTruthy();
    expect(galleryButton!.handler).toBeDefined();

    galleryButton!.handler!();

    await Promise.resolve();

    expect(mockPhotoService.pickFromGallery).toHaveBeenCalledTimes(1);
  });

  // ─── TC-PU-05: onRemovePhoto calls PhotoService.removePhoto ──────────────────

  it('TC-PU-05: should call PhotoService.removePhoto with the given photo id', () => {
    const photoId = 'photo-abc-123';

    component.onRemovePhoto(photoId);

    expect(mockPhotoService.removePhoto).toHaveBeenCalledOnceWith(photoId);
  });

  // ─── TC-PU-06: onOk dismisses modal with ok role ──────────────────────────────

  it('TC-PU-06: should dismiss modal with null data and ok role when onOk is called', () => {
    component.onOk();

    expect(mockModalCtrl.dismiss).toHaveBeenCalledOnceWith(null, 'ok');
  });

  // ─── TC-PU-07: onDismiss dismisses modal with cancel role ────────────────────

  it('TC-PU-07: should dismiss modal with null data and cancel role when onDismiss is called', () => {
    component.onDismiss();

    expect(mockModalCtrl.dismiss).toHaveBeenCalledOnceWith(null, 'cancel');
  });

  // ─── TC-PU-08: Renders photos from PhotoService.photos ───────────────────────

  it('TC-PU-08: should render photo thumbnails for each photo in PhotoService.photos', () => {
    mockPhotoService.photos = [
      createMockPhoto({ id: 'p1', webPath: 'blob:http://localhost/p1' }),
      createMockPhoto({ id: 'p2', webPath: 'blob:http://localhost/p2' }),
      createMockPhoto({ id: 'p3', webPath: 'blob:http://localhost/p3' }),
    ];

    fixture.detectChanges();

    const thumbnails = fixture.nativeElement.querySelectorAll('.photo-thumbnail');
    expect(thumbnails.length).toBe(3);
  });

  // ─── TC-PU-09 (bonus): Hides add button when canTakeMore is false ────────────

  it('TC-PU-09: should hide the add-photo button when canTakeMore is false', () => {
    mockPhotoService.canTakeMore = false;

    fixture.detectChanges();

    const addButton = fixture.nativeElement.querySelector('.add-photo-button');
    expect(addButton).toBeNull();
  });

  // ─── TC-PU-10 (bonus): Shows add button when canTakeMore is true ─────────────

  it('TC-PU-10: should show the add-photo button when canTakeMore is true', () => {
    mockPhotoService.canTakeMore = true;

    fixture.detectChanges();

    const addButton = fixture.nativeElement.querySelector('.add-photo-button');
    expect(addButton).toBeTruthy();
  });

  // ─── TC-PU-11: Action sheet is presented after creation ──────────────────────

  it('TC-PU-11: should call present() on the action sheet after creating it', async () => {
    // Capture the mock action sheet that will be returned
    const presentSpy = jasmine.createSpy('present').and.resolveTo();
    const mockActionSheet = {
      present: presentSpy,
      dismiss: jasmine.createSpy('dismiss').and.resolveTo(true),
    } as unknown as HTMLIonActionSheetElement;
    mockActionSheetCtrl.create.and.resolveTo(mockActionSheet);

    await component.onAddPhoto();

    expect(presentSpy).toHaveBeenCalledTimes(1);
  });

  // ─── TC-PU-12: Action sheet cancel button has cancel role ────────────────────

  it('TC-PU-12: should include a cancel button with cancel role in the action sheet', async () => {
    await component.onAddPhoto();

    const createArgs = mockActionSheetCtrl.create.calls.mostRecent().args[0] as {
      buttons: Array<{ role?: string }>;
    };
    const cancelButton = createArgs.buttons.find((b: { role?: string }) => b.role === 'cancel');

    expect(cancelButton).toBeTruthy();
  });

  // ─── EXPANSION — onRemovePhoto with various photo IDs ────────────────────────

  describe('onRemovePhoto() — photo ID variations (parameterized)', () => {
    const photoIds = [
      'photo-abc-123',
      'photo-id-1',
      'xyz-999',
      'a',
      '00000000-0000-0000-0000-000000000001',
      'UPPERCASE-PHOTO-ID',
    ];

    photoIds.forEach((id) => {
      it(`should call removePhoto with id="${id}"`, () => {
        component.onRemovePhoto(id);
        expect(mockPhotoService.removePhoto).toHaveBeenCalledWith(id);
      });
    });
  });

  // ─── EXPANSION — multiple onRemovePhoto calls ─────────────────────────────────

  describe('onRemovePhoto() — multiple sequential calls', () => {
    it('should call removePhoto for each call independently', () => {
      component.onRemovePhoto('id-1');
      component.onRemovePhoto('id-2');
      component.onRemovePhoto('id-3');

      expect(mockPhotoService.removePhoto).toHaveBeenCalledTimes(3);
      expect(mockPhotoService.removePhoto).toHaveBeenCalledWith('id-1');
      expect(mockPhotoService.removePhoto).toHaveBeenCalledWith('id-2');
      expect(mockPhotoService.removePhoto).toHaveBeenCalledWith('id-3');
    });
  });

  // ─── EXPANSION — onOk and onDismiss called multiple times ────────────────────

  describe('onOk() — multiple calls', () => {
    it('should call dismiss each time onOk is called', () => {
      component.onOk();
      component.onOk();
      expect(mockModalCtrl.dismiss).toHaveBeenCalledTimes(2);
    });

    it('should always dismiss with (null, "ok")', () => {
      component.onOk();
      const calls = mockModalCtrl.dismiss.calls.allArgs();
      calls.forEach((args) => {
        expect(args[0]).toBeNull();
        expect(args[1]).toBe('ok');
      });
    });
  });

  describe('onDismiss() — multiple calls', () => {
    it('should call dismiss each time onDismiss is called', () => {
      component.onDismiss();
      component.onDismiss();
      expect(mockModalCtrl.dismiss).toHaveBeenCalledTimes(2);
    });

    it('should always dismiss with (null, "cancel")', () => {
      component.onDismiss();
      const calls = mockModalCtrl.dismiss.calls.allArgs();
      calls.forEach((args) => {
        expect(args[0]).toBeNull();
        expect(args[1]).toBe('cancel');
      });
    });
  });

  // ─── EXPANSION — photo count rendering (parameterized) ───────────────────────

  describe('photo count in template (parameterized)', () => {
    const photoCounts = [0, 1, 2, 3, 5, 8, 10];

    photoCounts.forEach((count) => {
      it(`should render ${count} photo thumbnails`, () => {
        mockPhotoService.photos = Array.from({ length: count }, (_, i) =>
          createMockPhoto({ id: `photo-${i}`, webPath: `blob:http://localhost/p${i}` }),
        );

        fixture.detectChanges();

        const thumbnails = fixture.nativeElement.querySelectorAll('.photo-thumbnail');
        expect(thumbnails.length).toBe(count);
      });
    });
  });

  // ─── EXPANSION — canTakeMore state (parameterized) ────────────────────────────

  describe('canTakeMore state transitions in template', () => {
    it('should show add button when canTakeMore switches from false to true', () => {
      mockPhotoService.canTakeMore = false;
      fixture.detectChanges();
      expect(fixture.nativeElement.querySelector('.add-photo-button')).toBeNull();

      mockPhotoService.canTakeMore = true;
      fixture.detectChanges();
      expect(fixture.nativeElement.querySelector('.add-photo-button')).toBeTruthy();
    });

    it('should hide add button when canTakeMore switches from true to false', () => {
      mockPhotoService.canTakeMore = true;
      fixture.detectChanges();
      expect(fixture.nativeElement.querySelector('.add-photo-button')).toBeTruthy();

      mockPhotoService.canTakeMore = false;
      fixture.detectChanges();
      expect(fixture.nativeElement.querySelector('.add-photo-button')).toBeNull();
    });
  });

  // ─── EXPANSION — onAddPhoto can be called multiple times ─────────────────────

  describe('onAddPhoto() — multiple calls', () => {
    it('should create action sheet each time onAddPhoto is called', async () => {
      await component.onAddPhoto();
      await component.onAddPhoto();
      await component.onAddPhoto();

      expect(mockActionSheetCtrl.create).toHaveBeenCalledTimes(3);
    });
  });
});
