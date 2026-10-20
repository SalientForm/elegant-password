// Which clipboard tool --copy uses, by platform and session. Pure, so the
// Fun page's CLI prompt lists exactly what tep tries.

export interface ClipboardTool {
  /** The command and its arguments. */
  command: string[];
  /** When it is the right tool, for the message when none is found. */
  when: string;
}

/** The tools to try, in order, for this platform and session. */
export function clipboardTools(platform: NodeJS.Platform, env: Record<string, string | undefined>): ClipboardTool[] {
  if (platform === 'darwin') return [{ command: ['pbcopy'], when: 'macOS' }];
  const tools: ClipboardTool[] = [];
  if (env.WAYLAND_DISPLAY) tools.push({ command: ['wl-copy'], when: 'Wayland (package wl-clipboard)' });
  if (env.DISPLAY) {
    tools.push({ command: ['xclip', '-selection', 'clipboard'], when: 'X11 (package xclip)' });
    tools.push({ command: ['xsel', '--clipboard', '--input'], when: 'X11 (package xsel)' });
  }
  if (env.WSL_DISTRO_NAME) tools.push({ command: ['clip.exe'], when: 'WSL' });
  return tools;
}
