import { defineConfig, loadEnv } from 'vite'
import type { ViteDevServer } from 'vite'
import react from '@vitejs/plugin-react'
import os from 'node:os'
import path from 'node:path'

function formatLocalNetworkHost(rawHost: string): string {
  const normalizedHost = rawHost.trim()
  if (!normalizedHost) {
    return ''
  }

  return normalizedHost.endsWith('.local') ? normalizedHost : `${normalizedHost}.local`
}

function addressPort(server: ViteDevServer): number | undefined {
  const address = server.httpServer?.address()
  if (address && typeof address === 'object') {
    return address.port
  }

  return undefined
}

function formatBackendUrlForDisplay(configuredBaseUrl: string | undefined, preferredHost: string, protocol: string): string {
  if (!configuredBaseUrl) {
    return `${protocol}://${preferredHost}:3000`
  }

  try {
    const configuredUrl = new URL(configuredBaseUrl)
    if (configuredUrl.hostname === 'localhost' || configuredUrl.hostname === '127.0.0.1') {
      configuredUrl.hostname = preferredHost
      return configuredUrl.toString().replace(/\/$/, '')
    }
  } catch {
    return configuredBaseUrl
  }

  return configuredBaseUrl.replace(/\/$/, '')
}

function localNetworkUrlPlugin(preferredHost: string, configuredBackendUrl: string | undefined) {
  return {
    name: 'travenary-local-network-url',
    configureServer(server: ViteDevServer): void {
      const originalPrintUrls = server.printUrls.bind(server)

      server.printUrls = (): void => {
        originalPrintUrls()

        const port = addressPort(server) ?? server.config.server.port ?? 5173
        const protocol = server.config.server.https ? 'https' : 'http'
        const base = server.config.base ?? '/'
        const backendUrl = formatBackendUrlForDisplay(configuredBackendUrl, preferredHost, protocol)
        server.config.logger.info(`  ➜  iPhone:  ${protocol}://${preferredHost}:${port}${base}`)
        server.config.logger.info(`  ➜  Backend: ${backendUrl}`)
      }
    },
  }
}

// https://vite.dev/config/
export default defineConfig(({ command, mode }) => {
  const env = loadEnv(mode, process.cwd(), '')
  const base = command === 'serve'
    ? env.VITE_DEV_BASE_PATH || '/'
    : env.VITE_BASE_PATH || '/'
  const localNetworkHost = formatLocalNetworkHost(env.VITE_DEV_LOCAL_HOSTNAME || os.hostname())

  return {
    base,
    plugins: [
      react(),
      localNetworkUrlPlugin(localNetworkHost, env.VITE_API_BASE_URL),
    ],
    server: {
      host: true,
      allowedHosts: ['localhost', '.local'],
    },
    resolve: {
      alias: {
        '@': path.resolve(__dirname, './src'),
      },
    },
  }
})
