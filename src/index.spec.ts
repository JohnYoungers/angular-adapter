import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

const STATE_KEY = '__NATIVE_FEDERATION_ADAPTER_STATE__';

const mockInitFederation = vi.fn();
const mockUseShimImportMap = vi.fn();
const mockUseDefaultImportMap = vi.fn();
const mockConsoleLogger = vi.fn();
const mockGlobalThisStorageEntry = vi.fn();

vi.mock('@softarc/native-federation-orchestrator', () => ({
  initFederation: mockInitFederation,
  NativeFederationResult: undefined,
}));

vi.mock('@softarc/native-federation-orchestrator/options', () => ({
  useShimImportMap: mockUseShimImportMap,
  useDefaultImportMap: mockUseDefaultImportMap,
  consoleLogger: mockConsoleLogger,
  globalThisStorageEntry: mockGlobalThisStorageEntry,
  LogType: undefined,
}));

describe('initFederation', () => {
  beforeEach(() => {
    vi.resetModules();
    delete (globalThis as Record<string, unknown>)[STATE_KEY];
    mockInitFederation.mockReset();
    mockUseShimImportMap.mockReset();
    mockUseDefaultImportMap.mockReset();
    mockConsoleLogger.mockReset();
    mockGlobalThisStorageEntry.mockReset();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('passes sse: true to orchestrator when options.sse is true', async () => {
    mockInitFederation.mockReturnValue(Promise.resolve({}));
    mockUseShimImportMap.mockReturnValue({});
    const { initFederation } = await import('./index.js');

    initFederation({}, { sse: true });

    const options = mockInitFederation.mock.calls[0]![1];
    expect(options.sse).toBe(true);
  });

  it('passes sse: false to orchestrator when options.sse is false', async () => {
    mockInitFederation.mockReturnValue(Promise.resolve({}));
    mockUseShimImportMap.mockReturnValue({});
    const { initFederation } = await import('./index.js');

    initFederation({}, { sse: false });

    const options = mockInitFederation.mock.calls[0]![1];
    expect(options.sse).toBe(false);
  });

  it('passes sse: undefined to orchestrator when options.sse is not set', async () => {
    mockInitFederation.mockReturnValue(Promise.resolve({}));
    mockUseShimImportMap.mockReturnValue({});
    const { initFederation } = await import('./index.js');

    initFederation({}, {});

    const options = mockInitFederation.mock.calls[0]![1];
    expect(options.sse).toBeUndefined();
  });

  it('does not pass sse when options is omitted', async () => {
    mockInitFederation.mockReturnValue(Promise.resolve({}));
    mockUseShimImportMap.mockReturnValue({});
    const { initFederation } = await import('./index.js');

    initFederation({});

    const options = mockInitFederation.mock.calls[0]![1];
    expect(options.sse).toBeUndefined();
  });

  it('uses the shim import map by default', async () => {
    mockInitFederation.mockReturnValue(Promise.resolve({}));
    mockUseShimImportMap.mockReturnValue({});
    mockUseDefaultImportMap.mockReturnValue({});
    const { initFederation } = await import('./index.js');

    initFederation({});

    expect(mockUseShimImportMap).toHaveBeenCalledWith({ shimMode: true });
    expect(mockUseDefaultImportMap).not.toHaveBeenCalled();
  });

  it('uses native import maps when shimMode is false', async () => {
    mockInitFederation.mockReturnValue(Promise.resolve({}));
    mockUseShimImportMap.mockReturnValue({});
    mockUseDefaultImportMap.mockReturnValue({});
    const { initFederation } = await import('./index.js');

    initFederation({}, { shimMode: false });

    expect(mockUseDefaultImportMap).toHaveBeenCalledTimes(1);
    expect(mockUseShimImportMap).not.toHaveBeenCalled();
  });

  it('uses the shim import map when shimMode is true', async () => {
    mockInitFederation.mockReturnValue(Promise.resolve({}));
    mockUseShimImportMap.mockReturnValue({});
    mockUseDefaultImportMap.mockReturnValue({});
    const { initFederation } = await import('./index.js');

    initFederation({}, { shimMode: true });

    expect(mockUseShimImportMap).toHaveBeenCalledWith({ shimMode: true });
    expect(mockUseDefaultImportMap).not.toHaveBeenCalled();
  });
});

describe('loadRemoteModule across bundles', () => {
  beforeEach(() => {
    vi.resetModules();
    delete (globalThis as Record<string, unknown>)[STATE_KEY];
    mockInitFederation.mockReset();
    mockUseShimImportMap.mockReset();
    mockUseShimImportMap.mockReturnValue({});
  });

  it('resolves in a second copy of the module that never called initFederation', async () => {
    const loadRemoteModule = vi.fn().mockResolvedValue({ ok: true });
    mockInitFederation.mockReturnValue(Promise.resolve({ loadRemoteModule }));

    // host bundle
    const host = await import('./index.js');
    // remote bundle: separate module instance, as with Angular's skip list
    vi.resetModules();
    const remote = await import('./index.js');
    expect(remote).not.toBe(host);

    host.initFederation({});

    await expect(
      remote.loadRemoteModule('remote-b', './Component'),
    ).resolves.toEqual({ ok: true });
    expect(loadRemoteModule).toHaveBeenCalledWith('remote-b', './Component');
  });
});
