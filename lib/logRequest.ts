import { logger } from '@/lib/logger';

export const logRequest = (req: Request) =>
  logger.info(
    { url: req.url, method: req.method, ua: req.headers.get('user-agent') },
    'HTTP request'
  ); 