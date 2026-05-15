import { readdirSync, existsSync } from 'original-fs';
import { app } from 'electron';
import { join } from 'path/win32';
import { chromium, BrowserContext, Browser } from 'playwright'

export class BrowserManager {
    private static browser: Browser | null = null
    private static headless = app.isPackaged // ← un solo lugar para cambiar


    // Método para calcular la ruta del ejecutable según el entorno
    private static findBundledChromium(): string | undefined {
        if (!app.isPackaged) return undefined

        const browsersPath = join(process.resourcesPath, 'playwright-browsers')
        console.log('[BrowserManager] buscando chromium en:', browsersPath)
        console.log('[BrowserManager] existe:', existsSync(browsersPath))

        if (!existsSync(browsersPath)) return undefined

        const dirs = readdirSync(browsersPath)
        console.log('[BrowserManager] carpetas encontradas:', dirs)

        const chromiumDir = dirs.find(d => d.startsWith('chromium-') && !d.includes('headless'))
        if (!chromiumDir) return undefined

        const exePath = join(browsersPath, chromiumDir, 'chrome-win64', 'chrome.exe')
        console.log('[BrowserManager] exePath:', exePath, '| existe:', existsSync(exePath))

        return existsSync(exePath) ? exePath : undefined
    }

    static setHeadless(value: boolean): void {
        this.headless = value
    }

    static async getBrowser(): Promise<Browser> {
        if (!this.browser) {
            const exePath = this.findBundledChromium();

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