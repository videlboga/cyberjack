import { Request, Response } from 'express';

/**
 * Этап 8. Deferred-механика отложенных LLM-ответов.
 *
 * Вынесена из tickController: хранилище отложенных реплик, SSE-стриминг
 * токенов, ожидание завершения. Контроллер тика регистрирует задачу через
 * `registerDeferredReply` и публикует токены через `publishDeferredToken`.
 */

export interface DeferredReplyJob {
  done: boolean;
  metrics?: unknown;
  error?: string | null;
  completion?: Promise<void>;
  chunks?: string[];
  subscribers?: Set<Response>;
}

const deferredReplyJobs = new Map<string, DeferredReplyJob>();

function publicDeferredJob(job: DeferredReplyJob) {
  const { completion: _completion, subscribers: _subscribers, ...publicJob } = job;
  return publicJob;
}

export function registerDeferredReply(id: string): DeferredReplyJob {
  const job: DeferredReplyJob = { done: false, chunks: [], subscribers: new Set<Response>() };
  deferredReplyJobs.set(id, job);
  return job;
}

export function getDeferredReplyJob(id: string): DeferredReplyJob | undefined {
  return deferredReplyJobs.get(id);
}

export function publishDeferredToken(job: DeferredReplyJob, chunk: string) {
  if (!chunk) return;
  (job.chunks ||= []).push(chunk);
  for (const subscriber of job.subscribers || []) subscriber.write(`event: token\ndata: ${JSON.stringify({ chunk })}\n\n`);
}

export function finishDeferredStream(job: DeferredReplyJob) {
  for (const subscriber of job.subscribers || []) {
    subscriber.write(`event: done\ndata: ${JSON.stringify(publicDeferredJob(job))}\n\n`);
    subscriber.end();
  }
  job.subscribers?.clear();
}

export const getDeferredReply = (req: Request, res: Response) => {
  const id = String(req.params.jobId || '');
  const job = deferredReplyJobs.get(id);
  if (!job) return res.status(404).json({ success: false, error: 'Ожидаемый ответ не найден' });
  res.json({ success: true, ...publicDeferredJob(job) });
  if (job.done) deferredReplyJobs.delete(id);
};

export const waitForDeferredReply = async (req: Request, res: Response) => {
  const id = String(req.params.jobId || '');
  const job = deferredReplyJobs.get(id);
  if (!job) return res.status(404).json({ success: false, error: 'Ожидаемый ответ не найден' });
  if (!job.done && job.completion) {
    await Promise.race([
      job.completion,
      new Promise(resolve => setTimeout(resolve, 60_000))
    ]);
  }
  const completed = deferredReplyJobs.get(id);
  if (!completed) return res.status(404).json({ success: false, error: 'Ожидаемый ответ не найден' });
  res.json({ success: true, ...publicDeferredJob(completed) });
  if (completed.done) deferredReplyJobs.delete(id);
};

export const streamDeferredReply = (req: Request, res: Response) => {
  const id = String(req.params.jobId || '');
  const job = deferredReplyJobs.get(id);
  if (!job) return res.status(404).end();
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache, no-transform');
  res.setHeader('Connection', 'keep-alive');
  res.flushHeaders();
  for (const chunk of job.chunks || []) res.write(`event: token\ndata: ${JSON.stringify({ chunk })}\n\n`);
  if (job.done) {
    res.write(`event: done\ndata: ${JSON.stringify(publicDeferredJob(job))}\n\n`);
    return res.end();
  }
  if (!job.subscribers) job.subscribers = new Set();
  job.subscribers.add(res);
  req.on('close', () => job.subscribers?.delete(res));
};
