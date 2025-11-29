import pino, { Bindings, Logger } from 'pino'
import pinoPretty from 'pino-pretty'

declare global {
  // eslint-disable-next-line no-var
  var __appLogger: Logger | undefined
}

const isProd = process.env.NODE_ENV === 'production'
const defaultLevel = isProd ? 'info' : 'debug'

const isServer = typeof window === 'undefined'

const prettyStream =
  !isProd && isServer
    ? pinoPretty({
        colorize: true,
        translateTime: 'SYS:standard',
        ignore: 'pid,hostname',
      })
    : undefined

const loggerInstance =
  globalThis.__appLogger ??
  pino(
    {
      level: process.env.LOG_LEVEL ?? defaultLevel,
      base: {
        service: process.env.LOG_SERVICE_NAME ?? 'whatsapp-sequence-manager',
        environment: process.env.NODE_ENV,
      },
      timestamp: pino.stdTimeFunctions.isoTime,
    },
    prettyStream
  )

if (!globalThis.__appLogger) {
  globalThis.__appLogger = loggerInstance
}

export const logger = loggerInstance

export const createLogger = (bindings: Bindings) => logger.child(bindings)

export function toError(error: unknown): Error {
  if (error instanceof Error) {
    return error
  }

  if (typeof error === 'string') {
    return new Error(error)
  }

  try {
    return new Error(JSON.stringify(error))
  } catch {
    return new Error('Unknown error')
  }
}

