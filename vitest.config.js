import { fileURLToPath } from 'node:url';
import { defineConfig, mergeConfig } from 'vitest/config';
import viteConfig from './vite.config.js';

export default mergeConfig(viteConfig, defineConfig({
  resolve: {
    alias: [
      // The card faces package only names an ES module entry, which the browser build finds but test resolution
      // doesn't.
      { find: '@letele/playing-cards', replacement: '@letele/playing-cards/dist/index.esm.js' },
      // The components load the 3D table on demand; in tests they get a stand-in.
      { find: /^\.\.\/dice3d\/table\.js$/, replacement: fileURLToPath(new URL('tests/doubles/table.js', import.meta.url)) },
      // The same for the PDF reader, since jsdom cannot run pdf.js.
      { find: /^\.\.\/sheet\/reader\.js$/, replacement: fileURLToPath(new URL('tests/doubles/reader.js', import.meta.url)) },
    ],
  },
  test: {
    environment: 'jsdom',
    include: ['tests/**/*.test.{js,jsx}'],
    coverage: {
      reportOnFailure: true,
      provider: 'v8',
      include: ['src/**/*.{js,jsx}'],
      reporter: ['text', 'html', 'json-summary'],
      reportsDirectory: 'coverage/js',
      thresholds: { 100: true },
    },
  },
}));
