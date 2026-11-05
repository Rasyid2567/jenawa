
import app from './app.js';
import { env } from './config/env.js';
import { pool, checkDatabase } from './db/pool.js';

let server;

async function start() {
  await checkDatabase();

  server = app.listen(env.PORT, '0.0.0.0', () => {
    console.log(`JENAWA API berjalan pada port ${env.PORT}`);
  });
}

async function shutdown(signal) {
  console.log(`Menerima ${signal}; menghentikan server.`);

  if (server) {
    await new Promise((resolve) => server.close(resolve));
  }

  await pool.end();
  process.exit(0);
}

process.on('SIGINT', () => shutdown('SIGINT'));
process.on('SIGTERM', () => shutdown('SIGTERM'));

start().catch(async () => {
  console.error('Server gagal dijalankan. Periksa konfigurasi.');
  await pool.end();
  process.exit(1);
});
