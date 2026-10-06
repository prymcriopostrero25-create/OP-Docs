import { defineConfig, loadEnv } from 'vite'
import process from 'node:process'
import react, { reactCompilerPreset } from '@vitejs/plugin-react'
import babel from '@rolldown/plugin-babel'
import tailwindcss from '@tailwindcss/vite'
import { appsScriptProxy } from './dev/appsScriptProxy.js'

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '')
  if (mode === 'production' && !/^https:\/\/script\.google\.com\/macros\/s\/[a-zA-Z0-9_-]+\/exec$/.test(env.VITE_APPS_SCRIPT_URL || '')) {
    throw new Error('Production requires VITE_APPS_SCRIPT_URL set to the deployed Apps Script https://script.google.com/macros/s/.../exec URL.')
  }
  const target = env.VITE_APPS_SCRIPT_URL || 'https://script.google.com/macros/s/AKfycbwq9SIEm3gylhgJggBVGZcGDb6Lf1pVhtRU_fcK60j5cn5iGRZEt_lvc5j44RCLuayU/exec'

  return {
    plugins: [
      appsScriptProxy(target),
      tailwindcss(),
      react(),
      babel({ presets: [reactCompilerPreset()] })
    ],
    optimizeDeps: {
      // Build one complete dependency set before serving the editor. Avoid a
      // second discovery pass invalidating modules held by an open browser.
      noDiscovery: true,
      // Scan every app component before serving lazy-loaded document pages.
      entries: ['index.html', 'src/**/*.{js,jsx}'],
      include: [
        'react',
        'react-dom/client',
        'qrcode',
        'pdf-lib',
        'pdfjs-dist',
        '@tiptap/react',
        '@tiptap/core',
        '@tiptap/starter-kit',
        '@tiptap/extension-text-style',
        '@tiptap/extension-text-align',
        '@tiptap/extension-highlight',
        '@tiptap/extension-image',
        '@tiptap/extension-table',
      ],
    },
    server: {
      host: 'localhost',
      port: 5173,
    },
  }
})
