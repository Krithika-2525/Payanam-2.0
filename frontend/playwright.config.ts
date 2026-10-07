import { defineConfig } from '@playwright/test';
export default defineConfig({testDir:'./tests', use:{baseURL:'http://127.0.0.1:5180'}, webServer:{command:'VITE_API_BASE_URL=http://127.0.0.1:8010 npm run dev -- --port 5180', url:'http://127.0.0.1:5180', reuseExistingServer:true}, reporter:'list'});
