import { logger, type NormalizedFederationConfig } from '@softarc/native-federation/internal';

// Orchestrator >= 4.8 no longer stitches a package from several builds, so a flat
// entrypoint that disagrees with its siblings makes the whole package fall back.
export function warnFlatExternals(config: NormalizedFederationConfig): void {
  if (config.features.denseExternals || Object.keys(config.shared).length === 0) {
    return;
  }

  logger.warn(
    "Shared externals are published flat. Since orchestrator 4.8.0 this can make remotes " +
      "load their own copy of a shared package (e.g. a second Angular instance). " +
      "Set 'features.denseExternals: true' in federation.config.mjs. " +
      'See https://github.com/orgs/native-federation/discussions/176',
  );
}
