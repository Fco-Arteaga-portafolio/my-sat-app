import { readdirSync, existsSync } from 'original-fs'
import { app } from 'electron'
import { join } from 'path'
import { chromium, BrowserContext, Browser } from 'playwright'

export class BrowserManager {
    private static browser: Browser | null = null

    /**
     * Único punto de control de la visibilidad del navegador.
     * - Producción (app empaquetada): headless → el usuario nunca ve una ventana.
     * - Desarrollo: ventana visible, para poder depurar el scraping.
     * - IFRAT_HEADLESS=0 fuerza ventana visible incluso en producción.
     */
    private static headless = process.env.IFRAT_HEADLESS === '0' ? false : app.isPackaged

    /**
     * Rutas relativas del ejecutable de Chromium dentro de su carpeta, por plataforma.
     * Refleja el layout que produce `npx playwright install`
     * (ver registry de playwright-core/lib/server/registry).
     */
    private static exeCandidates(base: string): string[] {
        switch (process.platform) {
            case 'win32':
                return [join(base, 'chrome-win64', 'chrome.exe')]
            case 'darwin': {
                const dir = process.arch === 'arm64' ? 'chrome-mac-arm64' : 'chrome-mac-x64'
                return [
                    join(base, dir, 'Google Chrome for Testing.app', 'Contents', 'MacOS', 'Google Chrome for Testing'),
                    join(base, 'chrome-mac', 'Chromium.app', 'Contents', 'MacOS', 'Chromium')
                ]
            }
            default: {
                const dir = process.arch === 'arm64' ? 'chrome-linux' : 'chrome-linux64'
                return [
                    join(base, dir, 'chrome'),
                    join(base, 'chrome-linux64', 'chrome'),
                    join(base, 'chrome-linux', 'chrome')
                ]
            }
        }
    }

    /** Devuelve la carpeta chromium-<versión> más reciente, ignorando el headless shell. */
    private static pickChromiumDir(dirs: string[]): string | undefined {
        const candidatos = dirs
            .filter(d => d.startsWith('chromium-') && !d.includes('headless'))
            .sort((a, b) => {
                const va = parseInt(a.split('-').pop() || '0', 10)
                const vb = parseInt(b.split('-').pop() || '0', 10)
                return vb - va
            })
        return candidatos[0]
    }

    // Método para calcular la ruta del ejecutable según el entorno
    private static findBundledChromium(): string | undefined {
        if (!app.isPackaged) return undefined

        const browsersPath = join(process.resourcesPath, 'playwright-browsers')

        if (!existsSync(browsersPath)) {
            console.warn('[BrowserManager] no existe el navegador empaquetado en:', browsersPath)
            return undefined
        }

        const dirs = readdirSync(browsersPath)
        const chromiumDir = this.pickChromiumDir(dirs)

        if (!chromiumDir) {
            console.warn('[BrowserManager] no se encontró ninguna carpeta chromium-* en:', browsersPath)
            return undefined
        }

        for (const candidate of this.exeCandidates(join(browsersPath, chromiumDir))) {
            if (existsSync(candidate)) {
                console.log('[BrowserManager] chromium:', candidate)
                return candidate
            }
        }

        console.warn('[BrowserManager] no se encontró el ejecutable en', chromiumDir, '· plataforma:', process.platform)
        return undefined
    }

    static setHeadless(value: boolean): void {
        this.headless = value
    }

    static isHeadless(): boolean {
        return this.headless
    }

    static async getBrowser(): Promise<Browser> {
        if (!this.browser) {
            const exePath = this.findBundledChromium()

            this.browser = await chromium.launch({
                headless: this.headless,
                executablePath: exePath,
                args: [
                    '--no-sandbox',
                    '--disable-setuid-sandbox',
                    '--disable-blink-features=AutomationControlled',
                    '--disable-web-security', // Ayuda con el visor de PDF y frames
                    '--allow-running-insecure-content',
                    '--disable-features=IsolateOrigins,site-per-process' // Ayuda a capturar buffers en frames
                ]
            })
        }
        return this.browser
    }

    static async newContext(): Promise<BrowserContext> {
        const browser = await this.getBrowser()
        return browser.newContext({
            // ESTO AYUDARÁ A QUE NO SEA TAN LENTO EL CARGADO DE JS
            storageState: undefined,
            javaScriptEnabled: true,
            acceptDownloads: true,
            viewport: { width: 1280, height: 720 },
            userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
            locale: 'es-MX',
            timezoneId: 'America/Mexico_City'
        })
    }

    static async cerrar(): Promise<void> {
        if (this.browser) {
            await this.browser.close()
            this.browser = null
        }
    }
}