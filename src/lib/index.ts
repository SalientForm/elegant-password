// @salientform/elegant-passwords: the package's public API and its only
// entry (spec §3, §5). Everything else in src/lib is internal and may
// change; these names are the package's promise. zxcvbn's reading is on
// its own entry (zxcvbnEntry.ts), so it loads only for a caller that uses it.

export { APP_MODES, CONFIG_VERSION, DEFAULT_CONFIG, FIELDS, SITE_PRESETS, STRENGTH_PRESETS, TYPING_MODES } from './api/choices';
export type { Field, ModeChoice, SitePresetChoice, StrengthPresetChoice, ValueChoice } from './api/choices';
export { configFromYaml, configToYaml, readRulesText, resolveConfig } from './api/config';
export type { Message, Problem, Resolved, Settings } from './api/config';
export { generate, scorePassword } from './api/generate';
export type { DrawnSentence, GenerateRequest, Outcome, Readings, Suggestion } from './api/generate';
export type { Config, ConfigValue } from './config/json';
export type { Band, Reading } from './readings';
export type { RequirementCheck } from './generate';
