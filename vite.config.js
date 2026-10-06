import { defineConfig, loadEnv } from 'vite'
import process from 'node:process'
import react, { reactCompilerPreset } from '@vitejs/plugin-react'
import babel from '@rolldown/plugin-babel'
import tailwindcss from '@tailwindcss/vite'

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '')
  const target = env.VITE_APPS_SCRIPT_URL || 'https://script.google.com/macros/s/AKfycbwq9SIEm3gylhgJggBVGZcGDb6Lf1pVhtRU_fcK60j5cn5iGRZEt_lvc5j44RCLuayU/exec'
  const targetUrl = new URL(target)

  return {
    plugins: [
      tailwindcss(),
      react(),
      babel({ presets: [reactCompilerPreset()] })
    ],
    optimizeDeps: {
      // Scan every app component before serving lazy-loaded document pages.
      entries: ['index.html', 'src/**/*.{js,jsx}'],
      include: [
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
      proxy: {
        '/apps-script': {
          target: targetUrl.origin,
          changeOrigin: true,
          secure: true,
          // Resolve Apps Script's ContentService redirect inside the proxy.
          // Forwarding it to the browser makes the request cross-origin again.
          followRedirects: true,
          rewrite: (path) => {
            const suffix = path === '/apps-script' ? '' : path.replace(/^\/apps-script/, '')
            return `${targetUrl.pathname}${suffix}`
          },
        },
      },
    },
  }
})
