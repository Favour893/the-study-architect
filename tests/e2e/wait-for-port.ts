import { createConnection } from "net";

export function waitForPort(host: string, port: number, timeoutMs = 120_000): Promise<void> {
  const started = Date.now();

  return new Promise((resolve, reject) => {
    function tryOnce() {
      const socket = createConnection({ host, port }, () => {
        socket.end();
        resolve();
      });

      socket.on("error", () => {
        socket.destroy();
        if (Date.now() - started > timeoutMs) {
          reject(new Error(`Timed out waiting for ${host}:${port}`));
          return;
        }
        setTimeout(tryOnce, 250);
      });
    }

    tryOnce();
  });
}
