import path from 'path/win32';
import { chromium, BrowserContext, Browser } from 'playwright'

export class BrowserManager {
    private static browser: Browser | null = null
    private static headless = process.env.NODE_ENV === 'production' // ← un solo lugar para cambiar


    // Método para calcular la ruta del ejecutable según el entorno
    private static getExecutablePath(): string | undefined {
        if (process.env.NODE_ENV !== 'production') {
            // En desarrollo, dejamos que Playwright use su ruta por defecto (ms-playwright)
            return undefined;
        }

        // En producción (IFRAT instalado), construimos la ruta hacia la carpeta resources
        // Ajusta los nombres de las carpetas según tu estructura real detectada
        return path.join(
            process.resourcesPath,
            'resources',
            'chromium-1208',
            'chrome-win64',
            'chrome.exe'
        );
    }

    static setHeadless(value: boolean): void {
        this.headless = value
    }

    static async getBrowser(): Promise<Browser> {
        if (!this.browser) {
            const exePath = this.getExecutablePath();

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