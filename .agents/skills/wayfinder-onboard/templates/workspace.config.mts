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
  // Areas in header order. Leave out an area the repository cannot support (see the onboarding skill).
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
      // The roadmap, in the kit's format, and the values a phase's Kind takes. // [[with: roadmap]]
      roadmap: 'docs/ROADMAP.md', // [[with: roadmap]]
      phaseKinds: ['feature', 'infrastructure', 'migration'], // [[with: roadmap]]
      // The TODO list, in the kit's format, its areas and its Source values that are not paths. // [[with: todo]]
      todo: 'docs/TODO.md', // [[with: todo]]
      todoAreas: ['app', 'docs', 'repo'], // [[with: todo]]
      todoSources: ['idea'], // [[with: todo]]
      // The architecture document, with its Stack summary and Planned migrations. // [[with: architecture]]
      architecture: 'docs/ARCHITECTURE.md', // [[with: architecture]]
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
      '.agents/skills/{assess-*,todo,wayfinder-onboard}/SKILL.md',
      '.agents/skills/{assess-*,todo,wayfinder-onboard}/scripts/*.mjs',
      '.agents/skills/{assess-*,todo,wayfinder-onboard}/REPOSITORY.md',
      'package.json',
    ],
    // The reviews folder: every markdown file, and each dot-directory it holds by a pattern naming it, since a glob
    // enters a dot-directory only where its pattern names one (the skills directory's review lands in
    // docs/reviews/.agents/skills/).
    reviews: ['docs/reviews/**/*.md', 'docs/reviews/.agents/**/*.md'],
    sources: ['__WS__/src/about-manifest.ts'],
  },
} as const satisfies WorkspaceSettings;
