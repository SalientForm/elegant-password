// @vitest-environment jsdom
import { describe, expect, it, vi } from 'vitest';
import { LINE_PX, pageScrollFor, wheelPixels } from './columnScroll';

describe('page-first wheel routing', () => {
  it('scrolls the page while the header is in view, then leaves the columns to themselves', () => {
    expect(pageScrollFor(100, 180, 0)).toBe(100); // header fully in view: the page moves
    expect(pageScrollFor(100, 180, 120)).toBe(60); // only what is left of the header
    expect(pageScrollFor(100, 180, 180)).toBeUndefined(); // header gone: the column scrolls
    expect(pageScrollFor(100, 180, 400)).toBeUndefined();
    expect(pageScrollFor(100, 180.6, 180)).toBeUndefined(); // the page stops on whole pixels: a fraction left is "arrived"
    expect(pageScrollFor(100, 181, 180)).toBe(1);
  });

  it('never intercepts scrolling up', () => {
    expect(pageScrollFor(-100, 180, 0)).toBeUndefined();
    expect(pageScrollFor(-100, 180, 500)).toBeUndefined();
    expect(pageScrollFor(0, 180, 0)).toBeUndefined();
  });
});

describe('wheel steps in lines or screens', () => {
  it('counts them in pixels, so a Windows wheel set to "one screen at a time" still moves the header away', () => {
    expect(wheelPixels({ deltaY: 100, deltaMode: 0 }, 800)).toBe(100);
    expect(wheelPixels({ deltaY: 3, deltaMode: 1 }, 800)).toBe(3 * LINE_PX);
    expect(wheelPixels({ deltaY: 1, deltaMode: 2 }, 800)).toBe(800);
    expect(wheelPixels({ deltaY: -1, deltaMode: 2 }, 800)).toBe(-800);
    expect(pageScrollFor(wheelPixels({ deltaY: 1, deltaMode: 2 }, 800), 180, 0)).toBe(180); // one step, the whole header
  });
});

describe('usePageFirstWheel and zoom', () => {
  it('never intercepts Ctrl+wheel or ⌘+wheel, which are pinch zoom, while still routing a plain wheel to the page', async () => {
    const { render, cleanup, fireEvent } = await import('@testing-library/react');
    const React = await import('react');
    const { usePageFirstWheel } = await import('./columnScroll');
    function Columns() {
      const ref = React.useRef<HTMLElement>(null);
      usePageFirstWheel(ref, true);
      return React.createElement('main', { ref, 'data-testid': 'main' }, React.createElement('div', { style: { top: 0 } }));
    }
    const scrollBy = vi.fn();
    Object.defineProperty(window, 'scrollBy', { configurable: true, value: scrollBy });
    Object.defineProperty(document.documentElement, 'scrollHeight', { configurable: true, value: 3000 });
    Object.defineProperty(window, 'innerHeight', { configurable: true, value: 800 });
    const { getByTestId } = render(React.createElement(Columns));
    const main = getByTestId('main');
    main.getBoundingClientRect = () => ({ top: 200, bottom: 1000, left: 0, right: 100, width: 100, height: 800, x: 0, y: 200, toJSON: () => ({}) });
    expect(fireEvent.wheel(main, { deltaY: 50 })).toBe(false); // intercepted: routed to the page
    expect(scrollBy).toHaveBeenCalled();
    scrollBy.mockClear();
    fireEvent.wheel(main, { deltaY: 1, deltaMode: 2 }); // one screen, as Windows reports it: the page moves its whole way, not 1 px
    expect(scrollBy).toHaveBeenCalledWith({ top: 200 });
    scrollBy.mockClear();
    expect(fireEvent.wheel(main, { deltaY: 50, ctrlKey: true })).toBe(true); // left to the browser
    expect(fireEvent.wheel(main, { deltaY: 50, metaKey: true })).toBe(true);
    expect(scrollBy).not.toHaveBeenCalled();
    cleanup();
    delete (document.documentElement as { scrollHeight?: unknown }).scrollHeight;
  });
});
