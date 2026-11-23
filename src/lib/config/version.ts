// The configuration format's version: a configuration says which it is.
// Version 2 renamed version 1's mode to typing-mode and added app-mode; both
// are read, and only version 2 is written.
export const CONFIG_VERSION = 2;
/** The versions a configuration may state, oldest first. */
export const READ_VERSIONS: readonly number[] = [1, 2];
/** The versions read, as a message says them: "versions 1 and 2". */
export const VERSIONS_READ = READ_VERSIONS.length === 1 ? `version ${READ_VERSIONS[0]}` : `versions ${READ_VERSIONS.slice(0, -1).join(', ')} and ${READ_VERSIONS.at(-1)}`;
/** A configuration is a few hundred bytes; anything this big is the wrong file. tep checks a file's size before reading it, configFromYaml a text's before parsing it. */
export const MAX_CONFIG_BYTES = 64 * 1024;
