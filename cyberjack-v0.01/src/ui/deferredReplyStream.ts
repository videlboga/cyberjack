export function streamDeferredReply(
  jobId: string,
  onText?: (text: string) => void,
  timeoutMs = 60_000,
): Promise<any> {
  return new Promise((resolve, reject) => {
    const source = new EventSource(
      `/api/tick/replies/${encodeURIComponent(jobId)}/stream`,
    );
    let text = "";
    const timer = window.setTimeout(() => {
      source.close();
      reject(new Error("Ответ модели не получен вовремя"));
    }, timeoutMs);
    source.addEventListener("token", (event) => {
      try {
        text += JSON.parse((event as MessageEvent).data).chunk || "";
        onText?.(text);
      } catch {}
    });
    source.addEventListener("done", (event) => {
      window.clearTimeout(timer);
      source.close();
      try {
        resolve(JSON.parse((event as MessageEvent).data));
      } catch (error) {
        reject(error);
      }
    });
    source.onerror = () => {
      window.clearTimeout(timer);
      source.close();
      reject(new Error("Поток ответа модели оборвался"));
    };
  });
}
