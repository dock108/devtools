import { Resend } from 'resend';

// Ensure the Resend API key is set
if (!process.env.RESEND_API_KEY) {
  console.warn('Missing RESEND_API_KEY environment variable. Email features will not work.');
}

// Note: The FROM_EMAIL environment variable should be set to the sender email address
// This is used in the contact form API route and other email functionality
// Default: 'support@dock108.ai'

// Create a Resend client for sending emails
const resend = new Resend(process.env.RESEND_API_KEY || '');

export default resend;
