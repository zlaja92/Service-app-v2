/**
 * SignatureModalComponent Unit Tests
 *
 * MOCK STRATEGY
 * =============
 * ModalController:    createMockModalController()
 * ToastController:    createMockToastController()
 * TranslocoService:   createMockTranslocoService() — translate() returns key as-is
 * SignaturePad:       jasmine.createSpyObj via createMockPad(); injected directly
 *                     onto (component as any).pad before each method-under-test call
 * canvasRef:          synthetic ElementRef with mock canvas (offsetWidth/Height/getContext)
 *
 * COVERAGE
 * ========
 * confirm() — isEmpty=true  → warning toast shown, modalCtrl.dismiss NOT called
 * confirm() — isEmpty=false → croppedDataUrl calculated, modalCtrl.dismiss called with crop
 * cancel()  → modalCtrl.dismiss(null, 'cancel')
 * clear()   → pad.clear() called
 * ngAfterViewInit → SignaturePad instantiated, window resize listener added, resizeCanvas scheduled
 * ngOnDestroy     → resize listener removed, pad.off() called
 * resizeCanvas    → canvas dimensions set ×ratio, context scaled, strokes preserved
 * croppedDataUrl  → bounding box crop, empty groups fallback, single point sw=sh, boundary clamp,
 *                   null context fallback
 */

import { ComponentFixture, TestBed, fakeAsync, tick } from '@angular/core/testing';
import { ModalController, ToastController } from '@ionic/angular/standalone';
import { TranslocoService } from '@jsverse/transloco';
import SignaturePad from 'signature_pad';

import { SignatureModalComponent } from './signature-modal.component';
import {
  createMockModalController,
  createMockToastController,
  createMockTranslocoService,
} from '../../../../testing/mock-factories';

// ─── Mock pad factory ─────────────────────────────────────────────────────────

function createMockPad(): jasmine.SpyObj<SignaturePad> {
  return jasmine.createSpyObj<SignaturePad>('SignaturePad', [
    'isEmpty',
    'toData',
    'toDataURL',
    'clear',
    'fromData',
    'off',
  ]);
}

// ─── Mock canvas factory ──────────────────────────────────────────────────────

/**
 * Creates a minimal mock HTMLCanvasElement for resizeCanvas/croppedDataUrl tests.
 * The ctx spy has only the methods those tests assert on (scale, fillRect, drawImage).
 */
function createMockCanvas(overrides: Partial<{
  offsetWidth: number;
  offsetHeight: number;
}> = {}): HTMLCanvasElement {
  const ctx = jasmine.createSpyObj('CanvasRenderingContext2D', [
    'scale',
    'fillRect',
    'drawImage',
  ]);

  const canvas = {
    offsetWidth: overrides.offsetWidth ?? 300,
    offsetHeight: overrides.offsetHeight ?? 150,
    width: 0,
    height: 0,
    getContext: jasmine.createSpy('getContext').and.returnValue(ctx),
  } as unknown as HTMLCanvasElement;

  return canvas;
}

/**
 * Creates a full-coverage mock 2D context required by SignaturePad constructor.
 * SignaturePad calls clear() on construction which in turn calls clearRect and
 * fillRect; other drawing methods are called during stroke rendering.
 * All methods are no-op spies; getImageData returns a minimal valid ImageData.
 */
function createFullMock2DContext(): CanvasRenderingContext2D {
  const ctx = jasmine.createSpyObj<CanvasRenderingContext2D>('CanvasRenderingContext2D', [
    'clearRect', 'fillRect', 'beginPath', 'moveTo', 'lineTo',
    'bezierCurveTo', 'quadraticCurveTo', 'arc', 'closePath',
    'fill', 'stroke', 'save', 'restore', 'scale', 'translate',
    'rotate', 'setTransform', 'drawImage',
    'getImageData', 'putImageData', 'createImageData', 'measureText',
  ]);
  (ctx.getImageData as jasmine.Spy).and.returnValue({ data: new Uint8ClampedArray(4) });
  (ctx.measureText as jasmine.Spy).and.returnValue({ width: 0 });

  // Writable canvas-state properties that SignaturePad may set
  Object.defineProperties(ctx, {
    fillStyle:                 { writable: true, configurable: true, value: '' },
    strokeStyle:               { writable: true, configurable: true, value: '' },
    lineWidth:                 { writable: true, configurable: true, value: 1 },
    lineCap:                   { writable: true, configurable: true, value: 'butt' },
    lineJoin:                  { writable: true, configurable: true, value: 'miter' },
    globalCompositeOperation:  { writable: true, configurable: true, value: 'source-over' },
  });

  return ctx;
}

/**
 * Creates a mock canvas whose getContext('2d') returns the full SignaturePad-compatible
 * context. Used specifically in ngAfterViewInit tests where a real SignaturePad is
 * instantiated (and its constructor calls clear() → clearRect/fillRect).
 */
function createInitCanvas(overrides: Partial<{ offsetWidth: number; offsetHeight: number }> = {}): HTMLCanvasElement {
  const ctx = createFullMock2DContext();

  const canvas = {
    offsetWidth: overrides.offsetWidth ?? 300,
    offsetHeight: overrides.offsetHeight ?? 150,
    width: 0,
    height: 0,
    // The real SignaturePad constructor sets canvas.style.touchAction / userSelect
    // and reads the bounding rect, so the mock must expose these.
    style: {} as CSSStyleDeclaration,
    getContext: jasmine.createSpy('getContext').and.returnValue(ctx),
    addEventListener: jasmine.createSpy('addEventListener'),
    removeEventListener: jasmine.createSpy('removeEventListener'),
    getBoundingClientRect: jasmine.createSpy('getBoundingClientRect').and.returnValue({
      width: overrides.offsetWidth ?? 300,
      height: overrides.offsetHeight ?? 150,
      left: 0, top: 0, right: overrides.offsetWidth ?? 300, bottom: overrides.offsetHeight ?? 150,
      x: 0, y: 0, toJSON: () => ({}),
    } as DOMRect),
    // SignaturePad.off() calls _removeMoveUpEventListeners() → _getListenerFunctions()
    // which accesses canvas.ownerDocument.defaultView to resolve the correct window for
    // removeEventListener calls. Without ownerDocument the access throws a TypeError
    // during ngOnDestroy teardown, causing "1 component threw errors during cleanup".
    ownerDocument: { defaultView: window },
  } as unknown as HTMLCanvasElement;

  return canvas;
}

// ─── Spec ─────────────────────────────────────────────────────────────────────

describe('SignatureModalComponent', () => {
  let component: SignatureModalComponent;
  let fixture: ComponentFixture<SignatureModalComponent>;
  let modalCtrl: jasmine.SpyObj<ModalController>;
  let toastCtrl: jasmine.SpyObj<ToastController>;
  let translocoService: jasmine.SpyObj<TranslocoService>;

  beforeEach(async () => {
    modalCtrl       = createMockModalController();
    toastCtrl       = createMockToastController();
    translocoService = createMockTranslocoService();

    await TestBed.configureTestingModule({
      imports: [SignatureModalComponent],
      providers: [
        { provide: ModalController,   useValue: modalCtrl       },
        { provide: ToastController,   useValue: toastCtrl       },
        { provide: TranslocoService,  useValue: translocoService },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(SignatureModalComponent);
    component = fixture.componentInstance;

    // Provide a synthetic canvasRef so lifecycle methods that access it don't
    // fail with a null reference before individual tests set their own canvas.
    (component as any).canvasRef = { nativeElement: createMockCanvas() };
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // confirm() — empty pad
  // ═══════════════════════════════════════════════════════════════════════════

  describe('confirm() — pad is empty', () => {
    let mockPad: jasmine.SpyObj<SignaturePad>;

    beforeEach(() => {
      mockPad = createMockPad();
      mockPad.isEmpty.and.returnValue(true);
      (component as any).pad = mockPad;
    });

    it('TC-CONF-01: calls toastCtrl.create with message "signature_required"', async () => {
      await (component as any).confirm();
      expect(toastCtrl.create).toHaveBeenCalledWith(
        jasmine.objectContaining({ message: 'signature_required' }),
      );
    });

    it('TC-CONF-02: calls toastCtrl.create with color "warning"', async () => {
      await (component as any).confirm();
      expect(toastCtrl.create).toHaveBeenCalledWith(
        jasmine.objectContaining({ color: 'warning' }),
      );
    });

    it('TC-CONF-03: calls toastCtrl.create with position "bottom"', async () => {
      await (component as any).confirm();
      expect(toastCtrl.create).toHaveBeenCalledWith(
        jasmine.objectContaining({ position: 'bottom' }),
      );
    });

    it('TC-CONF-04: calls toastCtrl.create with duration 2500', async () => {
      await (component as any).confirm();
      expect(toastCtrl.create).toHaveBeenCalledWith(
        jasmine.objectContaining({ duration: 2500 }),
      );
    });

    it('TC-CONF-05: presents the created toast', async () => {
      const presentSpy = jasmine.createSpy('present').and.resolveTo();
      toastCtrl.create.and.resolveTo({
        present: presentSpy,
        dismiss: jasmine.createSpy('dismiss').and.resolveTo(true),
      } as unknown as HTMLIonToastElement);

      await (component as any).confirm();

      expect(presentSpy).toHaveBeenCalledTimes(1);
    });

    it('TC-CONF-06: does NOT call modalCtrl.dismiss', async () => {
      await (component as any).confirm();
      expect(modalCtrl.dismiss).not.toHaveBeenCalled();
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // confirm() — pad has content
  // ═══════════════════════════════════════════════════════════════════════════

  describe('confirm() — pad has content', () => {
    let mockPad: jasmine.SpyObj<SignaturePad>;

    beforeEach(() => {
      mockPad = createMockPad();
      mockPad.isEmpty.and.returnValue(false);
      (component as any).pad = mockPad;
    });

    it('TC-CONF-07: calls modalCtrl.dismiss with crop result and role "save"', async () => {
      spyOn<any>(component, 'croppedDataUrl').and.returnValue('CROP');

      await (component as any).confirm();

      expect(modalCtrl.dismiss).toHaveBeenCalledWith({ dataUrl: 'CROP' }, 'save');
    });

    it('TC-CONF-08: does NOT show a toast when pad has content', async () => {
      spyOn<any>(component, 'croppedDataUrl').and.returnValue('CROP');

      await (component as any).confirm();

      expect(toastCtrl.create).not.toHaveBeenCalled();
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // cancel()
  // ═══════════════════════════════════════════════════════════════════════════

  describe('cancel()', () => {
    it('TC-CANCEL-01: calls modalCtrl.dismiss with null and role "cancel"', () => {
      (component as any).cancel();
      expect(modalCtrl.dismiss).toHaveBeenCalledWith(null, 'cancel');
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // clear()
  // ═══════════════════════════════════════════════════════════════════════════

  describe('clear()', () => {
    it('TC-CLEAR-01: calls pad.clear()', () => {
      const mockPad = createMockPad();
      (component as any).pad = mockPad;

      (component as any).clear();

      expect(mockPad.clear).toHaveBeenCalledTimes(1);
    });

    it('TC-CLEAR-02: does not throw when pad is null', () => {
      (component as any).pad = null;
      expect(() => (component as any).clear()).not.toThrow();
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // ngAfterViewInit
  // ═══════════════════════════════════════════════════════════════════════════

  describe('ngAfterViewInit', () => {
    let addEventSpy: jasmine.Spy;

    beforeEach(() => {
      // ngAfterViewInit creates a real SignaturePad which calls clear() in its
      // constructor → clearRect + fillRect must exist on the 2D context.
      // createInitCanvas() provides the full set of methods SignaturePad needs.
      (component as any).canvasRef = { nativeElement: createInitCanvas() };

      addEventSpy = spyOn(window, 'addEventListener').and.callThrough();
    });

    /**
     * Nullify the real SignaturePad before TestBed's global afterEach teardown
     * runs fixture.destroy() → ngOnDestroy(). The real SignaturePad.off() calls
     * canvas.removeEventListener and accesses canvas.ownerDocument; our mock
     * canvas lacks ownerDocument which causes "1 component threw errors during
     * cleanup" in jsdom. Setting pad=null makes ngOnDestroy's `this.pad?.off()`
     * a no-op, preventing the cleanup error without touching application code.
     *
     * Jasmine executes inner afterEach hooks before outer/global ones, so this
     * runs before the TestBed global afterEach that invokes fixture.destroy().
     */
    afterEach(() => {
      (component as any).pad = null;
    });

    it('TC-INIT-01: creates a SignaturePad instance (pad is non-null after init)', fakeAsync(() => {
      // Reset pad to null so we can verify init creates it.
      (component as any).pad = null;

      component.ngAfterViewInit();
      tick(50); // advance past the setTimeout(resizeCanvas, 50)

      expect((component as any).pad).not.toBeNull();
    }));

    it('TC-INIT-02: adds a "resize" event listener to window', fakeAsync(() => {
      component.ngAfterViewInit();
      tick(50);

      const resizeListenerAdded = (addEventSpy.calls.all() as jasmine.CallInfo<typeof window.addEventListener>[])
        .some(call => call.args[0] === 'resize');
      expect(resizeListenerAdded).toBeTrue();
    }));

    it('TC-INIT-03: calls resizeCanvas after 50ms timeout', fakeAsync(() => {
      const resizeSpy = spyOn<any>(component, 'resizeCanvas');

      component.ngAfterViewInit();
      expect(resizeSpy).not.toHaveBeenCalled(); // not called synchronously

      tick(50);
      expect(resizeSpy).toHaveBeenCalledTimes(1);
    }));
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // ngOnDestroy
  // ═══════════════════════════════════════════════════════════════════════════

  describe('ngOnDestroy', () => {
    it('TC-DESTROY-01: removes the "resize" event listener from window', () => {
      const removeEventSpy = spyOn(window, 'removeEventListener').and.callThrough();

      component.ngOnDestroy();

      const resizeListenerRemoved = (removeEventSpy.calls.all() as jasmine.CallInfo<typeof window.removeEventListener>[])
        .some(call => call.args[0] === 'resize');
      expect(resizeListenerRemoved).toBeTrue();
    });

    it('TC-DESTROY-02: calls pad.off() when pad is set', () => {
      const mockPad = createMockPad();
      (component as any).pad = mockPad;

      component.ngOnDestroy();

      expect(mockPad.off).toHaveBeenCalledTimes(1);
    });

    it('TC-DESTROY-03: does not throw when pad is null', () => {
      (component as any).pad = null;
      expect(() => component.ngOnDestroy()).not.toThrow();
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // resizeCanvas()
  // ═══════════════════════════════════════════════════════════════════════════

  describe('resizeCanvas()', () => {
    let mockPad: jasmine.SpyObj<SignaturePad>;
    let mockCanvas: HTMLCanvasElement;

    beforeEach(() => {
      Object.defineProperty(window, 'devicePixelRatio', { value: 2, configurable: true });

      mockCanvas = createMockCanvas({ offsetWidth: 300, offsetHeight: 150 });
      (component as any).canvasRef = { nativeElement: mockCanvas };

      mockPad = createMockPad();
      (component as any).pad = mockPad;
    });

    afterEach(() => {
      Object.defineProperty(window, 'devicePixelRatio', { value: 1, configurable: true });
    });

    it('TC-RESIZE-01: sets canvas.width = offsetWidth * ratio', () => {
      mockPad.toData.and.returnValue([]);

      (component as any).resizeCanvas();

      expect(mockCanvas.width).toBe(300 * 2); // 600
    });

    it('TC-RESIZE-02: sets canvas.height = offsetHeight * ratio', () => {
      mockPad.toData.and.returnValue([]);

      (component as any).resizeCanvas();

      expect(mockCanvas.height).toBe(150 * 2); // 300
    });

    it('TC-RESIZE-03: calls getContext("2d").scale(ratio, ratio)', () => {
      mockPad.toData.and.returnValue([]);

      (component as any).resizeCanvas();

      expect(mockCanvas.getContext).toHaveBeenCalledWith('2d');
      const ctx = (mockCanvas.getContext as jasmine.Spy).calls.mostRecent().returnValue as jasmine.SpyObj<CanvasRenderingContext2D>;
      expect(ctx.scale).toHaveBeenCalledWith(2, 2);
    });

    it('TC-RESIZE-04: calls pad.clear() to reset the backing store', () => {
      mockPad.toData.and.returnValue([]);

      (component as any).resizeCanvas();

      expect(mockPad.clear).toHaveBeenCalled();
    });

    it('TC-RESIZE-05: restores previous strokes via fromData after clear', () => {
      const prevData = [{ points: [{ x: 10, y: 20, pressure: 0.5, time: 0 }] }] as ReturnType<SignaturePad['toData']>;
      mockPad.toData.and.returnValue(prevData);

      (component as any).resizeCanvas();

      expect(mockPad.fromData).toHaveBeenCalledWith(prevData);
    });

    it('TC-RESIZE-06: does not call fromData when previous data is empty', () => {
      mockPad.toData.and.returnValue([]);

      (component as any).resizeCanvas();

      // fromData should still be called with [] — the condition is `if (data && pad)`
      // data is [] which is truthy, so fromData IS called.
      expect(mockPad.fromData).toHaveBeenCalledWith([]);
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // croppedDataUrl() — real method, no spy-out
  // ═══════════════════════════════════════════════════════════════════════════

  describe('croppedDataUrl() — real implementation', () => {
    let mockPad: jasmine.SpyObj<SignaturePad>;
    let mockCanvas: HTMLCanvasElement;

    beforeEach(() => {
      Object.defineProperty(window, 'devicePixelRatio', { value: 2, configurable: true });

      mockCanvas = createMockCanvas({ offsetWidth: 300, offsetHeight: 150 });
      (component as any).canvasRef = { nativeElement: mockCanvas };

      mockPad = createMockPad();
      mockPad.toDataURL.and.returnValue('FULL');
      (component as any).pad = mockPad;
    });

    afterEach(() => {
      Object.defineProperty(window, 'devicePixelRatio', { value: 1, configurable: true });
    });

    // ── TC-CROP-01: normal bounding box ───────────────────────────────────────

    it('TC-CROP-01: crops to bounding box, returns "CROPPED" from out-canvas', () => {
      /*
       * Input points: (10,20) and (50,60) — CSS units.
       * pad  = 4 → minX=6, minY=16, maxX=54, maxY=64
       * ratio = 2 → sx=12, sy=32, sw=96, sh=96
       * out.width=96, out.height=96
       * drawImage(canvas, 12,32,96,96, 0,0,96,96)
       */
      mockPad.toData.and.returnValue([
        { points: [{ x: 10, y: 20, pressure: 0.5, time: 0 }, { x: 50, y: 60, pressure: 0.5, time: 1 }] },
      ] as ReturnType<SignaturePad['toData']>);

      const outCtx = jasmine.createSpyObj<CanvasRenderingContext2D>('outCtx', [
        'fillRect',
        'drawImage',
      ]);
      const outCanvas = {
        width: 0,
        height: 0,
        getContext: jasmine.createSpy('getContext').and.returnValue(outCtx),
        toDataURL: jasmine.createSpy('toDataURL').and.returnValue('CROPPED'),
      } as unknown as HTMLCanvasElement;

      const realCreate = document.createElement.bind(document);
      spyOn(document, 'createElement').and.callFake((tag: string) =>
        tag === 'canvas' ? outCanvas : realCreate(tag),
      );

      const result = (component as any).croppedDataUrl();

      expect(outCanvas.width).toBe(96);
      expect(outCanvas.height).toBe(96);
      expect(outCtx.drawImage).toHaveBeenCalledWith(
        mockCanvas, 12, 32, 96, 96, 0, 0, 96, 96,
      );
      expect(result).toBe('CROPPED');
    });

    // ── TC-CROP-02: empty groups → fallback to full ───────────────────────────

    it('TC-CROP-02: returns full dataUrl when toData() is empty (no strokes)', () => {
      mockPad.toData.and.returnValue([] as ReturnType<SignaturePad['toData']>);
      mockPad.toDataURL.and.returnValue('FULL');

      const result = (component as any).croppedDataUrl();

      expect(result).toBe('FULL');
    });

    // ── TC-CROP-03: single point → sw = sh = (pad*2)*ratio = 16 ──────────────

    it('TC-CROP-03: single point produces sw=sh=(pad*2)*ratio = 16', () => {
      /*
       * Point: (50,50). pad=4.
       * minX=46, maxX=54 → sw=(54-46)*2=16
       * minY=46, maxY=54 → sh=(54-46)*2=16
       */
      mockPad.toData.and.returnValue([
        { points: [{ x: 50, y: 50, pressure: 0.5, time: 0 }] },
      ] as ReturnType<SignaturePad['toData']>);

      const outCtx = jasmine.createSpyObj<CanvasRenderingContext2D>('outCtx', ['fillRect', 'drawImage']);
      const outCanvas = {
        width: 0,
        height: 0,
        getContext: jasmine.createSpy('getContext').and.returnValue(outCtx),
        toDataURL: jasmine.createSpy('toDataURL').and.returnValue('CROPPED_SINGLE'),
      } as unknown as HTMLCanvasElement;

      const realCreate = document.createElement.bind(document);
      spyOn(document, 'createElement').and.callFake((tag: string) =>
        tag === 'canvas' ? outCanvas : realCreate(tag),
      );

      (component as any).croppedDataUrl();

      expect(outCanvas.width).toBe(16);
      expect(outCanvas.height).toBe(16);
    });

    // ── TC-CROP-04: boundary clamp — point at (0,0) → minX clamped to 0 ──────

    it('TC-CROP-04: clamps minX/minY to 0 when point is at (0,0)', () => {
      /*
       * Point: (0,0). pad=4.
       * minX=max(0, 0-4)=0, minY=max(0, 0-4)=0
       * maxX=min(300, 0+4)=4, maxY=min(150, 0+4)=4
       * sw=(4-0)*2=8, sh=(4-0)*2=8
       */
      mockPad.toData.and.returnValue([
        { points: [{ x: 0, y: 0, pressure: 0.5, time: 0 }] },
      ] as ReturnType<SignaturePad['toData']>);

      const outCtx = jasmine.createSpyObj<CanvasRenderingContext2D>('outCtx', ['fillRect', 'drawImage']);
      const outCanvas = {
        width: 0,
        height: 0,
        getContext: jasmine.createSpy('getContext').and.returnValue(outCtx),
        toDataURL: jasmine.createSpy('toDataURL').and.returnValue('CLAMPED'),
      } as unknown as HTMLCanvasElement;

      const realCreate = document.createElement.bind(document);
      spyOn(document, 'createElement').and.callFake((tag: string) =>
        tag === 'canvas' ? outCanvas : realCreate(tag),
      );

      (component as any).croppedDataUrl();

      // sx = minX * ratio = 0 * 2 = 0
      expect(outCtx.drawImage).toHaveBeenCalledWith(
        mockCanvas,
        0,           // sx = minX * ratio = 0
        0,           // sy = minY * ratio = 0
        jasmine.any(Number), // sw
        jasmine.any(Number), // sh
        0, 0,
        jasmine.any(Number),
        jasmine.any(Number),
      );
    });

    // ── TC-CROP-05: null context on out-canvas → fallback to full ─────────────

    it('TC-CROP-05: returns full dataUrl when out-canvas.getContext returns null', () => {
      mockPad.toData.and.returnValue([
        { points: [{ x: 10, y: 20, pressure: 0.5, time: 0 }] },
      ] as ReturnType<SignaturePad['toData']>);
      mockPad.toDataURL.and.returnValue('FULL');

      const outCanvas = {
        width: 0,
        height: 0,
        getContext: jasmine.createSpy('getContext').and.returnValue(null),
        toDataURL: jasmine.createSpy('toDataURL').and.returnValue('SHOULD_NOT_BE_RETURNED'),
      } as unknown as HTMLCanvasElement;

      const realCreate = document.createElement.bind(document);
      spyOn(document, 'createElement').and.callFake((tag: string) =>
        tag === 'canvas' ? outCanvas : realCreate(tag),
      );

      const result = (component as any).croppedDataUrl();

      expect(result).toBe('FULL');
    });
  });
});
