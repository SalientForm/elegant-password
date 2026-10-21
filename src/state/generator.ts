// Where generation runs. In the browser it runs in a Web Worker, so typing
// never waits on the maths and the old passwords stay on screen until the
// new ones are ready. Without a worker (tests, old browsers) it runs inline
// through the same interface.
//
// The worker is created on first use and again after dispose(), so a React
// StrictMode mount/unmount/mount cycle (which disposes once) cannot leave the
// app talking to a dead worker. Only the newest request matters: an older
// one settles as superseded the moment a newer one arrives, so nothing waits
// on it. The worker runs one request at a time and cannot be interrupted, so
// at most one is sent to it: a newer request waits in a single slot (each
// newer one takes the slot from the last) and is sent when the worker
// answers. Should the worker still be busy with a superseded request after
// a short while, it is thrown away and a fresh one takes the newest request,
// so old work never holds up new work for long. If a worker fails to load,
// crashes, or stays silent past the timeout on the request it was sent, that
// request and all later ones run inline instead: the app always answers.

import { runInputs, type GenerateRequest, type GenerateResponse, type Outcome } from '../lib/engine';

export interface Generator {
  run(request: GenerateRequest): Promise<Outcome>;
  dispose(): void;
}

/** The part of a Worker this code uses, so a fake can stand in. */
export interface WorkerLike {
  postMessage(message: unknown): void;
  addEventListener(type: 'message', listener: (event: { data: unknown }) => void): void;
  addEventListener(type: 'error', listener: (event: unknown) => void): void;
  terminate(): void;
}

export interface WorkerGeneratorOptions {
  /** How long a worker may stay silent on a request before the app gives up on it and runs inline. */
  timeoutMs?: number;
  /** How long the worker may stay busy with a superseded request, a newer one waiting, before it is replaced. */
  restartAfterMs?: number;
}

export const DEFAULT_WORKER_TIMEOUT_MS = 10_000;
/** How long the worker may stay busy with a superseded request before it is replaced with a fresh one. */
export const DEFAULT_RESTART_AFTER_MS = 300;

/** Runs the engine on the calling thread. */
export function syncGenerator(): Generator {
  return {
    run: (request) => Promise.resolve(runInputs(request)),
    dispose: () => {},
  };
}

const isResponse = (x: unknown): x is GenerateResponse =>
  typeof x === 'object' && x !== null && typeof (x as GenerateResponse).id === 'number' && typeof (x as GenerateResponse).outcome === 'object';

interface Pending {
  request: GenerateRequest;
  resolve: (o: Outcome) => void;
  /** The give-up timer, running from when the request was sent to the worker. */
  timer?: ReturnType<typeof setTimeout>;
}

/** What an older request settles with once a newer one is sent; the caller only ever wants the newest. */
export const SUPERSEDED: Outcome = { ok: false, error: 'Superseded by a newer request.' };

/**
 * Runs the engine in a worker made by `createWorker`. Answers are matched to
 * requests by id. See the note at the top of this file for how requests
 * queue, and what happens when the worker is disposed, fails, or stays
 * silent.
 */
export function workerGenerator(createWorker: () => WorkerLike, options: WorkerGeneratorOptions = {}): Generator {
  const timeoutMs = options.timeoutMs ?? DEFAULT_WORKER_TIMEOUT_MS;
  const restartAfterMs = options.restartAfterMs ?? DEFAULT_RESTART_AFTER_MS;
  /** The newest request, the only one anybody waits for: sent to the worker, or waiting for it. */
  let current: Pending | undefined;
  /** The request the worker is working on, and since when; it may be an older one than `current`. */
  let busy: { id: number; since: number } | undefined;
  let restartTimer: ReturnType<typeof setTimeout> | undefined;
  let worker: WorkerLike | undefined;
  let broken = false;

  const stopWorker = () => {
    try {
      worker?.terminate();
    } catch {
      // Already gone.
    }
    worker = undefined;
    busy = undefined;
    clearTimeout(restartTimer);
    restartTimer = undefined;
  };

  /** Give up on the worker: answer the newest request inline and stay inline from now on. */
  const giveUp = () => {
    broken = true;
    stopWorker();
    const p = current;
    current = undefined;
    if (!p) return;
    clearTimeout(p.timer);
    p.resolve(runInputs(p.request));
  };

  const ensureWorker = (): WorkerLike => {
    if (worker) return worker;
    const w = createWorker();
    w.addEventListener('message', (event) => {
      if (w !== worker || !isResponse(event.data)) return; // a worker thrown away may still answer
      if (busy?.id !== event.data.id) return;
      busy = undefined;
      clearTimeout(restartTimer);
      restartTimer = undefined;
      const p = current;
      if (p?.request.id === event.data.id) {
        current = undefined;
        clearTimeout(p.timer);
        p.resolve(event.data.outcome);
      } else if (p) send(p); // the worker is free: the newest request, which waited, goes now
    });
    w.addEventListener('error', () => {
      if (w === worker) giveUp();
    });
    worker = w;
    return w;
  };

  const send = (p: Pending) => {
    p.timer = setTimeout(() => {
      if (current === p) giveUp();
    }, timeoutMs);
    busy = { id: p.request.id, since: Date.now() };
    try {
      ensureWorker().postMessage(p.request);
    } catch {
      giveUp();
    }
  };

  /** Throw the worker away, busy with superseded work, and send the newest request to a fresh one. */
  const restart = () => {
    const p = current;
    stopWorker();
    if (p) send(p);
  };

  return {
    run(request) {
      if (broken) return Promise.resolve(runInputs(request));
      if (current) {
        clearTimeout(current.timer);
        current.resolve(SUPERSEDED);
        current = undefined;
      }
      return new Promise((resolve) => {
        const p: Pending = { request, resolve };
        current = p;
        if (!busy) return send(p);
        const waited = Date.now() - busy.since;
        if (waited >= restartAfterMs) return restart();
        // Waits for the worker's answer to the old request, or for the restart, whichever comes first.
        restartTimer ??= setTimeout(() => {
          restartTimer = undefined;
          if (current && busy && current.request.id !== busy.id) restart();
        }, restartAfterMs - waited);
      });
    },
    dispose() {
      clearTimeout(current?.timer);
      current = undefined;
      stopWorker(); // the next run makes a fresh one
    },
  };
}

/** A worker-backed generator when the browser has workers, otherwise inline. */
export function createGenerator(): Generator {
  if (typeof Worker === 'undefined') return syncGenerator();
  try {
    return workerGenerator(() => new Worker(new URL('../worker.ts', import.meta.url), { type: 'module' }));
  } catch {
    return syncGenerator();
  }
}
