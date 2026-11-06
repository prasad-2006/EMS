const { defineConfig } = require('vite');
const react = require('@vitejs/plugin-react');

module.exports = defineConfig({
  plugins: [react()],
  server: {
    port: 3000,
    strictPort: false,
    open: true
  },
  preview: {
    port: 3000,
    strictPort: false
  },
  build: {
    sourcemap: false
  }
});