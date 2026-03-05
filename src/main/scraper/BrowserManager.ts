import { chromium, Browser, BrowserContext } from 'playwright'

export class BrowserManager {
    private static browser: Browser | null = null
    private static headless = process.env.NODE_ENV === 'production' // ← un solo lugar para cambiar

    static setHeadless(value: boolean): void {
        this.headless = value
    }

    static async getBrowser(): Promise<Browser> {
        if (!this.browser) {
            this.browser = await chromium.launch({ headless: this.headless })
        }
        return this.browser
    }

    static async newContext(): Promise<BrowserContext> {
        const browser = await this.getBrowser()
        return browser.newContext()
    }

    static async cerrar(): Promise<void> {
        if (this.browser) {
            await this.browser.close()
            this.browser = null
        }
    }
}