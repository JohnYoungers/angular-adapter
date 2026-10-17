import { logger, type NormalizedFederationConfig } from '@softarc/native-federation/internal';

const DISCUSSION = 'https://github.com/orgs/native-federation/discussions/176';

// Orchestrator >= 4.8 no longer stitches a package from several builds, so builds that
// publish different entrypoint sets of a package make remotes fall back to their own copy.
export function warnFlatExternals(config: NormalizedFederationConfig): void {
  if (Object.keys(config.shared).length === 0) {
    return;
  }

  if (!config.features.denseExternals) {
    logger.warn(
      'Shared externals are published flat. Since orchestrator 4.8.0 this can make remotes ' +
        'load their own copy of a shared package (e.g. a second Angular instance). ' +
        "Set 'features.denseExternals: true' in federation.config.mjs. " +
        `See ${DISCUSSION}`,
    );
  }

  // share-utils resolves `includeSecondaries: { keepAll: true }` to `true`; any other value is dropped.
  const core = config.shared['@angular/core'];
  if (core && config.features.ignoreUnusedDeps && core.includeSecondaries !== true) {
    logger.warn(
      "Angular is shared without 'includeSecondaries: { keepAll: true }', so this build only " +
        'publishes the Angular entrypoints it imports. Remotes that import others load their own ' +
        "Angular instead. Add .patch(['@angular/*'], { includeSecondaries: { keepAll: true } }) " +
        `to 'shared' in federation.config.mjs. See ${DISCUSSION}`,
    );
  }
}
