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

/** A worker that answers in the next tick, in whatever order it likes. */
function fakeWorker(order: 'fifo' | 'lifo' = 'fifo') {
  const listeners: Record<string, ((e: never) => void)[]> = { message: [], error: [] };
  const queue: GenerateRequest[] = [];
  const worker: WorkerLike & { flush(): void; fail(): void; terminated: boolean } = {
    terminated: false,
    postMessage: (m: unknown) => void queue.push(m as GenerateRequest),
    addEventListener: (type: string, l: (e: never) => void) => void listeners[type]!.push(l),
    terminate: () => void (worker.terminated = true),
    flush() {
      const items = order === 'fifo' ? queue.splice(0) : queue.splice(0).reverse();
      for (const r of items) {
        const { id, ...inputs } = r;
        for (const l of listeners.message!) (l as (e: { data: unknown }) => void)({ data: { id, outcome: runInputs(inputs) } });
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
    const gen = workerGenerator(worker);
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
    const gen = workerGenerator(worker);
    const listeners = (worker as unknown as { addEventListener: unknown }).addEventListener;
    expect(listeners).toBeDefined();
    const p = gen.run(request(7));
    worker.flush();
    expect((await p).ok).toBe(true);
  });

  it('falls back to running inline when the worker fails', async () => {
    const worker = fakeWorker();
    const gen = workerGenerator(worker);
    const p = gen.run(request(1, { req: { ...DEFAULT_REQUIREMENTS, count: 2 } }));
    worker.fail();
    const out = await p;
    expect(out.ok && out.suggestions.length).toBe(2);
    // Later requests go inline too, without touching the worker.
    const spy = vi.spyOn(worker, 'postMessage');
    const again = await gen.run(request(2));
    expect(again.ok).toBe(true);
    expect(spy).not.toHaveBeenCalled();
  });

  it('creates an inline generator where there are no workers', async () => {
    const gen = createGenerator();
    expect((await gen.run(request(1))).ok).toBe(true);
    gen.dispose();
  });
});
