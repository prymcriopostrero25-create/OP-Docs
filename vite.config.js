import { defineConfig, loadEnv } from 'vite'
import react, { reactCompilerPreset } from '@vitejs/plugin-react'
import babel from '@rolldown/plugin-babel'

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '')
  const target = env.VITE_APPS_SCRIPT_URL || 'https://script.google.com/macros/s/AKfycbwq9SIEm3gylhgJggBVGZcGDb6Lf1pVhtRU_fcK60j5cn5iGRZEt_lvc5j44RCLuayU/exec'
  const targetUrl = new URL(target)

  return {
    plugins: [
      react(),
      babel({ presets: [reactCompilerPreset()] })
    ],
    server: {
      host: 'localhost',
      port: 5173,
      proxy: {
        '/apps-script': {
          target: targetUrl.origin,
          changeOrigin: true,
          secure: true,
          rewrite: (path) => {
            const suffix = path === '/apps-script' ? '' : path.replace(/^\/apps-script/, '')
            return `${targetUrl.pathname}${suffix}`
          },
        },
      },
    },
  }
})
