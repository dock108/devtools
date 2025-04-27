import pino from 'pino';
// Use pino-logflare for browser/edge compatibility if sending logs externally
// import { logflarePinoVercel } from 'pino-logflare';

// Basic pino logger setup - adjust transport for production environment (e.g., logflare)
const logger = pino({
  level: process.env.LOG_LEVEL || 'info',
  formatters: {
    level: (label) => {
      return { level: label };
    },
  },
  base: {
    env: process.env.NODE_ENV || 'development',
    service: process.env.SERVICE_NAME || 'guardian', // Default service name
    // revision: process.env.VERCEL_GIT_COMMIT_SHA, // Example for Vercel env
  },
  timestamp: pino.stdTimeFunctions.isoTime,
});

// Example of adding context dynamically if needed (e.g., request ID)
// const contextLogger = (context: Record<string, any>) => logger.child(context);

export const log = logger;
export { logger }; // Add direct export for logger

// Helper to generate request IDs (can be moved to middleware or utils)
import { v4 as uuidv4 } from 'uuid';
export const generateRequestId = () => uuidv4();
