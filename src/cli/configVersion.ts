// The config file format's version: a file says which it is, and tep reads only this one.
export const CONFIG_VERSION = 1;
/** A tep config is a few hundred bytes; anything this big is the wrong file. Here, with no file system, so the Fun page's CLI prompt can name it. */
export const MAX_CONFIG_BYTES = 64 * 1024;
