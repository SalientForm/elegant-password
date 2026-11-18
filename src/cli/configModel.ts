// A config file's contents in the engine's terms: the core's configuration
// (src/lib/config/model.ts) and tep's own output section. Pure: the reader
// (config.ts), the writer (configText.ts), the wizard and the Fun page's CLI
// prompt share it.

import { emptyModel as emptyConfigModel, type ConfigModel as CoreConfigModel } from '../lib/config/model';

/** A config file's contents in the engine's terms. Only what the file states. */
export interface ConfigModel extends CoreConfigModel {
  output: Record<string, unknown>;
}

export const emptyModel = (): ConfigModel => ({ ...emptyConfigModel(), output: {} });
