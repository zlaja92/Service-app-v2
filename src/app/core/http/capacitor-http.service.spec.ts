import { TestBed } from '@angular/core/testing';
import { HttpOptions } from '@capacitor/core';
import { CapacitorHttpService } from './capacitor-http.service';

// ─── Mocking strategy note ────────────────────────────────────────────────────
// CapacitorHttp is a Proxy from registerPlugin(). Its get() trap intercepts all
// property access and routes to createPluginMethodWrapper(), bypassing any spy
// placed via spyOn(CapacitorHttp, 'get').
//
// CapacitorHttpPluginWeb (the web implementation behind the proxy) is defined
// in the Capacitor dist bundle but NOT exported — not accessible from outside.
//
// The only reliable interception layer in Karma/Jasmine is window.fetch, which
// CapacitorHttpPluginWeb.request() calls internally.
//
// We mock window.fetch to return a Response that the plugin parses into HttpResponse.
// ─────────────────────────────────────────────────────────────────────────────

describe('CapacitorHttpService', () => {
  let service: CapacitorHttpService;
  let fetchSpy: jasmine.Spy;

  function buildMockFetchResponse(body: unknown, status = 200, headers: Record<string, string> = {}): Response {
    const headersObj = new Headers({ 'content-type': 'application/json', ...headers });
    return new Response(JSON.stringify(body), { status, headers: headersObj });
  }

  beforeEach(() => {
    fetchSpy = spyOn(window, 'fetch').and.returnValue(
      Promise.resolve(buildMockFetchResponse({ id: 1, name: 'test' })),
    );

    TestBed.configureTestingModule({
      providers: [CapacitorHttpService],
    });

    service = TestBed.inject(CapacitorHttpService);
  });

  it('TC-CH01: get() calls CapacitorHttp.get with options and returns HttpResponse', async () => {
    const options: HttpOptions = { url: 'https://api.example.com/resource' };

    const result = await service.get(options);

    // Verify fetch was called (CapacitorHttpPluginWeb delegates to fetch)
    expect(fetchSpy).toHaveBeenCalled();
    const fetchUrl: string = fetchSpy.calls.mostRecent().args[0];
    expect(fetchUrl).toContain('api.example.com/resource');
    // Verify response structure
    expect(result.status).toBe(200);
    expect(result.data).toEqual({ id: 1, name: 'test' });
  });

  it('TC-CH02: passes through additional HttpOptions (headers, params) to underlying fetch', async () => {
    const options: HttpOptions = {
      url: 'https://api.example.com/items',
      headers: { Authorization: 'Bearer token123', 'X-Custom': 'value' },
      params: { page: '1', limit: '20' },
    };

    const result = await service.get(options);

    expect(fetchSpy).toHaveBeenCalled();
    // Params should be appended to the URL
    const fetchUrl: string = fetchSpy.calls.mostRecent().args[0];
    expect(fetchUrl).toContain('api.example.com/items');
    expect(fetchUrl).toContain('page=1');
    expect(fetchUrl).toContain('limit=20');
    // Result is a valid HttpResponse shape
    expect(result.status).toBe(200);
  });

  it('TC-CH03: propagates error when CapacitorHttp.get rejects', async () => {
    const networkError = new TypeError('Failed to fetch');
    fetchSpy.and.returnValue(Promise.reject(networkError));

    await expectAsync(service.get({ url: 'https://api.example.com/fail' })).toBeRejected();
  });
});
