---
state: draft
summary: >
  Eight steps building the core package: the config model into src/lib/config, reading it in the core, config
  version 2, the package's API, building and packing, the web app's one configuration, the changed typing mode, and
  the documentation.
evidence: Branch feature/core-package (2026-11-22), P1 to P3 built.
spec: docs/specs/2026-11-03-core-package-design.md
---

# Plan: the core as a package, `@salientform/elegant-passwords`

**Milestone:** EP-M1.1

Implements `docs/specs/2026-11-03-core-package-design.md`. The package
ships before zxcvbn-ts is merged (2026-11-18, the user's choice), so its
`./zxcvbn` entry wraps `zxcvbn` 4.4.2 until then (spec §5.5). Each
milestone ends green on `pnpm typecheck` and `pnpm test`; P7 and the last
also on `pnpm test:e2e`. Until P3, everything `tep` prints is unchanged,
held by its own tests.

## P1 The config model moves to `src/lib/config/`

A move, with no change in behaviour.

- From `src/cli/`: `configModel.ts`, `configVersion.ts`, `names.ts`
  (`slugOf`, `closest`, `lookup`, the mode and site names), and
  `configText.ts` (the writer).
- `fields.ts` splits: the `rules`, `options` and `sentence` fields, their
  parsing and formatting go to `src/lib/config/fields.ts`; the `output`
  fields, `COUNT_AT_TERMINAL` and `COUNT_PIPED` stay in `src/cli/fields.ts`,
  whose `FIELDS` is the core's plus `output`.
- `ConfigModel`'s `output` section becomes the CLI's extension of the
  core's model.
- `src/boundaries.test.ts`: `src/lib/config/` may import `zod` and `yaml`;
  the rest of `src/lib` still may not. The Fun page's CLI prompt
  (`src/prompts/cliPrompt.ts`) imports from the new places.

## P2 Reading a configuration in the core

- `src/lib/config/check.ts`: `checkConfig(data)` checks plain data (the
  JSON form) with the zod schema and the field parsing now in
  `src/cli/config.ts`. It returns the model, or every problem as a key
  path and a message.
- `src/lib/config/yaml.ts`: `configFromYaml(text)` parses with `yaml`,
  refuses anchors, aliases and tags, turns each key path into a line, and
  calls `checkConfig`. A problem whose wording names `tep` (an empty file,
  a newer version, an anchor or an alias) carries a code instead, so the
  core's messages name no front end.
- `src/cli/config.ts` keeps file access, atomic writes and the messages:
  it adds the file name, quotes the line, and words the coded problems as
  today. `src/cli/config.test.ts` and `messages.test.ts` are unchanged.

## P3 Config version 2: `app-mode` and `typing-mode`

- `CONFIG_VERSION = 2`. `app-mode` (only `sentences` for now, its default)
  and `typing-mode` replace `mode`. A version 1 file still reads, its
  `mode` as `typing-mode`. The writer always writes version 2.
- `tep`: `--typing-mode` replaces `--mode`. `--mode` fails, naming the new
  flag (exit 2). Help, the wizard, messages and `Source`'s descriptions say
  "typing mode". The Fun page's CLI prompt follows.
- Tests: version 1 files read the same as before; a version 2 round trip;
  the messages that change, changed on purpose and nowhere else.

## P4 The package's API, `src/lib/index.ts`

- The layering moves from `src/cli/resolve.ts` to
  `src/lib/config/resolve.ts`. It is generic over where a value came from,
  so the CLI keeps its `Source` (flag, file line, wizard line), while the
  core's own caller uses the key path. The CLI keeps the count, the
  terminal rule and the sort.
- `resolveConfig(config)`: the schema check, the layering, then
  `problemsOf` and `warningsOf`, with each problem and warning naming its
  config keys through the field table. It returns `changed`: the
  `options` keys whose values differ from the typing mode's profile.
  `Settings` is a branded type, opaque to callers.
- `generate(settings, { sentence?, count? })` over `runInputs`: no sentence
  draws one; a `DrawnSentence` keeps it; a string is fitted as the user's
  own sentence.
- `readRulesText`, `configToYaml`, `configFromYaml`, `scorePassword`,
  `APP_MODES`, `TYPING_MODES`, `SITE_PRESETS`, `STRENGTH_PRESETS`,
  `FIELDS`, `DEFAULT_CONFIG` and `CONFIG_VERSION`, in config names (spec
  §5).
- `src/lib/zxcvbnEntry.ts`: `zxcvbnReading(password)`, which loads the
  library on first use.
- Tests: `resolveConfig` against `tep`'s resolve for every site preset and
  typing mode (the same settings); problems name keys; `changed`; one
  suggestion from each sentence kind; and the index exporting only the
  spec's names.

## P5 Building and packing

- `packages/core/`: `package.json` (spec §8; dependencies `zod`, `yaml`
  and `zxcvbn`), a README with the API and an example configuration, and
  `tsdown.config.ts` building `src/lib/index.ts` and
  `src/lib/zxcvbnEntry.ts` to ESM with type declarations.
- `pnpm build:package` and `pnpm pack:package`.
- `src/lib/package.test.ts`: builds into a temporary directory, imports the
  built files in Node, then resolves, generates and scores. Checks that
  the declarations name only the index's exports, and that the main entry
  holds no zxcvbn.

## P6 The web app keeps one configuration

- `src/state/configStore.ts`: the configuration as JSON under
  `elegant-passwords:config:v1`, checked with `checkConfig`, options
  written as values, `rules` in full, no `site`. The requirements,
  sentence options, typing mode and swaps keys are read once (with
  `readRequirements`' repairs first), written as the configuration, and
  removed. The open sentence mode and the sort keep their keys.
- `PasswordsProvider` loads and saves through it, and stops using
  `settingsStore`'s four loaders and `mappingStore`.
- My list: `SelectedEntry` gains `config`, saved with each card's
  password. An entry with a configuration that fails the check keeps its
  password and hint, without the configuration. Scoring does not read it.

## P7 The changed typing mode

- `TypingMode.tsx`: the heading becomes "Typing mode". While the options
  differ from the mode's (`changed`), the mode's button reads, for
  example, "Ten-finger (changed)".
- `RequirementsForm.tsx`: each option that differs carries a warning with
  the mode's own value ("Ten-finger sets this to Moderate") and a button
  that puts it back. This replaces "The options differ from this mode's"
  and its button.
- Tests: the marking, each warning and reset, a reload keeping the
  marking, and the e2e smoke updated for the new heading.

## P8 Documentation

- README: the package (install from the tarball or a `file:` path, the
  API in brief), config version 2, and "typing mode".
- `docs/decisions.md`: "Config files" (version 2, the names, reading
  version 1), "One core, two front ends" (`src/lib/config/`, the index as
  the only entry), the changed typing mode, and the web app's one
  configuration.
- `docs/TODO.md`: the first of Dossier's items goes, and `tep`'s
  "`--mode` replaces a config's own options" becomes `--typing-mode`.
- The spec and this plan are deleted.
