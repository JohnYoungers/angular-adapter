import { describe, it, expect, vi, beforeEach } from 'vitest';
import { logger, type NormalizedFederationConfig } from '@softarc/native-federation/internal';
import { warnFlatExternals } from './warn-flat-externals.js';

function config(denseExternals: boolean, shared: object = { '@angular/core': {} }) {
  return { features: { denseExternals }, shared } as unknown as NormalizedFederationConfig;
}

describe('warnFlatExternals', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('warns when shared externals are published flat', () => {
    const warn = vi.spyOn(logger, 'warn').mockImplementation(() => undefined);
    warnFlatExternals(config(false));
    expect(warn).toHaveBeenCalledOnce();
    expect(warn.mock.calls[0]![0]).toContain('denseExternals');
  });

  it('stays silent with denseExternals', () => {
    const warn = vi.spyOn(logger, 'warn').mockImplementation(() => undefined);
    warnFlatExternals(config(true));
    expect(warn).not.toHaveBeenCalled();
  });

  // Nothing shared means nothing for the orchestrator to split.
  it('stays silent when nothing is shared', () => {
    const warn = vi.spyOn(logger, 'warn').mockImplementation(() => undefined);
    warnFlatExternals(config(false, {}));
    expect(warn).not.toHaveBeenCalled();
  });
});
