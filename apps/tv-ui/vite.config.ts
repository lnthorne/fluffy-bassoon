import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'path'

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  build: {
    outDir: '../server/dist/tv-ui',
    assetsDir: 'assets',
    emptyOutDir: true,
    // Configure for server hosting
    rollupOptions: {
      output: {
        manualChunks: undefined,
        // Ensure consistent asset naming for server integration
        assetFileNames: 'assets/[name].[hash][extname]',
        chunkFileNames: 'assets/[name].[hash].js',
        entryFileNames: 'assets/[name].[hash].js',
      },
    },
    // Optimize for production
    minify: 'esbuild', // Use esbuild instead of terser
    sourcemap: false,
    target: 'es2015',
    // Configure base path for server integration
    assetsInlineLimit: 4096,
  },
  server: {
    port: 5174,
    host: true,
    // Configure proxy for development to connect to server
    proxy: {
      '/api': {
        target: 'http://localhost:3000',
        changeOrigin: true,
      },
      '/ws': {
        target: 'ws://localhost:3000',
        ws: true,
        changeOrigin: true,
      },
    },
  },
  // Configure for development and build
  base: '/display/',
  define: {
    // Ensure environment variables are available
    'process.env.NODE_ENV': JSON.stringify(process.env.NODE_ENV || 'development'),
  },
  // Resolve shared package
  resolve: {
    alias: {
      '@party-jukebox/shared': path.resolve(__dirname, '../../packages/shared/src'),
    },
  },
})