import pino from 'pino';

// Create a request ID for tracing
let requestIdCounter = 0;
export function generateRequestId(): string {
  return `req-${++requestIdCounter}-${Date.now()}`;
}

// Create logger instance
const baseLogger = pino({
  level: process.env.LOG_LEVEL || (process.env.NODE_ENV === 'production' ? 'info' : 'debug'),
  formatters: {
    level: (label) => ({level: label}),
    log: (object) => {
      const {reqId, ...rest} = object;
      return {
        timestamp: new Date().toISOString(),
        reqId,
        ...rest,
      };
    },
  },
  serializers: {
    req: (req) => ({
      method: req.method,
      url: req.url,
      headers: {
        userAgent: req.headers['user-agent'],
      },
    }),
    res: (res) => ({
      status: res.statusCode,
    }),
    err: pino.stdSerializers.err,
  },
});

// Add request ID to child loggers
export function getLogger(reqId?: string) {
  return reqId ? baseLogger.child({reqId}) : baseLogger;
}

// Log types
export const logger = {
  info: (message: string, data?: Record<string, unknown>, reqId?: string) => {
    getLogger(reqId).info(data ? {...data, msg: message} : {msg: message});
  },
  warn: (message: string, data?: Record<string, unknown>, reqId?: string) => {
    getLogger(reqId).warn(data ? {...data, msg: message} : {msg: message});
  },
  error: (message: string, error?: Error, data?: Record<string, unknown>, reqId?: string) => {
    const logData: Record<string, unknown> = data ? {...data} : {};
    if (error) {
      logData.error = {
        name: error.name,
        message: error.message,
        stack: process.env.NODE_ENV === 'development' ? error.stack : undefined,
      };
    }
    getLogger(reqId).error({...logData, msg: message});
  },
  debug: (message: string, data?: Record<string, unknown>, reqId?: string) => {
    getLogger(reqId).debug(data ? {...data, msg: message} : {msg: message});
  },
};

// Middleware logging helper
export function logRequest(request: Request, reqId: string) {
  logger.info('Request started', {
    method: request.method,
    url: request.url,
    ip: request.headers.get('x-forwarded-for') || request.headers.get('x-real-ip') || 'unknown',
  }, reqId);
}

export function logResponse(response: Response, duration: number, reqId: string) {
  logger.info('Request completed', {
    status: response.status,
    durationMs: duration,
  }, reqId);
}

export function logAuthFailure(ip: string, path: string, reason: string, reqId?: string) {
  logger.warn('Authentication failed', {
    ip,
    path,
    reason,
  }, reqId);
}

export function logRateLimit(ip: string, path: string, limit: number, remaining: number, reset: number, reqId?: string) {
  logger.warn('Rate limit exceeded', {
    ip,
    path,
    limit,
    remaining,
    reset,
  }, reqId);
}

export function logDatabaseQuery(query: string, duration: number, reqId?: string) {
  if (duration > 500) {
    logger.warn('Slow database query', {
      query,
      durationMs: duration,
    }, reqId);
  } else {
    logger.debug('Database query', {
      query,
      durationMs: duration,
    }, reqId);
  }
}

export default baseLogger;
