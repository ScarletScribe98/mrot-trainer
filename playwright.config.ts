import { defineConfig } from '@playwright/test';
import { initialProgress, STORAGE_KEY } from './src/game';

process.env.SCREEN_ROOT ||= 'work/etap0_6_1-regression-screens';
const baseURL = 'http://127.0.0.1:4173';
const ownProgress = /(?:etap5|etap6|final)\.spec\.ts$/;
export default defineConfig({
  testDir: './tests', workers: 1,
  reporter: [['list'], ['json', { outputFile: 'work/etap6/browser-results.json' }]],
  use: { baseURL, channel: 'msedge', headless: true, reducedMotion: 'reduce' },
  projects: [
    { name: 'legacy-baseline', testIgnore: ownProgress, use: {
      storageState: { cookies: [], origins: [{
        origin: baseURL, localStorage: [{ name: STORAGE_KEY, value: JSON.stringify(initialProgress()) }],
      }] },
    } },
    { name: 'saved-and-new-games', testMatch: ownProgress },
  ],
  webServer: { command: 'npm run preview -- --port 4173 --strictPort', url: baseURL, reuseExistingServer: false },
});
