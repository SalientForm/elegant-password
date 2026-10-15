import { describe, expect, it, vi } from 'vitest';
import { runInputs, type GenerateRequest } from './engine';
import { DEFAULT_SENTENCE_OPTIONS } from './fromSentence';
import { DEFAULT_REQUIREMENTS } from './generate';
import { createGenerator, syncGenerator, workerGenerator, type WorkerLike } from './generator';
import { BUILT_IN_MAPPINGS } from './twists';

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

  it('matches worker answers to requests by id, in any order', async () => {
    const worker = fakeWorker('lifo');
    const gen = workerGenerator(() => worker);
    const a = gen.run(request(1, { req: { ...DEFAULT_REQUIREMENTS, count: 1 } }));
    const b = gen.run(request(2, { req: { ...DEFAULT_REQUIREMENTS, count: 3 } }));
    worker.flush();
    const [oa, ob] = await Promise.all([a, b]);
    expect(oa.ok && oa.suggestions.length).toBe(1);
    expect(ob.ok && ob.suggestions.length).toBe(3);
    gen.dispose();
    expect(worker.terminated).toBe(true);
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

  it('creates an inline generator where there are no workers', async () => {
    const gen = createGenerator();
    expect((await gen.run(request(1))).ok).toBe(true);
    gen.dispose();
  });
});
