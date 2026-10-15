// Web Worker entry: generation off the main thread. One request in, one
// response out, matched by id. See src/lib/generator.ts.

import { runInputs, type GenerateRequest, type GenerateResponse } from './lib/engine';

addEventListener('message', (event: MessageEvent<GenerateRequest>) => {
  const { id, ...inputs } = event.data;
  const response: GenerateResponse = { id, outcome: runInputs(inputs) };
  postMessage(response);
});
