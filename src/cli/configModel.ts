// A config file's contents in the engine's terms. Pure: the reader
// (config.ts), the writer (configText.ts), the wizard and the Fun page's CLI
// prompt share it.

import type { TypingMode } from '../lib/difficulty';
import type { MappingSettings } from '../lib/mappingSettings';

/** A config file's contents in the engine's terms. Only what the file states. */
export interface ConfigModel {
  mode?: TypingMode;
  /** A site preset's name. */
  site?: string;
  /** Rule values by field name, over the site preset. */
  rules: Record<string, unknown>;
  /** 'preset': the mode's preset as it is, now and as it changes. Otherwise option values by field name, over the preset. */
  options: 'preset' | Record<string, unknown>;
  sentence: Record<string, unknown>;
  swaps?: MappingSettings;
  output: Record<string, unknown>;
}

export const emptyModel = (): ConfigModel => ({ rules: {}, options: 'preset', sentence: {}, output: {} });
