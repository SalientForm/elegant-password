/**
 * The Engineering Workspace of Elegant Passwords: the data half of its Workspace Wayfinder config. Plain values only: Vite, the
 * browser and plain node (the check scripts, through the root package.json `wayfinder.config`) all load it. Every
 * setting is documented in the kit's declarations, node_modules/@salientform/workspace-wayfinder/dist/settings.d.ts.
 */
import type { WorkspaceSettings } from '@salientform/workspace-wayfinder';

export default {
  title: 'Elegant Passwords Workspace',
  product: 'Elegant Passwords',
  repository: { url: 'https://github.com/SalientForm/elegant-password', branch: 'main' },
  // The workspace's own dev and preview ports, assigned at setup from the repository's port rules (never a framework
  // default) and registered wherever the repository registers its ports. wayfinder() serves on them.
  ports: { dev: 4274, preview: 4275 },
  // The product's own dev server (pnpm dev, 4270). It deploys to GitHub Pages on its own origin, never beside the
  // workspace, so it has no path: a build of the workspace under a base shows no link to it.
  links: [{ label: 'Elegant Passwords', port: 4270 }],
  // Areas in header order: all six, always. An area the repository cannot support yet is a placeholder that says why
  // and what would fill it (see the onboarding skill, §2): make each reason true here, or replace the placeholder with
  // the area's settings.
  // The route mirror: the web app's hash pages, built by assess-features from the hooks file's productRoutes.
  productRoutes: 'wayfinder/src/product-routes.json',
  areas: {
    readme: {
      collection: 'readmes',
      sections: [],
      // One sentence on what the area holds here: name the package READMEs only where the repository has them.
      description: 'The repository README, rendered from source.',
    },
    audit: {
      // The folder of the review files and their index.
      reviews: 'docs/reviews',
      // The roadmap, the TODO list and the architecture document, all required, in the kit's formats (the document-repo
      // skill writes them), with the values a phase's Kind and a TODO entry's Area take and the TODO Source values that
      // are not paths. Every roadmap and TODO id carries the prefix: EP-M1.2, EP-X3, EP-4.
      idPrefix: 'EP',
      roadmap: 'docs/ROADMAP.md',
      phaseKinds: ['feature', 'infrastructure', 'migration'],
      todo: 'docs/TODO.md',
      // The core (src/lib), the web app, the repository and tep, in the order the TODO list first uses them.
      todoAreas: ['core', 'app', 'repo', 'cli'],
      // Who asked, where the list says so: Dossier, which will use the core as a package, and the user.
      todoSources: ['idea', 'dossier', 'user', 'feature-audit:'],
      architecture: 'docs/ARCHITECTURE.md',
      specDirs: ['docs/specs', 'docs/plans'],
      // The feature audit (assess-feature-audit) and its dead-code sweep: the web app's entry and tep's are entries.
      featureAudit: 'wayfinder/src/feature-audit.json',
      unusedExports: {
        roots: ['src'],
        entries: [
          '**/main.{ts,tsx,js,jsx}',
          '**/index.html',
          '**/vite.config.{ts,mts,js,mjs}',
          '**/vitest.setup.ts',
          '**/test-setup.ts',
          '**/playwright.config.ts',
          '**/eslint.config.{js,mjs}',
          'src/cli/bin.ts',
        ],
      },
    },
    features: {
      // One markdown file per feature: the web app's three pages, tep, and the planned core package.
      directory: 'docs/features',
      reviewedAt: '2026-11-24',
      sourceRoots: ['src'],
      // TypeScript 7 has no compiler API, which the test inventory parses with, and the kit loads the one package named
      // typescript: the tests stay a placeholder while the repository is on 7.
      tests: {
        placeholder: {
          reason: 'The test files cannot be listed: the inventory parses them with the TypeScript 5 compiler API, and this repository resolves typescript 7.0.2, which has none.',
          toFill: 'Move the repository to typescript 5.x (5.9 or later) and run assess-features again, which sets areas.features.tests and maps the tests to features. On TypeScript 7 it stays a placeholder: the kit loads the one package named typescript.',
        },
      },
    },
    api: {
      placeholder: {
        reason: 'Elegant Passwords has no API: the web app runs entirely in the browser and tep on the machine. No tracked JSON file is an OpenAPI 3 document, and nothing in src/ calls fetch.',
        toFill: 'Should the product ever serve or call an HTTP API, emit its OpenAPI 3 JSON document, then run assess-api, which sets areas.api.document and builds the consumer registry.',
      },
    },
    'platform-docs': {
      // One page per page of the web app (Passwords, Scoring, Fun), drafted by assess-platform-docs' first run from the
      // product's own text; each opens with the draft placeholder until a person has read it against the app.
      directory: 'docs/platform',
      reviewedAt: '2026-11-24',
    },
    about: {
      manifest: 'wayfinder/src/about-manifest.ts',
      prose: 'docs/workspace',
      // The skills directory (skillsDir, default '.agents/skills') and the agent directories linking to each kit skill
      // (skillLinks, default ['.claude/skills']): set them here only where discovery differs from the defaults.
    },
  },
  // Every file an area reads, by collection (assess-workspace's first run proposes them).
  content: {
    readmes: ['README.md'],
    // Every reviewed markdown file, so each has a document page and is found by search: the root's and docs/'s files,
    // the specs and plans, the Platform Docs pages and the About prose.
    markdown: ['*.md', 'docs/*.md', 'docs/plans/**/*.md', 'docs/platform/*.md', 'docs/specs/**/*.md', 'docs/workspace/*.md'],
    // The skills directory's real files: Vite's glob does not follow the agent directories' links.
    skills: [
      '.agents/skills/{assess-*,document-repo,todo,wayfinder-onboard}/SKILL.md',
      '.agents/skills/{assess-*,document-repo,todo,wayfinder-onboard}/scripts/*.mjs',
      '.agents/skills/{assess-*,document-repo,todo,wayfinder-onboard}/REPOSITORY.md',
      'package.json',
    ],
    // The reviews folder: every markdown file, and each dot-directory it holds by a pattern naming it, since a glob
    // enters a dot-directory only where its pattern names one (the skills directory's review lands in
    // docs/reviews/.agents/skills/).
    reviews: ['docs/reviews/**/*.md', 'docs/reviews/.agents/**/*.md'],
    // The feature catalogue and the route mirror.
    features: ['docs/features/*.md', 'wayfinder/src/product-routes.json'],
    // The feature audit.
    audit: ['wayfinder/src/feature-audit.json'],
    sources: ['wayfinder/src/about-manifest.ts'],
  },
} as const satisfies WorkspaceSettings;
