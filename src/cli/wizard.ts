// tep config's questions (spec §7): the typing mode, the site's rules, the
// options, the output; then every answer on a numbered review screen to
// change or save. Every question is shaped by constraints.ts so that no
// answer can contradict another; if one ever gets through, that is a bug,
// said at once, and the question is asked again without it.

import { warningsOf } from '../lib/consistency';
import { DEFAULT_TYPING_MODE } from '../lib/difficulty';
import { runInputs } from '../lib/engine';
import { DEFAULT_SENTENCE_OPTIONS, type SentenceOptions } from '../lib/fromSentence';
import type { Requirements } from '../lib/generate';
import { DEFAULT_MAPPING_SETTINGS } from '../lib/mappingSettings';
import { modeLabel, unusedIn } from '../lib/modeProfiles';
import { inputsFor, presentSuggestions } from '../lib/pipeline';
import { scoreReadings } from '../lib/readings';
import { mergeParsedRules, parseRuleText } from '../lib/ruleText';
import { DEFAULT_SITE_PRESET } from '../lib/sitePresets';
import { DEFAULT_SORT, type SortOrder } from '../lib/sort';
import { capitalise, lowerFirst } from '../lib/text';
import type { ConfigModel } from './configModel';
import {
  bitsShape,
  fieldShape,
  modeShape,
  optionsHowShape,
  OTHER_BITS,
  outputHowShape,
  problemsWith,
  reasonFor,
  reqOf,
  rulesHowShape,
  rulesOf,
  valueIn,
  type Answers,
  type Choice,
  type NumberShape,
  type SelectShape,
  type TextShape,
  type Where,
} from './constraints';
import { CliError, EXIT, ISSUES } from './errors';
import { COUNT_PIPED, describeValue, fieldNamed, fieldsIn, reqField, type CliField } from './fields';
import { Cancelled, type Prompter } from './io';
import { explainProblem, explainWarning } from './messages';
import { SITE_NAMES, siteName } from './names';
import { badges, PLAIN } from './output';
import { wrapHanging } from './wrap';

/** The site preset pasted rules and a file without one start from, by name. */
const DEFAULT_SITE = siteName(DEFAULT_SITE_PRESET);

/** The order rules are asked in, each limiting the next (spec §7.1). */
const RULE_ORDER = ['min-length', 'max-length', 'symbols', 'spaces', 'min-uppercase', 'min-digits', 'min-symbols']; // a lowercase count comes from pasted rules, a flag or the file, never asked: sites almost never set one

/** What the wizard can be told to do instead of the real thing, for tests of the bug path. */
export interface WizardHooks {
  /** Shape a field's question; the default is constraints.ts. A test passes one that lets a bad choice through. */
  fieldShape?: typeof fieldShape;
}

export type WizardResult = { kind: 'save'; answers: Answers } | { kind: 'quit' };

export interface WizardOptions {
  prompter: Prompter;
  /** The file being written, for the review's title. */
  file: string;
  hooks?: WizardHooks;
  /** Asked before saving; false goes back to the review. */
  confirmSave?: () => Promise<boolean>;
}

/** A line on the review screen and what choosing it changes. */
export interface ReviewLine {
  n: number;
  label: string;
  value: string;
  edit: { kind: 'mode' } | { kind: 'rules-how' } | { kind: 'options-how' } | { kind: 'field'; field: CliField };
  /** The fields this line stands for, for naming it in reasons. */
  fields: string[];
}

/** The review screen's lines for these answers. */
export function reviewLines(a: Answers): ReviewLine[] {
  const lines: Omit<ReviewLine, 'n'>[] = [];
  const req = reqOf(a);
  const value = (f: CliField) => describeValue(f, f.target.kind === 'req' ? req[f.target.key] : f.target.key === 'count' ? req.count : (a.output.sort ?? DEFAULT_SORT));
  const mode = a.mode ?? DEFAULT_TYPING_MODE;
  lines.push({ label: 'Typing mode', value: modeLabel(mode), edit: { kind: 'mode' }, fields: ['mode'] });

  const rules = fieldsIn('rules');
  const preset = a.site ? SITE_NAMES.find((s) => s.name === a.site)! : undefined;
  const ruleLines = preset ? rules.filter((f) => f.name in a.rules) : rules;
  lines.push({
    label: 'Site rules',
    value: preset ? `${preset.label} (${preset.value.note})${ruleLines.length ? ', with:' : ''}` : 'set one by one:',
    edit: { kind: 'rules-how' },
    fields: rules.filter((f) => !ruleLines.includes(f)).map((f) => f.name),
  });
  for (const f of ruleLines) lines.push({ label: `  ${capitalise(f.label)}`, value: value(f), edit: { kind: 'field', field: f }, fields: [f.name] });

  const options = fieldsIn('options');
  const unused = new Set(unusedIn(mode).map((u) => reqField(u.key)!.name));
  if (a.optionsHow === 'each') {
    lines.push({ label: 'Options', value: 'set one by one:', edit: { kind: 'options-how' }, fields: options.filter((f) => unused.has(f.name)).map((f) => f.name) });
    for (const f of options.filter((x) => !unused.has(x.name))) lines.push({ label: `  ${capitalise(f.label)}`, value: value(f), edit: { kind: 'field', field: f }, fields: [f.name] });
  } else {
    const summary = options
      .filter((f) => !unused.has(f.name))
      .map((f) => `${f.label} ${value(f)}`)
      .join(', ');
    lines.push({ label: 'Options', value: `the ${modeLabel(mode)} preset: ${summary}`, edit: { kind: 'options-how' }, fields: options.map((f) => f.name) });
  }
  for (const f of fieldsIn('output')) lines.push({ label: capitalise(f.name === 'count' ? 'count' : f.label), value: f.name === 'count' && !('count' in a.output) ? `${value(f)} at a terminal, ${COUNT_PIPED} when piped` : value(f), edit: { kind: 'field', field: f }, fields: [f.name] });
  return lines.map((l, i) => ({ ...l, n: i + 1 }));
}


/** The review's lines as shown: number, label and value in columns, a value that runs past `width` wrapped under its column. */
export function formatReview(lines: ReviewLine[], width = Number.POSITIVE_INFINITY): string[] {
  const labels = Math.max(...lines.map((l) => l.label.length));
  const index = String(lines.length).length;
  const column = index + 2 + labels + 2;
  return lines.flatMap((l) => wrapHanging(`${String(l.n).padStart(index)}  ${l.label.padEnd(labels)}  ${l.value}`, width, column));
}

/**
 * The question under the review. The prompter does not wrap a prompt's
 * title, and where the terminal wraps it the rest starts at the left edge,
 * outside the prompter's guide bar, so a narrow terminal gets the short
 * form. The box's width plus its 6 columns is the terminal's; the title's
 * mark and spaces take 3.
 */
export function reviewPrompt(count: number, noteWidth: number): string {
  const full = `Change a line (1-${count}), s to save, q to quit without saving`;
  return full.length + 3 <= noteWidth + 6 ? full : `Change a line (1-${count}), s save, q quit`;
}

/** Where each field is on the review screen. */
const whereIn = (lines: ReviewLine[]): Where => ({ lineOf: (f) => lines.find((l) => l.fields.includes(f.name))?.n });
const BEFORE_REVIEW: Where = { lineOf: () => undefined };

/** The settings to save, from the answers. Options the typing mode has no use for are left out (the preset fills them in when read), so tep g never warns about a file tep config wrote. */
export function modelOf(a: Answers): ConfigModel {
  const mode = a.mode ?? DEFAULT_TYPING_MODE;
  const unused = new Set(unusedIn(mode).map((u) => reqField(u.key)!.name));
  return {
    mode,
    ...(a.site ? { site: a.site } : {}),
    rules: a.site ? { ...a.rules } : rulesOf(a),
    options: a.optionsHow === 'each' ? Object.fromEntries(fieldsIn('options').filter((f) => !unused.has(f.name)).map((f) => [f.name, reqOf(a)[f.target.key as keyof Requirements]])) : 'preset',
    sentence: { ...a.sentence },
    ...(a.swaps ? { swaps: a.swaps } : {}),
    output: { ...a.output },
  };
}

/** The answers a loaded config stands for. Rules a file leaves out are the defaults, as tep g reads them. */
export function answersOf(model: ConfigModel): Answers {
  const a: Answers = {
    mode: model.mode ?? DEFAULT_TYPING_MODE,
    rules: {},
    rulesAnswered: true,
    options: {},
    output: { ...model.output },
    sentence: { ...model.sentence },
    ...(model.swaps ? { swaps: model.swaps } : {}),
  };
  if (model.site) {
    a.site = model.site;
    a.rules = { ...model.rules };
  } else {
    a.rules = { ...rulesOf({ ...a, rules: {}, site: DEFAULT_SITE }), ...model.rules };
  }
  if (model.options === 'preset') a.optionsHow = 'preset';
  else {
    const preset = reqOf({ ...a, optionsHow: 'preset' });
    a.optionsHow = 'each';
    a.options = { ...Object.fromEntries(fieldsIn('options').map((f) => [f.name, preset[f.target.key as keyof Requirements]])), ...model.options };
  }
  return a;
}

export class Wizard {
  private readonly p: Prompter;
  private readonly shapeField: typeof fieldShape;

  constructor(private readonly opts: WizardOptions) {
    this.p = opts.prompter;
    this.shapeField = opts.hooks?.fieldShape ?? fieldShape;
  }

  /** Ask everything, from the start or from a loaded file, then review until saved or quit. */
  async run(start?: Answers): Promise<WizardResult> {
    let a: Answers;
    if (!start) a = await this.firstPass({ rules: {}, rulesAnswered: false, options: {}, output: {}, sentence: {} });
    else a = await this.repair(start);
    return this.review(a);
  }

  // ------------------------------------------------------------ asking

  /** The bug message, said the moment a contradiction gets through a question. */
  private bug(a: Answers, label: string, chosen: string, where: Where, own: string[] = []) {
    const problems = problemsWith(a);
    this.p.error(
      `${label}: ${chosen} contradicts your other answers: ${reasonFor(problems, a, own, where)}. ` +
        `This is a bug in tep: the question should not have offered it. Please report it at ${ISSUES}. Pick something else.`,
    );
  }

  /**
   * Ask a select, keeping what it shapes: a question left with one allowed
   * choice is stated, not asked; one with none is a bug. Answers that let a
   * contradiction through are refused at once and the question asked again.
   */
  private async select<T>(a: Answers, shape: SelectShape<T>, where: Where, opts: { review?: boolean } = {}): Promise<{ answers: Answers; value: T }> {
    const excluded: { value: T; reason: string }[] = [];
    for (;;) {
      const choices: Choice<T>[] = shape.choices.map((c) => {
        const ex = excluded.find((e) => e.value === c.value);
        return ex ? { ...c, blocked: ex.reason } : c;
      });
      const allowed = choices.filter((c) => !c.blocked);
      if (!allowed.length) throw this.deadEnd(shape.message, choices);
      if (allowed.length === 1 && choices.length > 1 && !opts.review) {
        const only = allowed[0]!;
        const why = choices.find((c) => c.blocked)?.blocked;
        this.p.info(`${shape.message}: ${only.label}, the only choice left${why ? `: the others are ruled out (${lowerFirst(why)})` : ''}.`);
        return this.accept(a, shape, only.value, only.label, where);
      }
      const initial = allowed.some((c) => c.value === shape.initial) ? shape.initial : allowed[0]!.value;
      const value = await this.p.select<T>({
        message: shape.message,
        options: choices.map((c) => ({
          value: c.value,
          label: c.label,
          ...(c.blocked ? { hint: `not allowed: ${c.blocked}`, disabled: true } : c.warning ? { hint: `warning: ${c.warning}` } : c.hint ? { hint: c.hint } : {}),
        })),
        ...(initial !== undefined ? { initialValue: initial } : {}),
      });
      const chosen = choices.find((c) => c.value === value)!;
      const next = shape.apply(a, value);
      if (problemsWith(next).length) {
        this.bug(next, shape.message, chosen.label, where, shape.own);
        excluded.push({ value, reason: 'it contradicts your other answers (a bug in tep)' });
        continue;
      }
      return { answers: next, value };
    }
  }

  private accept<T>(a: Answers, shape: SelectShape<T>, value: T, label: string, where: Where) {
    const next = shape.apply(a, value);
    if (problemsWith(next).length) {
      this.bug(next, shape.message, label, where, shape.own);
      throw this.deadEnd(shape.message, []);
    }
    return { answers: next, value };
  }

  private deadEnd(message: string, choices: Choice<unknown>[]) {
    return new CliError(EXIT.unexpected, `"${message}" has no answer that fits the others. This is a bug in tep.`, [
      ...choices.filter((c) => c.blocked).map((c) => `${c.label}: ${c.blocked}`),
      `Please report it at ${ISSUES}. Nothing was written.`,
    ]);
  }

  private async number(a: Answers, shape: NumberShape, where: Where): Promise<Answers> {
    if (shape.min > shape.max) throw this.deadEnd(shape.message, []);
    const excluded = new Set<number>();
    for (;;) {
      if (shape.min === shape.max && !excluded.has(shape.min)) {
        this.p.info(`${shape.message}: ${shape.min}, the only value that fits${shape.above ? ` (${lowerFirst(shape.above)})` : shape.below ? ` (${lowerFirst(shape.below)})` : ''}.`);
        const next = shape.apply(a, shape.min);
        if (!problemsWith(next).length) return next;
        this.bug(next, shape.message, String(shape.min), where, shape.own);
        throw this.deadEnd(shape.message, []);
      }
      const raw = await this.p.text({
        message: `${shape.message} (${shape.min}-${shape.max})`,
        ...(shape.initial !== undefined ? { initialValue: String(shape.initial) } : {}),
        validate: (v) => {
          const t = v.trim();
          if (!/^\d+$/.test(t)) return `Type a whole number from ${shape.min} to ${shape.max}.`;
          const n = Number(t);
          if (n < shape.limits.min || n > shape.limits.max) return `${n} is out of range: it must be from ${shape.min} to ${shape.max}.`;
          if (n < shape.min || n > shape.max) {
            // The reason for the value typed, not for the value just outside the range, so no number the user never typed is quoted.
            const tried = shape.apply(a, n);
            const problems = problemsWith(tried);
            const why = problems.length ? lowerFirst(reasonFor(problems, tried, shape.own ?? [], where)) : undefined;
            return n < shape.min ? `${n} is too low${why ? `: ${why}` : ''}. The lowest that fits is ${shape.min}.` : `${n} is too high${why ? `: ${why}` : ''}. The highest that fits is ${shape.max}.`;
          }
          if (excluded.has(n)) return `${n} contradicts your other answers (a bug in tep); pick another.`;
          return undefined;
        },
      });
      const n = Number(raw.trim());
      const next = shape.apply(a, n);
      if (problemsWith(next).length) {
        this.bug(next, shape.message, String(n), where, shape.own);
        excluded.add(n);
        continue;
      }
      return next;
    }
  }

  private async text(a: Answers, shape: TextShape, where: Where): Promise<Answers> {
    const excluded = new Set<string>();
    for (;;) {
      const raw = await this.p.text({
        message: shape.message,
        ...(shape.initial !== undefined ? { initialValue: shape.initial } : {}),
        ...(shape.placeholder ? { placeholder: shape.placeholder } : {}),
        validate: (v) => (excluded.has(v) ? 'That contradicts your other answers (a bug in tep); type something else.' : shape.validate(v)),
      });
      const next = shape.apply(a, raw);
      if (problemsWith(next).length) {
        this.bug(next, shape.message, `"${raw}"`, where, shape.own);
        excluded.add(raw);
        continue;
      }
      return next;
    }
  }

  /** Ask one field's question. A value `defaults` asks for (from pasted rules or a loaded file) that the question cannot take is named as dropped, never passed over in silence. */
  private async field(a: Answers, f: CliField, where: Where, defaults: Record<string, unknown> = {}, review = false, from = 'the file'): Promise<Answers> {
    const shape = this.shapeField(f, a, where, defaults);
    const wanted = defaults[f.name];
    if (wanted !== undefined && !(f.name in (f.group === 'rules' ? a.rules : f.group === 'options' ? a.options : a.output))) {
      const reason =
        shape.kind === 'number'
          ? typeof wanted === 'number' && (wanted < shape.min || wanted > shape.max)
            ? ((wanted < shape.min ? shape.below : shape.above) ?? `only ${shape.min} to ${shape.max} fit the other rules`)
            : undefined
          : shape.kind === 'text'
            ? shape.validate(String(wanted))
            : shape.choices.find((c) => c.value === wanted)?.blocked;
      if (reason) {
        this.p.warn(`Dropped ${from === 'the pasted rules' ? 'the pasted rule for' : `${from}'s value for`} ${f.label}, ${describeValue(f, wanted)}: ${lowerFirst(reason)}. tep's passwords will not meet it; check what the site accepts.`);
        a = { ...a, dropped: [...(a.dropped ?? []), { field: f.name, value: wanted, from, reason }] };
      }
    }
    if (shape.kind === 'number') return this.number(a, shape, where);
    if (shape.kind === 'text') return this.text(a, shape, where);
    const r = await this.select(a, shape, where, { review });
    if (f.name === 'strength' && r.value === OTHER_BITS) {
      const current = reqOf(a).targetBits;
      return this.number(a, bitsShape(current), where);
    }
    return r.answers;
  }

  // ------------------------------------------------------------ the first pass

  private async firstPass(start: Answers, from: 'mode' | 'rules' | 'options' | 'output' = 'mode', defaults: Record<string, unknown> = {}): Promise<Answers> {
    let a = start;
    const stages = ['mode', 'rules', 'options', 'output'] as const;
    for (const stage of stages.slice(stages.indexOf(from))) {
      if (stage === 'mode') a = (await this.select(a, modeShape(a, BEFORE_REVIEW), BEFORE_REVIEW)).answers;
      if (stage === 'rules') a = await this.askRules(a, BEFORE_REVIEW, defaults);
      if (stage === 'options') a = await this.askOptions(a, BEFORE_REVIEW, defaults);
      if (stage === 'output') {
        const change = (await this.select(a, outputHowShape(), BEFORE_REVIEW)).value;
        if (change) for (const f of fieldsIn('output')) a = await this.field(a, f, BEFORE_REVIEW);
      }
    }
    return a;
  }

  /** Where the site's rules come from, and then any rule to ask. */
  private async askRules(a: Answers, where: Where, defaults: Record<string, unknown> = {}): Promise<Answers> {
    const r = await this.select(a, rulesHowShape(a, where), where);
    const how = r.value;
    if (how.kind === 'site') return r.answers;
    if (how.kind === 'paste') return this.paste(r.answers, where);
    return this.askEachRule({ ...r.answers, site: undefined, rules: {} }, where, defaults);
  }

  private async askEachRule(a: Answers, where: Where, defaults: Record<string, unknown>, from = 'the file'): Promise<Answers> {
    let x: Answers = { ...a, rulesAnswered: true };
    for (const name of RULE_ORDER) x = await this.field(x, fieldNamed(name)!, where, defaults, false, from);
    return x;
  }

  /** The site's rules from its sign-up form's wording. */
  private async paste(a: Answers, where: Where): Promise<Answers> {
    const text = await this.p.text({
      message: 'Paste the site\'s rules (one line)',
      placeholder: 'Must be 8-20 characters and include a number and one of !@#$%',
      validate: (v) => {
        if (!v.trim()) return 'Paste the rules, or press Ctrl+C to stop.';
        const read = parseRuleText(v);
        if (read.understood.length) return undefined;
        if (read.unsupported.length) return `Nothing in that can be kept: ${read.unsupported.join('; ')}.`;
        return 'No password rules found in that. It should read like a sign-up form\'s rules, such as "8-20 characters, at least one number".';
      },
    });
    const parsed = parseRuleText(text);
    // What the text does not say stays as it was: the rules so far, or the Typical site's before any.
    const from = a.site || Object.keys(a.rules).length ? a : { ...a, site: DEFAULT_SITE, rules: {} };
    const merged = mergeParsedRules(reqOf(from), parsed).rules;
    const values: Record<string, unknown> = Object.fromEntries(fieldsIn('rules').map((f) => [f.name, merged[f.target.key as keyof Requirements]]));
    this.p.info(`Read as: ${parsed.understood.join('; ')}.`);
    // What the text says that the tool cannot keep is dropped, and said, never applied cut down.
    if (parsed.unsupported.length) this.p.warn(`Dropped, as this tool cannot keep ${parsed.unsupported.length === 1 ? 'it' : 'them'}: ${parsed.unsupported.join('; ')}.`);
    const next: Answers = { ...a, site: undefined, rules: values, rulesAnswered: true };
    const problems = problemsWith(next);
    if (!problems.length) return next;
    this.p.warn(`Those rules do not fit together: ${reasonFor(problems, next, [], where)}. Asking each rule, starting from what the text said where that fits; a rule that cannot be kept is named as it is dropped.`);
    return this.askEachRule({ ...a, site: undefined, rules: {} }, where, values, 'the pasted rules');
  }

  private async askOptions(a: Answers, where: Where, defaults: Record<string, unknown> = {}): Promise<Answers> {
    const r = await this.select(a, optionsHowShape(a, where), where);
    let x = r.answers;
    if (r.value === 'preset') return x;
    const unused = new Set(unusedIn(x.mode ?? DEFAULT_TYPING_MODE).map((u) => reqField(u.key)!.name));
    for (const f of fieldsIn('options')) {
      if (unused.has(f.name)) continue;
      x = await this.field(x, f, where, defaults);
    }
    return x;
  }

  // ------------------------------------------------------------ a loaded file

  /** A loaded file's answers, asked again from the first stage at which they stop fitting. */
  private async repair(a: Answers): Promise<Answers> {
    const problems = problemsWith(a);
    if (!problems.length) return a;
    const rulesAlone: Answers = { ...a, optionsHow: undefined, options: {} };
    const stage = problemsWith(rulesAlone).length ? 'rules' : 'options';
    const where = whereIn(reviewLines(a));
    const e = explainProblem(problems[0]!, reqOf(a), { source: (f) => ({ kind: 'wizard', line: where.lineOf(f) ?? 0, label: f.label }) });
    this.p.warn(`${this.opts.file} contradicts itself: ${e.title} Asking the ${stage === 'rules' ? 'site\'s rules' : 'options'} again, starting from the file's values where they fit.`);
    const defaults = stage === 'rules' ? { ...rulesOf(a), ...a.options } : { ...a.options };
    const start: Answers = stage === 'rules' ? { ...a, site: undefined, rules: {}, rulesAnswered: false, optionsHow: undefined, options: {} } : { ...a, optionsHow: undefined, options: {} };
    return this.firstPass(start, stage, defaults);
  }

  // ------------------------------------------------------------ review

  private show(a: Answers, lines: ReviewLine[]) {
    const width = this.p.noteWidth;
    const body = formatReview(lines, width);
    const req = reqOf(a);
    const where = whereIn(lines);
    for (const w of warningsOf(req)) {
      const e = explainWarning(w, req, { source: (f) => ({ kind: 'wizard', line: where.lineOf(f) ?? 0, label: f.label }) });
      body.push('', ...wrapHanging(`Warning: ${e.title}`, width, 'Warning: '.length), ...wrapHanging(`  ${e.fix}`, width, 2));
    }
    const dropped = (a.dropped ?? []).filter((d) => valueIn(a, fieldNamed(d.field)!) !== d.value);
    for (const d of dropped) {
      const f = fieldNamed(d.field)!;
      body.push('', ...wrapHanging(`Dropped: ${f.label} ${describeValue(f, d.value)} (${d.from} asked for it): ${lowerFirst(d.reason)}.`, width, 'Dropped: '.length));
    }
    const sample = this.sample(a);
    if (sample) body.push('', ...wrapHanging(`Sample: ${sample.password}   ${sample.badges}`, width, 'Sample: '.length), ...wrapHanging(`        hint: ${sample.hint}`, width, '        hint: '.length));
    this.p.note(body.join('\n'), `Your answers, for ${this.opts.file}`);
  }

  private sample(a: Answers): { password: string; hint: string; badges: string } | undefined {
    const req = { ...reqOf(a), count: 1 };
    const sentenceOptions = { ...DEFAULT_SENTENCE_OPTIONS, ...(a.sentence as Partial<SentenceOptions>) };
    const outcome = runInputs(inputsFor({ mode: 'generated', req, sentence: '', sentenceOptions, mappingSettings: a.swaps ?? DEFAULT_MAPPING_SETTINGS }));
    if (!outcome.ok) return undefined;
    const [s] = presentSuggestions(outcome.suggestions, a.mode ?? DEFAULT_TYPING_MODE, (a.output.sort as SortOrder | undefined) ?? DEFAULT_SORT);
    return s ? { password: s.password, hint: s.hint, badges: badges(scoreReadings({ strength: s.strength, raw: s.raw, difficulty: s.difficulty, memorability: s.memorability }), PLAIN) } : undefined;
  }

  private async review(start: Answers): Promise<WizardResult> {
    let a = start;
    for (;;) {
      const lines = reviewLines(a);
      this.show(a, lines);
      let choice: string;
      try {
        choice = (
          await this.p.text({
            message: reviewPrompt(lines.length, this.p.noteWidth),
            validate: (v) => {
              const t = v.trim().toLowerCase();
              if (t === 's' || t === 'q') return undefined;
              if (/^\d+$/.test(t) && Number(t) >= 1 && Number(t) <= lines.length) return undefined;
              return `Type a line number from 1 to ${lines.length}, s to save or q to quit.`;
            },
          })
        )
          .trim()
          .toLowerCase();
      } catch (e) {
        if (e instanceof Cancelled && e.key === 'escape') return { kind: 'quit' }; // Esc means back: out of the review, nothing written
        throw e;
      }
      if (choice === 'q') return { kind: 'quit' };
      if (choice === 's') {
        const problems = problemsWith(a);
        if (problems.length) {
          // Every question kept this from happening; if it did, saving it would write a contradiction.
          const where = whereIn(lines);
          this.p.error(`Not saved: ${reasonFor(problems, a, [], where)}. This is a bug in tep; please report it at ${ISSUES}. Change one of the lines named.`);
          continue;
        }
        if (this.opts.confirmSave && !(await this.opts.confirmSave())) continue;
        return { kind: 'save', answers: a };
      }
      try {
        a = await this.edit(a, lines.find((l) => l.n === Number(choice))!, lines);
      } catch (e) {
        if (!(e instanceof Cancelled) || e.key !== 'escape') throw e;
        this.p.info(`Back to the review; line ${choice} is unchanged.`); // Esc means back; Ctrl+C would have stopped
      }
    }
  }

  /** Change one review line: its question again, shaped by every other line. */
  private async edit(a: Answers, line: ReviewLine, lines: ReviewLine[]): Promise<Answers> {
    const where = whereIn(lines);
    const blocked = (shape: SelectShape<unknown>, current: unknown) => {
      const others = shape.choices.filter((c) => c.value !== current);
      return others.length > 0 && others.every((c) => c.blocked) ? others[0]!.blocked : undefined;
    };
    const holdIt = (reason: string) => this.p.warn(`Line ${line.n} cannot be changed: every other choice contradicts another line. ${reason}. Change that line first.`);

    switch (line.edit.kind) {
      case 'mode': {
        const shape = modeShape(a, where) as SelectShape<unknown>;
        const why = blocked(shape, a.mode ?? DEFAULT_TYPING_MODE);
        if (why) {
          holdIt(why);
          return a;
        }
        const r = await this.select(a, shape, where, { review: true });
        let next = r.answers;
        if (next.optionsHow === 'each' && next.mode !== a.mode) {
          const presetShape = optionsHowShape(next, where, true);
          const preset = presetShape.choices.find((c) => c.value === 'preset')!;
          if (preset.blocked) this.p.info(`The ${modeLabel(next.mode!)} preset does not fit these rules (${lowerFirst(preset.blocked)}), so your options stay as they are.`);
          else if (await this.p.confirm({ message: `Take the ${modeLabel(next.mode!)} preset for the options? It replaces the options you set one by one.`, initialValue: false })) {
            next = presetShape.apply(next, 'preset');
          }
        }
        return next;
      }
      case 'rules-how': {
        const shape = rulesHowShape(a, where);
        const r = await this.select(a, shape, where, { review: true });
        if (r.value.kind === 'paste') return this.paste(r.answers, where);
        return r.answers;
      }
      case 'options-how': {
        const shape = optionsHowShape(a, where, true);
        return (await this.select(a, shape, where, { review: true })).answers;
      }
      case 'field': {
        const f = line.edit.field;
        const shape = this.shapeField(f, a, where);
        if (shape.kind === 'select') {
          const why = blocked(shape, shape.initial);
          if (why) {
            holdIt(why);
            return a;
          }
        }
        if (shape.kind === 'number' && shape.min === shape.max) {
          holdIt(shape.above ?? shape.below ?? 'Nothing else fits');
          return a;
        }
        return this.field(a, f, where, {}, true);
      }
    }
  }
}


/** The command to run once a file is saved. */
export const runHint = (file: string) => (file === 'tep.yml' ? 'tep g' : `tep g -c ${file}`);

