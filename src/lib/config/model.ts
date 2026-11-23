// A configuration's contents in the engine's terms: what a tep.yml, a saved
// web configuration or a package caller states, and nothing more. Pure: the
// readers, the writer, tep's wizard and the Fun page's CLI prompt share it.

import type { AppMode } from '../appModes';
import type { TypingMode } from '../difficulty';
import type { MappingSettings } from '../mappingSettings';

/** A configuration's contents in the engine's terms. Only what it states. */
export interface ConfigModel {
  appMode?: AppMode;
  typingMode?: TypingMode;
  /** A site preset's name. */
  site?: string;
  /** Rule values by field name, over the site preset. */
  rules: Record<string, unknown>;
  /** 'preset': the typing mode's preset as it is, now and as it changes. Otherwise option values by field name, over the preset. */
  options: 'preset' | Record<string, unknown>;
  sentence: Record<string, unknown>;
  swaps?: MappingSettings;
}

export const emptyModel = (): ConfigModel => ({ rules: {}, options: 'preset', sentence: {} });
