import { ipcMain, IpcMainInvokeEvent } from 'electron'

type IpcHandler = (event: IpcMainInvokeEvent, ...args: any[]) => Promise<any> | any

export class IpcWrapper {
  static handle(channel: string, handler: IpcHandler): void {
    ipcMain.handle(channel, async (event, ...args) => {
      try {
        const result = await handler(event, ...args)
        return { success: true, ...result }
      } catch (error) {
        return { success: false, error: String(error) }
      }
    })
  }
}
