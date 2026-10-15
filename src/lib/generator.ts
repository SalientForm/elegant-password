// Where generation runs. In the browser it runs in a Web Worker, so typing
// never waits on the maths and the old passwords stay on screen until the
// new ones are ready. Without a worker (tests, old browsers) it runs inline
// through the same interface.

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

/** Runs the engine on the calling thread. */
export function syncGenerator(): Generator {
  return {
    run: (request) => Promise.resolve(runInputs(request)),
    dispose: () => {},
  };
}

const isResponse = (x: unknown): x is GenerateResponse =>
  typeof x === 'object' && x !== null && typeof (x as GenerateResponse).id === 'number' && typeof (x as GenerateResponse).outcome === 'object';

/**
 * Runs the engine in a worker. Answers are matched to requests by id. If
 * the worker fails to load or crashes, every outstanding request and all
 * later ones run inline instead, so the app keeps working.
 */
export function workerGenerator(worker: WorkerLike): Generator {
  const pending = new Map<number, { request: GenerateRequest; resolve: (o: Outcome) => void }>();
  let broken = false;
  worker.addEventListener('message', (event) => {
    if (!isResponse(event.data)) return;
    const p = pending.get(event.data.id);
    if (!p) return;
    pending.delete(event.data.id);
    p.resolve(event.data.outcome);
  });
  worker.addEventListener('error', () => {
    broken = true;
    for (const [id, p] of pending) {
      pending.delete(id);
      p.resolve(runInputs(p.request));
    }
  });
  return {
    run(request) {
      if (broken) return Promise.resolve(runInputs(request));
      return new Promise((resolve) => {
        pending.set(request.id, { request, resolve });
        worker.postMessage(request);
      });
    },
    dispose() {
      pending.clear();
      worker.terminate();
    },
  };
}

/** A worker-backed generator when the browser has workers, otherwise inline. */
export function createGenerator(): Generator {
  try {
    if (typeof Worker === 'undefined') return syncGenerator();
    const worker = new Worker(new URL('../worker.ts', import.meta.url), { type: 'module' });
    return workerGenerator(worker);
  } catch {
    return syncGenerator();
  }
}
