/**
 * The Engineering Workspace of Elegant Passwords: the data half of its Workspace Wayfinder config. Plain values only: Vite, the
 * browser and plain node (the check scripts, through the root package.json `wayfinder.config`) all load it. Every
 * setting is documented in the kit's declarations, node_modules/@nexstratus/workspace-wayfinder/dist/settings.d.ts.
 */
import type { WorkspaceSettings } from '@nexstratus/workspace-wayfinder';

export default {
  title: 'Elegant Passwords Workspace',
  product: 'Elegant Passwords',
  repository: { url: 'https://github.com/SalientForm/elegant-password', branch: 'main' },
  // The workspace's own dev and preview ports, assigned at setup from the repository's port rules (never a framework
  // default) and registered wherever the repository registers its ports. wayfinder() serves on them.
  ports: { dev: 4274, preview: 4275 },
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
    },
    about: {
      manifest: 'workspace/src/about-manifest.ts',
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
    sources: ['workspace/src/about-manifest.ts'],
  },
} as const satisfies WorkspaceSettings;
