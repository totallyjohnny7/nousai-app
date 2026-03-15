import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'
import { readFileSync } from 'fs'

const pkg = JSON.parse(readFileSync('./package.json', 'utf-8'))

export default defineConfig({
  define: {
    __APP_VERSION__: JSON.stringify(pkg.version),
  },
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['favicon.svg', 'icon-192.png', 'icon-512.png'],
      manifest: {
        name: 'NousAI Study Companion',
        short_name: 'NousAI',
        description: 'Study companion app synced with your Obsidian NousAI plugin',
        theme_color: '#6366f1',
        background_color: '#0f0f23',
        display: 'standalone',
        orientation: 'portrait-primary',
        start_url: '/',
        icons: [
          { src: '/icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: '/icon-512.png', sizes: '512x512', type: 'image/png' },
          { src: '/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' }
        ]
      },
      workbox: {
        // Activate new SW immediately on deploy — no manual cache clear needed
        skipWaiting: true,
        clientsClaim: true,
        // Only precache the app shell (HTML + main CSS/JS). Other chunks load on-demand
        // and are cached at runtime. This prevents stale-chunk errors after deploys.
        globPatterns: ['**/*.html', 'assets/index-*.{js,css}'],
        // Limit precache size to avoid bloated service workers
        maximumFileSizeToCacheInBytes: 3 * 1024 * 1024, // 3MB
        runtimeCaching: [
          {
            // Cache JS/CSS chunks on first use (lazy-loaded pages, games, etc.)
            urlPattern: /\/assets\/.*\.(?:js|css)$/i,
            handler: 'StaleWhileRevalidate',
            options: {
              cacheName: 'nousai-chunks',
              expiration: { maxEntries: 100, maxAgeSeconds: 60 * 60 * 24 * 30 } // 30 days
            }
          },
          {
            // Cache images and icons
            urlPattern: /\.(?:png|jpg|jpeg|svg|ico|webp|gif)$/i,
            handler: 'CacheFirst',
            options: {
              cacheName: 'nousai-images',
              expiration: { maxEntries: 50, maxAgeSeconds: 60 * 60 * 24 * 90 } // 90 days
            }
          },
          {
            // Cache fonts
            urlPattern: /\.(?:woff2?|ttf|otf|eot)$/i,
            handler: 'CacheFirst',
            options: {
              cacheName: 'nousai-fonts',
              expiration: { maxEntries: 20, maxAgeSeconds: 60 * 60 * 24 * 365 } // 1 year
            }
          },
          {
            urlPattern: /^https:\/\/fonts\.googleapis\.com\/.*/i,
            handler: 'CacheFirst',
            options: { cacheName: 'google-fonts-cache', expiration: { maxEntries: 10, maxAgeSeconds: 60 * 60 * 24 * 365 } }
          },
          {
            urlPattern: /^https:\/\/fonts\.gstatic\.com\/.*/i,
            handler: 'CacheFirst',
            options: { cacheName: 'google-fonts-webfonts', expiration: { maxEntries: 30, maxAgeSeconds: 60 * 60 * 24 * 365 } }
          },
          {
            urlPattern: /\/api\//i,
            handler: 'NetworkFirst',
            options: {
              cacheName: 'nousai-api-cache',
              expiration: { maxEntries: 50, maxAgeSeconds: 60 * 60 * 24 },
              backgroundSync: { name: 'nousai-sync', options: { maxRetentionTime: 60 * 24 } }
            }
          }
        ]
      }
    })
  ],

  // Dev server optimization
  server: {
    port: Number(process.env.PORT) || 5173,
    host: true,
    warmup: {
      clientFiles: ['./src/App.tsx', './src/store.tsx', './src/pages/Dashboard.tsx']
    }
  },

  // Pre-bundle heavy deps for faster dev startup (exclude dynamic imports like firebase/tesseract)
  optimizeDeps: {
    include: [
      'react',
      'react-dom',
      'react-router-dom',
      'katex',
      'lucide-react',
      '@tiptap/react',
      '@tiptap/starter-kit',
      // Excalidraw CJS dep needs pre-bundling for dev server ESM compatibility
      'es6-promise-pool',
    ],
  },

  // Build optimization
  build: {
    target: 'es2022',
    cssCodeSplit: true,
    sourcemap: false,
    rollupOptions: {
      output: {
        manualChunks: {
          // Core React runtime
          'vendor-react': ['react', 'react-dom', 'react-router-dom'],
          // Firebase (large SDK)
          'vendor-firebase': ['firebase/app', 'firebase/auth', 'firebase/firestore'],
          // Rich text editor
          'vendor-tiptap': [
            '@tiptap/react',
            '@tiptap/starter-kit',
            '@tiptap/extension-code-block-lowlight',
            '@tiptap/extension-table',
            '@tiptap/extension-table-row',
            '@tiptap/extension-table-cell',
            '@tiptap/extension-table-header',
            '@tiptap/extension-link',
            '@tiptap/extension-image',
            '@tiptap/extension-placeholder',
            '@tiptap/extension-color',
            '@tiptap/extension-text-style',
            '@tiptap/extension-text-align',
            '@tiptap/extension-highlight',
            '@tiptap/extension-underline',
            '@tiptap/extension-subscript',
            '@tiptap/extension-superscript',
            '@tiptap/extension-font-family',
            '@tiptap/extension-task-list',
            '@tiptap/extension-task-item'
          ],
          // Excalidraw drawing library
          'vendor-excalidraw': ['@excalidraw/excalidraw'],
          // Math rendering
          'vendor-katex': ['katex'],
          // OCR (very large, lazy load)
          'vendor-tesseract': ['tesseract.js']
        }
      }
    }
  }
})
