// Writing a tep config file's text: the core's writer
// (src/lib/config/text.ts) in tep's words, with tep's output section after
// the options. Pure, so the Fun page's CLI prompt can show a real file.

import { configToText, sectionLines } from '../lib/config/text';
import type { ConfigModel } from './configModel';
import { fieldsIn } from './fields';

/** The file's text: header, then each section with a comment saying what it is. Sections the model does not state are left out. */
export function serializeConfig(model: ConfigModel, today: string): string {
  const output = sectionLines('output', fieldsIn('output'), model.output);
  return configToText(model, {
    header: [`tep config, written by \`tep config\` on ${today}.`, 'Run `tep g` in this directory, or `tep g -c <this file>`. Edit it by hand or run `tep config` again.'],
    presetNote: (label) => `the ${label} options as tep sets them, now and as they change`,
    sentenceNote: 'for --sentence',
    afterOptions: output.length ? ['', ...output] : [],
  });
}
