// Where generation runs. In the browser it runs in a Web Worker, so typing
// never waits on the maths and the old passwords stay on screen until the
// new ones are ready. Without a worker (tests, old browsers) it runs inline
// through the same interface.
//
// The worker is created on first use and again after dispose(), so a React
// StrictMode mount/unmount/mount cycle (which disposes once) cannot leave the
// app talking to a dead worker. If a worker fails to load, crashes, or stays
// silent past the timeout, every outstanding request and all later ones run
// inline instead: the app always answers.

import { runInputs, type GenerateRequest, type GenerateResponse, type Outcome } from './engine';

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
}

export const DEFAULT_WORKER_TIMEOUT_MS = 10_000;

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
  timer: ReturnType<typeof setTimeout>;
}

/**
 * Runs the engine in a worker made by `createWorker`. Answers are matched to
 * requests by id. See the note at the top of this file for what happens
 * when the worker is disposed, fails, or stays silent.
 */
export function workerGenerator(createWorker: () => WorkerLike, options: WorkerGeneratorOptions = {}): Generator {
  const timeoutMs = options.timeoutMs ?? DEFAULT_WORKER_TIMEOUT_MS;
  const pending = new Map<number, Pending>();
  let worker: WorkerLike | undefined;
  let broken = false;

  /** Give up on the worker: answer everything outstanding inline and stay inline from now on. */
  const giveUp = () => {
    broken = true;
    const items = [...pending.values()];
    pending.clear();
    try {
      worker?.terminate();
    } catch {
      // Already gone.
    }
    worker = undefined;
    for (const p of items) {
      clearTimeout(p.timer);
      p.resolve(runInputs(p.request));
    }
  };

  const ensureWorker = (): WorkerLike => {
    if (worker) return worker;
    const w = createWorker();
    w.addEventListener('message', (event) => {
      if (!isResponse(event.data)) return;
      const p = pending.get(event.data.id);
      if (!p) return;
      pending.delete(event.data.id);
      clearTimeout(p.timer);
      p.resolve(event.data.outcome);
    });
    w.addEventListener('error', giveUp);
    worker = w;
    return w;
  };

  return {
    run(request) {
      if (broken) return Promise.resolve(runInputs(request));
      return new Promise((resolve) => {
        const timer = setTimeout(() => {
          if (pending.has(request.id)) giveUp();
        }, timeoutMs);
        pending.set(request.id, { request, resolve, timer });
        try {
          ensureWorker().postMessage(request);
        } catch {
          giveUp();
        }
      });
    },
    dispose() {
      for (const p of pending.values()) clearTimeout(p.timer);
      pending.clear();
      try {
        worker?.terminate();
      } catch {
        // Already gone.
      }
      worker = undefined; // the next run makes a fresh one
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
