/**
 * pm2 config for the Hetzner VPS. Workers run from compiled dist/ (build with
 * `npm run build:workers` at the repo root). See README §VPS setup.
 */

const workers = ['sweep', 'analyze', 'ai', 'preview', 'cron'];

module.exports = {
  apps: workers.map((name) => ({
    name: `wms-${name}`,
    script: `dist/${name}.js`,
    cwd: __dirname,
    instances: 1,
    exec_mode: 'fork',
    autorestart: true,
    max_restarts: 10,
    restart_delay: 5000,
    max_memory_restart: name === 'analyze' ? '1G' : '300M',
    env: {
      NODE_ENV: 'production',
    },
  })),
};
