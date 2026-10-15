// The generation engine as one pure function of plain inputs, so it can run
// in a worker, in a test, or inline: the same request always means the same
// thing, and the result is plain data that can be stored and restored.

import { fromSentence, type SentenceOptions } from './fromSentence';
import { generate, RequirementsError, type Plan, type Requirements, type Suggestion } from './generate';
import { mappingKey, type Mapping } from './twists';

export type Mode = 'generated' | 'sentence';
export const MODES: readonly Mode[] = ['generated', 'sentence'];

export interface GenerateInputs {
  mode: Mode;
  req: Requirements;
  sentence: string;
  sentenceOptions: SentenceOptions;
  mappings: readonly Mapping[];
}

export interface GenerateRequest extends GenerateInputs {
  /** Lets the caller ignore answers to requests it has since superseded. */
  id: number;
}

export type Outcome =
  | {
      ok: true;
      source: Mode;
      separator: string;
      suggestions: Suggestion[];
      warnings: string[];
      /** The exact plan, for the strength panel (generated mode only). */
      plan?: Plan;
    }
  | {
      ok: false;
      error: string;
      /** True for a bug rather than a requirements problem. */
      unexpected?: boolean;
    };

export interface GenerateResponse {
  id: number;
  outcome: Outcome;
}

/** Run the generator for these inputs. Never throws: problems come back as an outcome. */
export function runInputs(inputs: GenerateInputs): Outcome {
  try {
    if (inputs.mode === 'sentence') {
      const r = fromSentence(inputs.sentence, inputs.req, inputs.sentenceOptions, { mappings: inputs.mappings });
      return { ok: true, source: 'sentence', separator: r.separator, suggestions: r.suggestions, warnings: r.warnings };
    }
    const r = generate(inputs.req, { mappings: inputs.mappings });
    return { ok: true, source: 'generated', separator: r.plan.separator, suggestions: r.suggestions, warnings: r.warnings, plan: r.plan };
  } catch (e) {
    if (e instanceof RequirementsError) return { ok: false, error: e.message };
    return { ok: false, error: e instanceof Error ? e.message : String(e), unexpected: true };
  }
}

/**
 * A stable key for everything that changes the result. Inputs that do not
 * matter in a mode (the sentence while making one up) are left out, so
 * typing in the other mode's box does not throw passwords away.
 */
export function inputsKey(inputs: GenerateInputs): string {
  const req = Object.fromEntries(Object.entries(inputs.req).sort(([a], [b]) => a.localeCompare(b)));
  const mappings = inputs.mappings.map(mappingKey);
  const sentence = inputs.mode === 'sentence' ? { sentence: inputs.sentence, sentenceOptions: inputs.sentenceOptions } : {};
  return JSON.stringify({ mode: inputs.mode, req, mappings, ...sentence });
}
