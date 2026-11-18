---
state: under-review
summary: >
  The core as an npm package, @salientform/elegant-passwords, configured by typing mode, site preset and overrides,
  with tep's config (version 2, app-mode and typing-mode) as the one configuration format for the web app, the CLI
  and the package. Decisions 1 to 4 taken on 2026-11-18; publishing is still open.
evidence: Branch feature/core-package (2026-11-18), P1 and P2 of the plan built.
---

# The core as a package: `@salientform/elegant-passwords`

Status: **draft for the user's review**, 2026-11-03; decisions 1 to 3 of
§10 taken on 2026-11-18 with the modes' names, publishing still open. Acts on the first item
of `TODO.md`, "Asked for by Dossier", and settles the config's shape for
the third (one sentence mode) so the format does not change once the
package ships. Dossier's side is its `docs/TODO.md` #19, "Password
generator dialog".

## 1. Goal

Dossier generates passwords in its own password dialog with this tool's
core, loaded on demand in the browser. Today a caller must build a complete
`GenerationSettings` (every field of `Requirements`, the sentence options,
the mapping settings), and the layering that turns a typing mode, a site
preset and a few values into those settings lives in the CLI
(`src/cli/resolve.ts`). The package lets a caller state a typing mode, a
site preset and only the values it overrides; everything left out takes
the package's default. The result is checked (`problemsOf`, `warningsOf`)
and problems come back to the caller, never fixed quietly.

The config format `tep` writes becomes the one way Elegant Passwords
describes a configuration, in the web app, the CLI and the package alike.

What Dossier's dialog needs (its #19), each of which the API in §5 covers:

- the typing modes, the site presets and the strength presets, by name and
  label, to fill its pickers;
- the site's rules as fields (lengths, allowed symbols filled with the
  default, minimum letters, digits and symbols) and as pasted sign-up text,
  with what was understood and what cannot be kept named;
- one suggestion at a time with its badges (Strength, Raw, Difficulty,
  Memorability, zxcvbn) and rule checks; Refresh for another;
- one sentence box: Generate fills it with a made-up sentence the user may
  edit, or the user types their own. An edited sentence shows the scores,
  not exact bits, and a strength target it misses is a warning, not a
  block;
- a hidden generation for seal-by-rotation: a made-up sentence and a
  password never shown, with the checks and badges as proof;
- the whole configuration saved on the item as JSON, never the sentence,
  so generating again and rotation reuse it.

## 2. Decided already

- The name is `@salientform/elegant-passwords` (2026-11-03, the user's
  choice; `tep` is taken on npm). On 2026-11-03 neither the name nor an
  npm organisation `salientform` exists, so both are free to claim.
- Auto draws one separator per password at random (2026-11-03): built
  separately, before or beside this; the package exposes whatever the core
  does.
- An edited made-up sentence is the user's: it shows the scores, not exact
  bits (2026-11-03). This is how the engine already treats one
  (`GenerateInputs.edited`).
- The config format is `tep`'s (`docs/decisions.md`, "Config files"),
  moved to version 2 for the modes' names (§4.1). The `output` section
  stays the CLI's.
- Sentences and Keyboard patterns are the **app mode**; what was called
  the mode is the **typing mode** (2026-11-18, the user's decision). The
  typing modes serve both app modes (`TODO.md`, 2026-11-18).

## 3. Where it lives

In this repository, built from `src/lib`; nothing moves to a workspace.

- `src/lib/index.ts` is the public API (§5) and the only entry point. Every
  other module stays internal: a test fails if the package's type
  declarations name anything not exported from the index.
- `src/lib/config/` takes the config model from `src/cli/`: the model and
  its version (`configModel.ts`, `configVersion.ts`), the names of modes
  and presets (`names.ts`), the field table and its value parsing and
  formatting (`fields.ts`, less the `output` fields), the zod schema, the
  layering (`resolve.ts`, less the CLI's count and terminal rules), and the
  writer (`configText.ts`). Reading YAML text moves too, returning each
  problem as a key path, a line and a message.
- `src/cli/` keeps file access, atomic writes, the `output` section, the
  flags, the wizard and its line-numbered messages (the file name, the
  line itself, what was found). Its messages do not change: its tests hold
  them.
- `packages/core/` holds only what publishing needs: `package.json`, a
  README, and a tsdown config that builds `src/lib/index.ts` to ESM with
  type declarations. The app keeps importing `src/lib` directly.

The boundaries test (`src/boundaries.test.ts`) changes in one place:
`src/lib` may import `zod` and `yaml`, in `src/lib/config/` only. It still
uses no browser or Node global. The browser bundle test still holds: the
web app reads and writes config JSON through the schema module and never
imports the YAML module, so `yaml` stays out of its chunks.

Moving the files instead of the whole core into `packages/core/src` was
rejected: it would rewrite every import in both front ends for no gain,
since the boundaries test already keeps the core apart.

## 4. The configuration

### 4.1 One shape, two encodings

A configuration is the object `tep.yml` describes, in the file's own
vocabulary: kebab-case keys and named values.

```yaml
version: 2
app-mode: sentences         # keyboard-patterns once it is built
typing-mode: ten-finger     # a typing mode's name
site: typical-site          # a site preset's name
rules:                      # over the site preset
  max-length: 20
  symbols: "!@#$%"
options: preset             # or option values over the mode's preset
sentence:                   # how a sentence the user wrote or edited is fitted
  shrink: vowels
swaps:
  off: [o>0]
```

As JSON (Dossier's item, the web app's localStorage, a My list entry) it is
the same object. The package reads either; it writes YAML text with
comments, as `tep config` does, and JSON as a plain object.

Every key but `version` may be left out, and each left out takes the
package's default, as a key left out of `tep.yml` does today. `app-mode`
defaults to `sentences`, the only value until Keyboard patterns is built;
adding that value does not change the version.

Version 2 renames version 1's `mode` to `typing-mode` and adds
`app-mode`. The package reads version 1 files, their `mode` as
`typing-mode` and their app mode as `sentences`, and always writes
version 2; `tep config` saving over a version 1 file writes version 2.
Everywhere else follows the names: the web app's "Mode" heading becomes
"Typing mode", and `tep`'s `--mode` becomes `--typing-mode` (`--mode`
fails, naming the new flag).

### 4.2 The sentence (TODO's third item)

The `sentence` section keeps its seven keys and their meaning as fitting
options: how long words shrink, from how many letters, toward what length,
whether words may be dropped, whether small words become initials,
padding and its length tag. With one sentence mode they apply whenever the
sentence in the box is not the one the tool drew: one the user wrote, or a
drawn one they edited.

A configuration never holds a sentence's text, and never which of today's
two sentence modes was chosen: whether a sentence is given is an argument
at the moment of generating (§5.3), as it is for `tep g --sentence` today.
So merging the two modes changes the web app's screen and the engine's
paths, not the format.

If the merged algorithm later needs a new option, it is added as an
optional key, and version 2 files still read. A key removed or renamed
moves the format to version 3, and the package keeps reading the earlier
versions.

### 4.3 What the format adds for the package

Only the renaming in §4.1: version 2 states everything a caller can set. The
package's schema is the CLI's less `output`; the CLI's is the package's
plus `output`.

## 5. The API

All names below are exported from the package's index. Values are plain
data, safe to store and to send between threads.

### 5.1 Choices, to build a form

- `APP_MODES`: each app mode's name (`sentences`), label and description.
- `TYPING_MODES`: each typing mode's name (`ten-finger`), label and
  description.
- `SITE_PRESETS`: each preset's name, label, note and rule values.
- `STRENGTH_PRESETS`: each preset's name, label, bits and hint.
- `FIELDS`: every `rules`, `options` and `sentence` key, with its label,
  description, kind and range, and its default (`symbols` defaults to the
  core's default allowed set).
- `DEFAULT_CONFIG`: `{ version: 2 }`, and `CONFIG_VERSION`.

### 5.2 Reading and resolving a configuration

```ts
resolveConfig(config: unknown): Resolved
type Resolved =
  | { ok: true; settings: Settings; warnings: Message[]; notes: string[]; changed: string[] }
  | { ok: false; problems: Problem[] };
```

- Takes the JSON object (or the result of `configFromYaml`). Checks it with
  the schema, then layers it (§4.1) and checks the result with
  `problemsOf` and `warningsOf`.
- A problem names the config keys involved (`rules.max-length`,
  `options.strength`) and says why, in the words `tep` uses. Every problem
  comes back at once. Nothing is fixed to fit.
- A warning (an unreachable strength target, an option the typing mode has
  no use for) does not stop `ok`.
- `changed` lists the `options` keys whose values differ from the typing
  mode's profile, so every front end marks a changed mode the same way
  (§6). It is not a warning: each front end decides how to show it.
- `Settings` is opaque to the caller: pass it to `generate`.

```ts
readRulesText(text: string): { rules: Record<string, unknown>; understood: string[]; unsupported: string[] }
```

The pasted sign-up text read as `rules` values in config keys, ready to
merge into a configuration's `rules`. It is `parseRuleText` and
`mergeParsedRules`' symbol exclusion, refused whole past the core's
2,000-character cap, as both front ends do.

```ts
configToYaml(config: Config): string
configFromYaml(text: string): { ok: true; config: Config } | { ok: false; problems: { path?: string; line: number; message: string }[] }
```

### 5.3 Generating

```ts
generate(settings: Settings, request?: {
  sentence?: DrawnSentence | string; // absent: draw a new one
  count?: number;                    // default 1
}): Outcome
```

- No `sentence`: draw a made-up sentence and make `count` passwords from
  it, each with its exact bits.
- A `DrawnSentence` (from a previous outcome): keep it, for Refresh. Exact
  bits.
- A string: the user's own sentence, or a drawn one they edited. Fitted as
  today's "Use my sentence"; scores, no exact bits. A string equal to the
  drawn sentence's text is still a string: the caller keeps the
  `DrawnSentence` while the box is unedited.
- `Outcome` is `{ ok: true, sentence?: DrawnSentence, suggestions, warnings }`
  or `{ ok: false, problem }`. A suggestion has the password, its hint,
  its rule checks, its readings (Strength, Raw, Difficulty for the
  configuration's typing mode, Memorability, each with its value, band and
  sentence) and, from a drawn sentence only, its bits.
- `generate` never throws for a configuration's problem: `resolveConfig`
  has found those.

For seal-by-rotation the caller calls `generate` with no sentence and
shows nothing; the checks and readings are the proof.

### 5.4 Scoring a password already made

```ts
scorePassword(password: string, hint: string, typingMode?: string): Readings
```

Cold scoring from the password and hint alone, as My list does, so a saved
item reads the same in a year.

### 5.5 zxcvbn, on its own entry

`@salientform/elegant-passwords/zxcvbn` exports
`zxcvbnReading(password): Promise<ZxcvbnReading>`: the badge's word and
crack time, with the estimator loaded on first use (about 400 KB
gzipped), so a caller that never shows the badge never loads it. The
estimator becomes zxcvbn-ts's code merged into `src/lib` (`TODO.md`,
2026-11-18), so the package lists no zxcvbn dependency. If the package
ships before the merge, this entry wraps `zxcvbn` 4.4.2 as a dependency
until then; its API does not change.

## 6. The web app

- The settings it keeps across a reload (the requirements, the sentence
  options, the typing mode, the swaps) become one configuration, saved as
  JSON under `elegant-passwords:config:v1`. The four old keys are read once
  on load, written as the configuration and removed; their existing
  repairs (`readRequirements`) run first, so nothing a user saved is lost.
- It writes options as values, never `preset`, so its passwords do not
  change when a mode's profile is re-measured, as today. It writes `rules`
  in full and no `site`, as it does not remember which preset filled them.
- **A mode changed by hand stays selected, marked as changed**
  (2026-11-18, the user's decision). Picking a typing mode fills in its
  options, which the user may then change freely, even against the mode.
  Once one differs, the mode stays picked (Difficulty is still scored for
  it) but shows as changed, for example "Ten-finger (changed)", and each
  option that differs warns beside it with the mode's own value
  ("Ten-finger sets this to Moderate") and a way to put it back. This
  replaces today's single line, "The options differ from this mode's",
  and its button. The configuration needs no new key: a mode whose
  options differ from its profile is the changed state (`changed`, §5.2),
  so a saved configuration reopens marked the same way, and one whose
  mode is re-measured later reopens marked changed, which is true.
- Which sentence mode is open, the order, the session and My list keep
  their own keys. The open mode goes when one sentence mode is built.
- My list saves, with each password it adds from a card, the configuration
  that made it, beside its hint. An entry saved before has none, and an
  entry from the typing test has none. Scoring is unchanged: it still
  reads the password and hint alone.

## 7. The CLI

Imports the config model, names, fields, schema, layering and writer from
`src/lib/config/`, and adds its `output` section and count rules.
Everything it prints is unchanged except the renaming (§4.1): `--mode`
becomes `--typing-mode`, and help, messages and the wizard say "typing
mode". `tep` stays out of npm (`TODO.md`, "tep
CLI: decisions to revisit").

## 8. Building and publishing

- `packages/core/package.json`: the name, `"type": "module"`, `exports`
  for `.` and `./zxcvbn`, `files: ["dist"]`, `sideEffects: false`,
  MIT, and dependencies `zod` and `yaml`, pinned as the app pins them
  (and `zxcvbn` only until the merge, §5.5). The merged zxcvbn-ts code
  carries its MIT notice.
- `pnpm build:package` builds it; `pnpm pack:package` makes the tarball.
- A test builds the package, imports the built files in Node, resolves a
  configuration, generates and scores; another checks that the type
  declarations expose only the index's names.
- Versions: `0.1.0` first. `1.0.0` once Dossier's dialog runs on it, then
  semver, where a change to anything §5 names is a major version. The
  config format's version is separate and moves only as §4.2 says.
- Publishing is still to be discussed (§10, 5). Until it is settled
  Dossier can depend on the packed tarball or on
  `file:../elegant-passwords/packages/core`, so the build does not wait
  for it.

## 9. Out of scope

- One sentence mode's screen and algorithm (`TODO.md`); §4.2 settles only
  its format.
- `tep` on npm, and a CLI with no dependencies.
- A worker: the engine answers within its budget on the caller's thread
  (`docs/decisions.md`, "Where generation runs"); Dossier may run it in
  one of its own.

## 10. Decisions

Taken on 2026-11-18:

1. **The API speaks the config file's vocabulary** (`max-length`,
   `ten-finger`, `strength: strong`), not the engine's (`maxLength`,
   `targetBits: 50`). The engine's names stay internal and free to change.
2. **The web app saves options as values**, never `preset` (§6). A mode
   whose options were changed is marked as changed (§6).
3. **`0.1.0` first, `1.0.0` once Dossier runs on it.**

4. **The modes' names**: `app-mode` (Sentences, Keyboard patterns) and
   `typing-mode` (today's mode), as config version 2 (§4.1).

Still open:

5. **Publishing**: the user registers the npm organisation `salientform`
   (`TODO.md`); whether and when to publish is to be discussed. Until
   then Dossier uses the tarball or a `file:` path (§8).
