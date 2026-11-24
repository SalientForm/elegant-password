/**
 * The Engineering Workspace of __PRODUCT__: the data half of its Workspace Wayfinder config. Plain values only: Vite, the
 * browser and plain node (the check scripts, through the root package.json `wayfinder.config`) all load it. Every
 * setting is documented in the kit's declarations, node_modules/@salientform/workspace-wayfinder/dist/settings.d.ts.
 */
import type { WorkspaceSettings } from '@salientform/workspace-wayfinder';

export default {
  title: '__PRODUCT__ Workspace',
  product: '__PRODUCT__',
  repository: { url: '__REPO_URL__', branch: '__BRANCH__' },
  // The workspace's own dev and preview ports, assigned at setup from the repository's port rules (never a framework
  // default) and registered wherever the repository registers its ports. wayfinder() serves on them.
  ports: { dev: __PORT__, preview: __PREVIEW_PORT__ },
  // Areas in header order: all six, always. An area the repository cannot support yet is a placeholder that says why
  // and what would fill it (see the onboarding skill, §2): make each reason true here, or replace the placeholder with
  // the area's settings.
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
      // are not paths. Every roadmap and TODO id carries the prefix: __ID_PREFIX__-M1.2, __ID_PREFIX__-X3, __ID_PREFIX__-4.
      idPrefix: '__ID_PREFIX__',
      roadmap: 'docs/ROADMAP.md',
      phaseKinds: ['feature', 'infrastructure', 'migration'],
      todo: 'docs/TODO.md',
      todoAreas: ['app', 'docs', 'repo'],
      todoSources: ['idea'],
      architecture: 'docs/ARCHITECTURE.md',
    },
    features: {
      placeholder: {
        reason: 'No routed product UI with tests was found in this repository.',
        toFill: 'Add the product\'s routes and tests, then run assess-features, which writes the feature catalogue and its settings.',
      },
    },
    api: {
      placeholder: {
        reason: 'No OpenAPI 3 JSON document was found in this repository.',
        toFill: 'Emit one, then run assess-api, which sets areas.api.document and builds the consumer registry.',
      },
    },
    'platform-docs': {
      placeholder: {
        reason: 'No plain-language pages about the product were found in this repository.',
        toFill: 'Write the first page, or run assess-platform-docs to draft one per item of the product\'s navigation.',
      },
    },
    about: {
      manifest: '__WS__/src/about-manifest.ts',
      prose: 'docs/workspace',
      // The skills directory (skillsDir, default '.agents/skills') and the agent directories linking to each kit skill
      // (skillLinks, default ['.claude/skills']): set them here only where discovery differs from the defaults.
    },
  },
  content: {
    readmes: ['README.md'],
    // Every reviewed markdown file, so each has a document page and is found by search: the root's and docs/'s files,
    // the specs and plans, the About prose. Add a pattern for any other reviewed file (a package's own docs, say).
    markdown: ['*.md', 'docs/*.md', 'docs/specs/**/*.md', 'docs/plans/**/*.md', 'docs/workspace/*.md'],
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
    sources: ['__WS__/src/about-manifest.ts'],
  },
} as const satisfies WorkspaceSettings;
