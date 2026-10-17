import { describe, it, expect, vi, beforeEach } from 'vitest';
import { logger, type NormalizedFederationConfig } from '@softarc/native-federation/internal';
import { warnFlatExternals } from './warn-flat-externals.js';

function config({
  denseExternals = true,
  ignoreUnusedDeps = true,
  shared = { '@angular/core': { includeSecondaries: true } } as object,
} = {}) {
  return { features: { denseExternals, ignoreUnusedDeps }, shared } as unknown as NormalizedFederationConfig;
}

describe('warnFlatExternals', () => {
  let warn: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    vi.restoreAllMocks();
    warn = vi.spyOn(logger, 'warn').mockImplementation(() => undefined);
  });

  it('stays silent with denseExternals and keepAll on @angular/core', () => {
    warnFlatExternals(config());
    expect(warn).not.toHaveBeenCalled();
  });

  it('warns when shared externals are published flat', () => {
    warnFlatExternals(config({ denseExternals: false }));
    expect(warn).toHaveBeenCalledOnce();
    expect(warn.mock.calls[0]![0]).toContain('denseExternals');
  });

  // Nothing shared means nothing for the orchestrator to split.
  it('stays silent when nothing is shared', () => {
    warnFlatExternals(config({ denseExternals: false, shared: {} }));
    expect(warn).not.toHaveBeenCalled();
  });

  // Without keepAll, share-utils deletes includeSecondaries from the resolved config.
  it('warns when @angular/core is shared without keepAll', () => {
    warnFlatExternals(config({ shared: { '@angular/core': {} } }));
    expect(warn).toHaveBeenCalledOnce();
    expect(warn.mock.calls[0]![0]).toContain('keepAll');
  });

  // Without pruning every secondary is published anyway.
  it('skips the keepAll hint when ignoreUnusedDeps is off', () => {
    warnFlatExternals(config({ ignoreUnusedDeps: false, shared: { '@angular/core': {} } }));
    expect(warn).not.toHaveBeenCalled();
  });

  it('skips the keepAll hint when Angular is not shared', () => {
    warnFlatExternals(config({ shared: { rxjs: {} } }));
    expect(warn).not.toHaveBeenCalled();
  });

  it('gives both hints at once', () => {
    warnFlatExternals(config({ denseExternals: false, shared: { '@angular/core': {} } }));
    expect(warn).toHaveBeenCalledTimes(2);
  });
});
