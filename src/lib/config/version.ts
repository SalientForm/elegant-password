// The configuration format's version: a configuration says which it is, and only this one is read.
export const CONFIG_VERSION = 1;
/** A configuration is a few hundred bytes; anything this big is the wrong file. Checked before the text is read, by tep and the Fun page's CLI prompt alike. */
export const MAX_CONFIG_BYTES = 64 * 1024;
