import * as fs from 'fs'
import * as path from 'path'
import { app } from 'electron'

export interface LogEntry {
  timestamp: string
  level: 'info' | 'error' | 'warn' | 'debug'
  module: string
  message: string
  data?: any
}

export class LoggerService {
  private logFile: string
  private logsDir: string
  private logs: LogEntry[] = []
  private maxLogs = 5000
  private lastDate: string

  constructor() {
    this.logsDir = path.join(app.getPath('userData'), 'logs')
    if (!fs.existsSync(this.logsDir)) fs.mkdirSync(this.logsDir, { recursive: true })

    this.lastDate = new Date().toISOString().split('T')[0]
    this.logFile = this.getLogFilePath(this.lastDate)
    this.loadLogs()
    this.setupConsoleInterception()
  }

  private getLogFilePath(fecha: string): string {
    return path.join(this.logsDir, `app-${fecha}.log`)
  }

  private checkAndRotateFile() {
    const today = new Date().toISOString().split('T')[0]
    if (today !== this.lastDate) {
      this.lastDate = today
      this.logFile = this.getLogFilePath(today)
      this.logs = []
      this.loadLogs()
    }
  }

  private loadLogs() {
    try {
      if (fs.existsSync(this.logFile)) {
        const content = fs.readFileSync(this.logFile, 'utf-8')
        this.logs = content.split('\n').filter(Boolean).map(line => {
          try {
            return JSON.parse(line)
          } catch {
            return null
          }
        }).filter(Boolean)
      }
    } catch (err) {
      console.error('Error loading logs:', err)
    }
  }

  private write(entry: LogEntry) {
    this.checkAndRotateFile()

    this.logs.push(entry)
    if (this.logs.length > this.maxLogs) {
      this.logs.shift()
    }

    try {
      fs.appendFileSync(this.logFile, JSON.stringify(entry) + '\n')
    } catch (err) {
      console.error('Error writing to log file:', err)
    }
  }

  private setupConsoleInterception() {
    const originalLog = console.log
    const originalError = console.error
    const originalWarn = console.warn

    console.log = (...args: any[]) => {
      originalLog(...args)
      const mensaje = args.map(a => typeof a === 'string' ? a : JSON.stringify(a)).join(' ')
      this.log('console', mensaje)
    }

    console.error = (...args: any[]) => {
      originalError(...args)
      const mensaje = args.map(a => typeof a === 'string' ? a : JSON.stringify(a)).join(' ')
      this.error('console', mensaje)
    }

    console.warn = (...args: any[]) => {
      originalWarn(...args)
      const mensaje = args.map(a => typeof a === 'string' ? a : JSON.stringify(a)).join(' ')
      this.warn('console', mensaje)
    }
  }

  log(module: string, message: string, data?: any) {
    const entry: LogEntry = {
      timestamp: new Date().toISOString(),
      level: 'info',
      module,
      message,
      data
    }
    this.write(entry)
  }

  error(module: string, message: string, data?: any) {
    const entry: LogEntry = {
      timestamp: new Date().toISOString(),
      level: 'error',
      module,
      message,
      data: data instanceof Error ? { message: data.message, stack: data.stack } : data
    }
    this.write(entry)
  }

  warn(module: string, message: string, data?: any) {
    const entry: LogEntry = {
      timestamp: new Date().toISOString(),
      level: 'warn',
      module,
      message,
      data
    }
    this.write(entry)
  }

  debug(module: string, message: string, data?: any) {
    const entry: LogEntry = {
      timestamp: new Date().toISOString(),
      level: 'debug',
      module,
      message,
      data
    }
    this.write(entry)
  }

  getLogs(): LogEntry[] {
    return [...this.logs]
  }

  getLogFile(): string {
    return this.logFile
  }

  clearLogs() {
    this.logs = []
    try {
      fs.writeFileSync(this.logFile, '')
    } catch (err) {
      console.error('Error clearing logs:', err)
    }
  }

  getLogsDir(): string {
    return this.logsDir
  }
}

export const logger = new LoggerService()

