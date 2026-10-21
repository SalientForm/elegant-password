// The generation engine as one pure function of plain inputs, so it runs the
// same in the page, in the CLI and in a test: the same inputs always mean the
// same thing, and the result is plain data that can be stored and restored.

import { fromSentence, type SentenceOptions } from './fromSentence';
import { generate, RequirementsError, type GeneratedSentence, type Plan, type Requirements, type Suggestion } from './generate';
import { mappingKey, type Mapping } from './twists';

export type Mode = 'generated' | 'sentence';
export const MODES: readonly Mode[] = ['generated', 'sentence'];

export interface GenerateInputs {
  mode: Mode;
  req: Requirements;
  sentence: string;
  sentenceOptions: SentenceOptions;
  mappings: readonly Mapping[];
  /** The made-up sentence to keep (generated mode); null draws a new one. */
  generated?: GeneratedSentence | null;
  /**
   * The made-up sentence as the user edited it (generated mode); null or
   * blank while it is as drawn. An edited sentence is no longer a random
   * draw, so it is built and scored as the user's own sentence.
   */
  edited?: string | null;
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
      /** The made-up sentence every suggestion was built from (generated mode only). */
      generated?: GeneratedSentence;
    }
  | {
      ok: false;
      error: string;
      /** True for a bug rather than a requirements problem. */
      unexpected?: boolean;
    };

/** Run the generator for these inputs. Never throws: problems come back as an outcome. */
export function runInputs(inputs: GenerateInputs): Outcome {
  try {
    const own = ownSentence(inputs);
    if (own !== null) {
      const r = fromSentence(own, inputs.req, inputs.sentenceOptions, { mappings: inputs.mappings });
      return { ok: true, source: 'sentence', separator: r.separator, suggestions: r.suggestions, warnings: r.warnings };
    }
    const r = generate(inputs.req, { mappings: inputs.mappings, sentence: inputs.generated ?? undefined });
    return { ok: true, source: 'generated', separator: r.plan.separator, suggestions: r.suggestions, warnings: r.warnings, plan: r.plan, generated: r.sentence };
  } catch (e) {
    if (e instanceof RequirementsError) return { ok: false, error: e.message };
    return { ok: false, error: e instanceof Error ? e.message : String(e), unexpected: true };
  }
}

/** The text to build from as the user's own sentence: theirs, or the made-up one they edited; null to make one up. */
function ownSentence(inputs: GenerateInputs): string | null {
  if (inputs.mode === 'sentence') return inputs.sentence;
  return inputs.edited?.trim() ? inputs.edited : null;
}

/**
 * A stable key for everything that changes the result. Inputs that do not
 * matter in a mode (the sentence while making one up, the made-up sentence
 * while using your own) are left out, so typing in the other mode's box does
 * not throw passwords away.
 */
export function inputsKey(inputs: GenerateInputs): string {
  const req = Object.fromEntries(Object.entries(inputs.req).sort(([a], [b]) => a.localeCompare(b)));
  const mappings = inputs.mappings.map(mappingKey);
  const edited = inputs.edited?.trim() ? { edited: inputs.edited, sentenceOptions: inputs.sentenceOptions } : {};
  const sentence =
    inputs.mode === 'sentence' ? { sentence: inputs.sentence, sentenceOptions: inputs.sentenceOptions } : { generated: inputs.generated ?? null, ...edited };
  return JSON.stringify({ mode: inputs.mode, req, mappings, ...sentence });
}
