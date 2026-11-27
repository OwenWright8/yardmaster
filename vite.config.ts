import { defineConfig } from 'vite';
// relative base: works on GitHub Pages under any repo name, and inside the iOS app
export default defineConfig({ base: './', build: { target: 'es2020' }, worker: { format: 'es' } });
