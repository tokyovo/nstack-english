import { readConfig, startServer } from './server.ts';

const server = await startServer(readConfig(process.env));
console.log(`API server listening on ${server.url}`);

for (const signal of ['SIGINT', 'SIGTERM'] as const) {
  process.once(signal, () => {
    void server.close().then(() => process.exit(0));
  });
}
