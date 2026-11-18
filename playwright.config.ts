import { defineConfig } from '@playwright/test';
process.env.SCREEN_ROOT ||= 'work/etap0_6_1-regression-screens';
export default defineConfig({ testDir: './tests', workers: 1, reporter: [['list'], ['json', { outputFile: 'work/etap3/browser-results.json' }]], use: { baseURL: 'http://127.0.0.1:4173', channel: 'msedge', headless: true, reducedMotion: 'reduce' }, webServer: { command: 'npm run preview -- --port 4173 --strictPort', url: 'http://127.0.0.1:4173', reuseExistingServer: false } });
