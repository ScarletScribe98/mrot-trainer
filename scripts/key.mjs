import { createServer } from 'vite';

const server = await createServer({
  configFile: false,
  appType: 'custom',
  optimizeDeps: { noDiscovery: true, include: [] },
  server: { middlewareMode: true, ws: false, watch: null },
});
try {
  const { answerKey } = await server.ssrLoadModule('/scripts/key.ts');
  console.log(answerKey(process.argv.slice(2)));
} catch (error) {
  console.error(error.message);
  process.exitCode = 1;
} finally {
  await server.close();
}
