import fs from 'fs'
import path from 'path'

const LOG_DIR = path.join(process.cwd(), 'logs')
const LOG_FILE = path.join(LOG_DIR, 'app.log')
const MAX_LOG_SIZE = 5 * 1024 * 1024 // 5 MB

function ensureLogDir() {
  if (!fs.existsSync(LOG_DIR)) {
    fs.mkdirSync(LOG_DIR, { recursive: true })
  }
}

function checkAndRotateLogs() {
  try {
    ensureLogDir()
    if (fs.existsSync(LOG_FILE)) {
      const stats = fs.statSync(LOG_FILE)
      if (stats.size >= MAX_LOG_SIZE) {
        // If file size exceeds 5MB, clear the file content
        fs.writeFileSync(LOG_FILE, '', { flag: 'w' })
      }
    }
  } catch (err) {
    console.error('Log rotation failed:', err)
  }
}

export const logger = {
  info(message: string, context?: any) {
    checkAndRotateLogs()
    const timestamp = new Date().toISOString()
    const logLine = `[${timestamp}] [INFO] ${message} ${context ? JSON.stringify(context) : ''}\n`
    try {
      fs.appendFileSync(LOG_FILE, logLine)
    } catch (err) {
      console.error('Failed to write info log:', err)
    }
  },

  error(message: string, error?: any) {
    checkAndRotateLogs()
    const timestamp = new Date().toISOString()
    let errorDetails = ''
    if (error) {
      if (error instanceof Error) {
        errorDetails = `${error.message} - ${error.stack}`
      } else {
        errorDetails = JSON.stringify(error)
      }
    }
    const logLine = `[${timestamp}] [ERROR] ${message} ${errorDetails}\n`
    try {
      fs.appendFileSync(LOG_FILE, logLine)
    } catch (err) {
      console.error('Failed to write error log:', err)
    }
  }
}
