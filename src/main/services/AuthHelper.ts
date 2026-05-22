import { SatAuthService } from '../scraper/SatAuthService'
import { Configuracion } from './ConfiguracionService'
import { Page } from 'playwright'

export class AuthHelper {
  constructor(private authService: SatAuthService) { }

  async login(config: Configuracion, captcha?: string): Promise<Page> {
    if (config.metodoAuth === 'contrasena') {
      return this.authService.loginConContrasena(config.rfc, config.contrasena!, captcha!)
    }
    return this.authService.loginConEfirma(config.rutaCer!, config.rutaKey!, config.contrasenaFiel!)
  }

  async logout(): Promise<void> {
    return this.authService.cerrarSesion()
  }
}
