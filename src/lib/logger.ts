import {
  blue,
  bold,
  cyan,
  dim,
  gray,
  green,
  magenta,
  red,
  yellow,
} from 'colorette'
import pino, { Bindings, Logger } from 'pino'
import pinoPretty from 'pino-pretty'

declare global {
  // eslint-disable-next-line no-var
  var __appLogger: Logger | undefined
}

const isProd = process.env.NODE_ENV === 'production'
const defaultLevel = isProd ? 'info' : 'debug'

const isServer = typeof window === 'undefined'
const forcePretty =
  process.env.LOG_PRETTY === 'true' || process.env.LOG_PRETTY === '1'

const prettyStream =
  (isServer && (!isProd || forcePretty))
    ? pinoPretty({
        colorize: true,
        translateTime: 'SYS:standard',
        ignore: 'pid,hostname',
        messageFormat: (log, messageKey = 'msg') =>
          formatPrettyMessage(log as Record<string, unknown>, messageKey),
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

const levelLabels: Record<number, string> = {
  10: 'TRACE',
  20: 'DEBUG',
  30: 'INFO',
  40: 'WARN',
  50: 'ERROR',
  60: 'FATAL',
}

const levelColors: Record<number, (str: string) => string> = {
  10: cyan,
  20: blue,
  30: green,
  40: yellow,
  50: red,
  60: red,
}

const reservedKeys = new Set([
  'level',
  'time',
  'pid',
  'hostname',
  'msg',
  'service',
  'environment',
  'task',
  'operation',
  'module',
])

const entityKeys = new Set([
  'subscriptionId',
  'contactId',
  'contactPhone',
  'contactName',
  'sequenceId',
  'sequenceName',
  'templateId',
  'templateName',
  'metaAccountId',
  'metaAccountName',
  'runId',
  'runStartedAt',
])

function formatPrettyMessage(log: Record<string, unknown>, messageKey: string) {
  const parts: string[] = []

  parts.push(formatLevelLabel(log))

  if (typeof log.task === 'string' && log.task.length > 0) {
    parts.push(cyan(`[${log.task}]`))
  }

  if (typeof log.operation === 'string' && log.operation.length > 0) {
    parts.push(magenta(log.operation))
  }

  parts.push(...buildEntitySegments(log))

  const contextSegments = buildContextSegments(log, messageKey)
  if (contextSegments.length > 0) {
    parts.push(contextSegments.join(' '))
  }

  const key = typeof messageKey === 'string' && messageKey.length > 0 ? messageKey : 'msg'
  const rawMessage = log[key]

  if (typeof rawMessage === 'string') {
    parts.push(rawMessage)
  } else if (rawMessage !== undefined) {
    try {
      parts.push(JSON.stringify(rawMessage))
    } catch {
      parts.push(String(rawMessage))
    }
  }

  return parts.join(' ')
}

function buildEntitySegments(log: Record<string, unknown>) {
  const segments: string[] = []

  if (typeof log.subscriptionId === 'string') {
    segments.push(dim(`#${log.subscriptionId}`))
  }

  const contactPieces: string[] = []
  if (typeof log.contactName === 'string' && log.contactName.length > 0) {
    contactPieces.push(log.contactName)
  }
  if (typeof log.contactPhone === 'string' && log.contactPhone.length > 0) {
    contactPieces.push(`<${log.contactPhone}>`)
  }
  if (contactPieces.length > 0) {
    segments.push(dim(contactPieces.join(' ')))
  }

  if (typeof log.sequenceName === 'string' && log.sequenceName.length > 0) {
    segments.push(gray(log.sequenceName))
  }

  if (typeof log.templateName === 'string' && log.templateName.length > 0) {
    segments.push(gray(log.templateName))
  } else if (typeof log.templateId === 'string' && log.templateId.length > 0) {
    segments.push(gray(log.templateId))
  }

  return segments
}

function buildContextSegments(log: Record<string, unknown>, messageKey: string) {
  const segments: string[] = []

  for (const [key, value] of Object.entries(log)) {
    if (key === messageKey) continue
    if (reservedKeys.has(key)) continue
    if (entityKeys.has(key)) continue
    if (value === undefined) continue

    segments.push(`${cyan(key)}=${formatValue(value)}`)
  }

  return segments
}

function formatLevelLabel(log: Record<string, unknown>) {
  const level = typeof log.level === 'number' ? log.level : 30
  const label = levelLabels[level] ?? levelLabels[30]
  const colorize = levelColors[level] ?? green
  return colorize(bold(label.padEnd(5)))
}

function formatValue(value: unknown, depth = 0): string {
  if (value === null) {
    return dim('null')
  }
  if (value instanceof Date) {
    return gray(value.toISOString())
  }
  if (value instanceof Error) {
    return red(value.message)
  }
  if (Array.isArray(value)) {
    if (value.length === 0) return dim('[]')
    const formatted = value.map((entry) => formatValue(entry, depth + 1))
    return `[ ${formatted.join(', ')} ]`
  }
  if (typeof value === 'object') {
    const entries = Object.entries(value as Record<string, unknown>)
    if (entries.length === 0) return dim('{}')
    const inner = entries
      .map(
        ([key, val]) =>
          `${cyan(key)}: ${formatValue(val, depth + 1)}`
      )
      .join(', ')
    return `{ ${inner} }`
  }
  if (typeof value === 'string') {
    return magenta(`"${value}"`)
  }
  if (typeof value === 'number') {
    return yellow(value.toString())
  }
  if (typeof value === 'boolean') {
    return blue(value.toString())
  }
  return String(value)
}

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

