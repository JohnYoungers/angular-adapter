import * as fs from 'fs';
import * as path from 'path';

import { translateFederationArtifacts, type I18nConfig } from './i18n.js';

// Runs the real @angular/localize CLI, which the mocks in i18n.spec.ts cannot cover.
// The workspace lives in node_modules so that @angular/localize resolves from the repo.
describe('translateFederationArtifacts with the real localize-translate CLI', () => {
  let workspaceRoot: string;

  beforeEach(() => {
    workspaceRoot = fs.mkdtempSync(path.join(process.cwd(), 'node_modules', '.i18n-spec-'));
  });

  afterEach(() => {
    fs.rmSync(workspaceRoot, { recursive: true, force: true });
  });

  const write = (file: string, content: string) => {
    fs.mkdirSync(path.dirname(file), { recursive: true });
    fs.writeFileSync(file, content);
  };

  const xlf = `<?xml version="1.0" encoding="UTF-8" ?>
<xliff version="1.2" xmlns="urn:oasis:names:tc:xliff:document:1.2">
  <file source-language="en" target-language="de" datatype="plaintext" original="ng2.template">
    <body>
      <trans-unit id="greeting" datatype="html">
        <source>Hello</source>
        <target>Hallo</target>
      </trans-unit>
    </body>
  </file>
</xliff>`;

  it('translates the staged federation files and leaves the Angular output alone', () => {
    const browser = path.join(workspaceRoot, 'dist', 'browser');
    const sourceFile = (name: string) => path.join(browser, 'en', name);
    const translation = path.join(workspaceRoot, 'messages.de.xlf');

    write(translation, xlf);
    write(path.join(browser, 'en', 'remoteEntry.json'), '{}');
    write(sourceFile('cmp.js'), 'export const t = $localize`:@@greeting:Hello`;');
    write(sourceFile('chunk.js'), 'export const c = $localize`:@@greeting:Hello`;');
    write(sourceFile('chunk.css'), 'a{}');
    write(sourceFile('chunk.js.map'), '{"version":3}');
    // Angular's own output sits in the same folder and must be left alone
    write(sourceFile('main.js'), 'export const m = $localize`:@@greeting:Hello`;');

    const i18n: I18nConfig = { sourceLocale: 'en', locales: { de: translation } };
    // core reports every file it wrote, chunks of non-dense bundles and source maps included
    const federationFiles = ['cmp.js', 'chunk.js', 'chunk.css', 'chunk.js.map'];

    translateFederationArtifacts(i18n, true, 'dist/browser', federationFiles, workspaceRoot);

    const de = (name: string) => fs.readFileSync(path.join(browser, 'de', name), 'utf8');
    expect(de('cmp.js')).toContain('Hallo');
    expect(de('chunk.js')).toContain('Hallo');
    expect(de('chunk.css')).toBe('a{}');
    expect(de('chunk.js.map')).toBe('{"version":3}');
    expect(fs.existsSync(path.join(browser, 'de', 'main.js'))).toBe(false);
  });

  it('fails the build when a listed file is missing', () => {
    const browser = path.join(workspaceRoot, 'dist', 'browser');
    const translation = path.join(workspaceRoot, 'messages.de.xlf');

    write(translation, xlf);
    write(path.join(browser, 'en', 'remoteEntry.json'), '{}');

    const i18n: I18nConfig = { sourceLocale: 'en', locales: { de: translation } };
    expect(() =>
      translateFederationArtifacts(i18n, true, 'dist/browser', ['missing.js'], workspaceRoot)
    ).toThrow(/ENOENT/);
  });
});
