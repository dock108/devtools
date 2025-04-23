/**
 * Edge-compatible MJML renderer that doesn't rely on Node.js fs/path modules
 * This is a simplified wrapper that can be used in Edge Functions
 */
import { logger } from './edge-logger';

interface MjmlResult {
  html: string;
  errors?: string[];
}

/**
 * Simple MJML to HTML converter that works in Edge Functions
 * Uses the MJML browser API approach rather than Node.js APIs
 */
export default function mjml2html(mjmlContent: string): MjmlResult {
  try {
    // In a real implementation, you'd use a browser-compatible MJML library
    // or a headless MJML rendering service/API
    // For now, we're implementing a very basic version that returns HTML
    
    // This is a simplified implementation - in production you would:
    // 1. Either use a version of MJML that works in Edge (if available)
    // 2. Or pre-compile your MJML templates to HTML during build time
    // 3. Or use a remote API to render MJML to HTML
    
    // For this example, we'll just wrap the MJML in some basic HTML
    // and add a comment explaining that proper rendering should be implemented
    
    const html = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <title>Email from Dock108</title>
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
</head>
<body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
  <!-- 
    This is a simplified HTML version.
    In production, implement proper MJML rendering using:
    1. A browser-compatible MJML library
    2. Pre-compiled templates
    3. A remote MJML API service
  -->
  ${mjmlContent
    .replace(/<mjml[^>]*>/g, '')
    .replace(/<\/mjml>/g, '')
    .replace(/<mj-head>.*<\/mj-head>/gs, '')
    .replace(/<mj-body[^>]*>/g, '<div>')
    .replace(/<\/mj-body>/g, '</div>')
    .replace(/<mj-section[^>]*>/g, '<div style="margin-bottom: 20px;">')
    .replace(/<\/mj-section>/g, '</div>')
    .replace(/<mj-column[^>]*>/g, '<div>')
    .replace(/<\/mj-column>/g, '</div>')
    .replace(/<mj-image[^>]*src="([^"]*)"[^>]*>/g, '<img src="$1" style="max-width: 100%;">')
    .replace(/<mj-divider[^>]*>/g, '<hr style="border: 1px solid #eee;">')
    .replace(/<mj-text[^>]*>(.*?)<\/mj-text>/gs, '<p>$1</p>')
    .replace(/<mj-button[^>]*href="([^"]*)"[^>]*>(.*?)<\/mj-button>/g, 
      '<a href="$1" style="display: inline-block; padding: 10px 20px; background-color: #4f46e5; color: white; text-decoration: none; border-radius: 4px;">$2</a>')
  }
</body>
</html>`;

    return { html };
  } catch (error) {
    logger.error({ error }, 'Error rendering MJML');
    return { 
      html: `<p>Error rendering email template</p>`, 
      errors: [String(error)] 
    };
  }
} 