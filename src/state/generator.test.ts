import { describe, expect, it, vi } from 'vitest';
import { runInputs, type GenerateRequest } from '../lib/engine';
import { DEFAULT_SENTENCE_OPTIONS } from '../lib/fromSentence';
import { DEFAULT_REQUIREMENTS } from '../lib/generate';
import { createGenerator, SUPERSEDED, syncGenerator, workerGenerator, type WorkerLike } from './generator';
import { BUILT_IN_MAPPINGS } from '../lib/twists';

const request = (id: number, over: Partial<GenerateRequest> = {}): GenerateRequest => ({
  id,
  mode: 'generated',
  req: DEFAULT_REQUIREMENTS,
  sentence: '',
  sentenceOptions: DEFAULT_SENTENCE_OPTIONS,
  mappings: BUILT_IN_MAPPINGS,
  ...over,
});

type Fake = WorkerLike & { flush(): void; fail(): void; deliver(data: unknown): void; terminated: boolean; queue: GenerateRequest[] };

/** A worker that answers only when told to, in whatever order it likes. */
function fakeWorker(order: 'fifo' | 'lifo' = 'fifo'): Fake {
  const listeners: Record<string, ((e: never) => void)[]> = { message: [], error: [] };
  const worker: Fake = {
    terminated: false,
    queue: [],
    postMessage: (m: unknown) => void worker.queue.push(m as GenerateRequest),
    addEventListener: (type: string, l: (e: never) => void) => void listeners[type]!.push(l),
    terminate: () => void (worker.terminated = true),
    deliver(data) {
      for (const l of listeners.message!) (l as (e: { data: unknown }) => void)({ data });
    },
    flush() {
      const items = order === 'fifo' ? worker.queue.splice(0) : worker.queue.splice(0).reverse();
      for (const r of items) {
        const { id, ...inputs } = r;
        worker.deliver({ id, outcome: runInputs(inputs) });
      }
    },
    fail() {
      for (const l of listeners.error!) (l as (e: unknown) => void)(new Error('boom'));
    },
  };
  return worker;
}

describe('generators', () => {
  it('runs inline', async () => {
    const out = await syncGenerator().run(request(1));
    expect(out.ok).toBe(true);
  });

  it('matches worker answers to requests by id, and a newer request supersedes an older one at once', async () => {
    const worker = fakeWorker();
    const gen = workerGenerator(() => worker, { timeoutMs: 30 });
    const a = gen.run(request(1, { req: { ...DEFAULT_REQUIREMENTS, count: 1 } }));
    const b = gen.run(request(2, { req: { ...DEFAULT_REQUIREMENTS, count: 3 } }));
    expect(await a).toBe(SUPERSEDED); // settled before the worker answers, and its timer is off
    worker.flush(); // the old answer arrives; nobody is waiting for it, and the newer request is sent
    worker.flush();
    const ob = await b;
    expect(ob.ok && ob.suggestions.length).toBe(3);
    await new Promise((r) => setTimeout(r, 60));
    expect(worker.terminated).toBe(false); // no timeout fired for the superseded request
    gen.dispose();
    expect(worker.terminated).toBe(true);
  });

  it('sends one request at a time: newer ones wait in one slot, each taking it from the last', async () => {
    const worker = fakeWorker();
    const gen = workerGenerator(() => worker, { restartAfterMs: 10_000 });
    const a = gen.run(request(1));
    const b = gen.run(request(2));
    const c = gen.run(request(3, { req: { ...DEFAULT_REQUIREMENTS, count: 2 } }));
    expect(worker.queue.map((r) => r.id)).toEqual([1]); // 2 and 3 were never sent
    expect(await a).toBe(SUPERSEDED);
    expect(await b).toBe(SUPERSEDED); // replaced in the slot by 3 without ever reaching the worker
    worker.flush(); // the worker finishes 1, and only then gets 3
    expect(worker.queue.map((r) => r.id)).toEqual([3]);
    worker.flush();
    const oc = await c;
    expect(oc.ok && oc.suggestions.length).toBe(2);
    gen.dispose();
  });

  it('answers the newest request straight away when it is the one the worker is on', async () => {
    const worker = fakeWorker();
    const gen = workerGenerator(() => worker);
    const p = gen.run(request(5));
    worker.flush();
    expect((await p).ok).toBe(true);
    const q = gen.run(request(6)); // the worker is free again: sent at once
    expect(worker.queue.map((r) => r.id)).toEqual([6]);
    worker.flush();
    expect((await q).ok).toBe(true);
    gen.dispose();
  });

  it('replaces a worker still busy with superseded work, and ignores the old one if it answers after all', async () => {
    const workers: Fake[] = [];
    const gen = workerGenerator(
      () => {
        const w = fakeWorker();
        workers.push(w);
        return w;
      },
      { restartAfterMs: 20 },
    );
    void gen.run(request(1));
    const b = gen.run(request(2, { req: { ...DEFAULT_REQUIREMENTS, count: 2 } }));
    expect(workers).toHaveLength(1);
    await new Promise((r) => setTimeout(r, 40));
    expect(workers[0]!.terminated).toBe(true);
    expect(workers).toHaveLength(2);
    expect(workers[1]!.queue.map((r) => r.id)).toEqual([2]);
    workers[0]!.flush(); // a late answer from the thrown-away worker changes nothing
    workers[1]!.flush();
    const ob = await b;
    expect(ob.ok && ob.suggestions.length).toBe(2);
    gen.dispose();
  });

  it('replaces the busy worker at once when it has already been busy past the limit', async () => {
    const workers: Fake[] = [];
    const gen = workerGenerator(
      () => {
        const w = fakeWorker();
        workers.push(w);
        return w;
      },
      { restartAfterMs: 15 },
    );
    void gen.run(request(1));
    await new Promise((r) => setTimeout(r, 25));
    void gen.run(request(2));
    expect(workers[0]!.terminated).toBe(true);
    expect(workers[1]!.queue.map((r) => r.id)).toEqual([2]);
    gen.dispose();
  });

  it('ignores answers it did not ask for', async () => {
    const worker = fakeWorker();
    const gen = workerGenerator(() => worker);
    const p = gen.run(request(7));
    worker.deliver({ id: 99, outcome: { ok: false, error: 'stray' } });
    worker.deliver('garbage');
    worker.flush();
    expect((await p).ok).toBe(true);
  });

  it('makes the worker on first use and again after dispose, so a StrictMode cleanup cannot strand it', async () => {
    const workers: Fake[] = [];
    const factory = vi.fn(() => {
      const w = fakeWorker();
      workers.push(w);
      return w;
    });
    const gen = workerGenerator(factory);
    expect(factory).not.toHaveBeenCalled();
    // Mount, StrictMode cleanup, mount again: the first worker is gone before anything ran.
    gen.dispose();
    const p = gen.run(request(1));
    expect(factory).toHaveBeenCalledTimes(1);
    workers[0]!.flush();
    expect((await p).ok).toBe(true);
    gen.dispose();
    expect(workers[0]!.terminated).toBe(true);
    const q = gen.run(request(2));
    expect(factory).toHaveBeenCalledTimes(2);
    workers[1]!.flush();
    expect((await q).ok).toBe(true);
  });

  it('falls back to running inline when the worker fails', async () => {
    const worker = fakeWorker();
    const gen = workerGenerator(() => worker);
    const p = gen.run(request(1, { req: { ...DEFAULT_REQUIREMENTS, count: 2 } }));
    worker.fail();
    const out = await p;
    expect(out.ok && out.suggestions.length).toBe(2);
    expect(worker.terminated).toBe(true);
    // Later requests go inline too, without touching a worker.
    const again = await gen.run(request(2));
    expect(again.ok).toBe(true);
    expect(worker.queue).toHaveLength(1);
  });

  it('falls back to running inline when the worker stays silent', async () => {
    const worker = fakeWorker();
    const gen = workerGenerator(() => worker, { timeoutMs: 20 });
    const start = performance.now();
    const out = await gen.run(request(1, { req: { ...DEFAULT_REQUIREMENTS, count: 2 } }));
    expect(out.ok && out.suggestions.length).toBe(2);
    expect(performance.now() - start).toBeGreaterThanOrEqual(15);
    expect(worker.terminated).toBe(true);
  });

  it('forgets outstanding requests on dispose and ignores a late answer from the old worker', async () => {
    const worker = fakeWorker();
    const gen = workerGenerator(() => worker, { timeoutMs: 30 });
    let settled = false;
    void gen.run(request(1)).then(() => (settled = true));
    gen.dispose();
    worker.flush(); // the old worker answers after it was told to stop
    await new Promise((r) => setTimeout(r, 60));
    expect(settled).toBe(false); // nobody is waiting for that answer, and no timeout fired either
  });

  it('creates an inline generator where there are no workers', async () => {
    const gen = createGenerator();
    expect((await gen.run(request(1))).ok).toBe(true);
    gen.dispose();
  });
});
