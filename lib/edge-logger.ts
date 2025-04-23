/**
 * Edge-compatible logger that doesn't rely on Node.js-specific modules
 * Used in Edge Functions where the standard logger isn't available
 */
export const logger = {
  info: (data: any, message?: string) => {
    console.log(
      JSON.stringify({
        level: 'info',
        time: new Date().toISOString(),
        msg: message || '',
        data: typeof data === 'object' ? data : { value: data }
      })
    );
  },
  
  warn: (data: any, message?: string) => {
    console.warn(
      JSON.stringify({
        level: 'warn',
        time: new Date().toISOString(),
        msg: message || '',
        data: typeof data === 'object' ? data : { value: data }
      })
    );
  },
  
  error: (data: any, message?: string) => {
    console.error(
      JSON.stringify({
        level: 'error',
        time: new Date().toISOString(),
        msg: message || '',
        data: typeof data === 'object' ? data : { value: data }
      })
    );
  },
  
  debug: (data: any, message?: string) => {
    if (process.env.NODE_ENV !== 'production') {
      console.debug(
        JSON.stringify({
          level: 'debug',
          time: new Date().toISOString(),
          msg: message || '',
          data: typeof data === 'object' ? data : { value: data }
        })
      );
    }
  }
}; 