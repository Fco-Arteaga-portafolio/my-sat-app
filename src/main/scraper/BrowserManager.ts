import { chromium, BrowserContext, Browser } from 'playwright'

export class BrowserManager {
    private static browser: Browser | null = null
    private static headless = process.env.NODE_ENV === 'production' // ← un solo lugar para cambiar

    static setHeadless(value: boolean): void {
        this.headless = value
    }

    static async getBrowser(): Promise<Browser> {
        if (!this.browser) {
            // Carpeta donde se guardará el perfil (cookies, localStorage, etc.)

            this.browser = await chromium.launch({
                headless: this.headless,
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