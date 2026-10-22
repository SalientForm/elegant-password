// The built app refuses to run inside another site's frame. GitHub Pages
// sends no headers the app can set, and a meta-tag CSP cannot carry
// `frame-ancestors` (browsers ignore it there, and `X-Frame-Options` too), so
// any page could frame the app and lay its own over it: a click meant for
// that page lands on Copy, or the typing test reads what was meant for a
// field of its own. Framed, the app mounts nothing and shows a notice with a
// link that opens it in a tab of its own. The proper fix is the header
// `Content-Security-Policy: frame-ancestors 'none'` on a host that sends one
// (TODO.md, "Protect the saved list").
//
// The check runs from the bundle, since the CSP forbids inline scripts, and
// only in the production build, as the CSP is: preview panes frame the dev
// server. The notice is plain DOM, so it needs no React and nothing the CSP
// forbids (no innerHTML, no inline style; the look is .framed-notice in
// styles.css).

/** Whether this page is inside a frame; a browser that refuses to say counts as framed. */
export function isFramed(win: Window = window): boolean {
  try {
    return win.top !== win.self;
  } catch {
    return true;
  }
}

/** Whether the app should refuse to start here: the production build, framed. */
export const refusesFrame = (prod: boolean, win: Window = window) => prod && isFramed(win);

export const FRAMED_HEADING = 'Elegant Passwords opens in its own tab';
export const FRAMED_TEXT =
  "This page has put it inside another site's page, where what you type and copy could be watched or covered. It runs only on its own.";
export const FRAMED_LINK = 'Open Elegant Passwords in a new tab';

/** Replaces `root`'s content with the notice: a heading, why, a link that opens `href` in a new tab, and the address to type. */
export function showFramedNotice(root: HTMLElement, href: string): void {
  const doc = root.ownerDocument;
  const el = <K extends keyof HTMLElementTagNameMap>(tag: K, text?: string) => {
    const node = doc.createElement(tag);
    if (text) node.textContent = text;
    return node;
  };
  const link = el('a', FRAMED_LINK);
  link.href = href;
  link.target = '_blank'; // not _top: a sandboxed frame may not navigate the page above it, and a new tab shows the real address
  link.rel = 'noopener noreferrer';
  const open = el('p');
  open.append(link);
  const address = el('p', 'Or go to ');
  address.append(el('code', href));
  const notice = el('div');
  notice.className = 'framed-notice';
  notice.append(el('h1', FRAMED_HEADING), el('p', FRAMED_TEXT), open, address);
  root.replaceChildren(notice);
}
