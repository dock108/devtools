import { execSync } from 'node:child_process';
import * as path from 'node:path';

console.log('Checking bundle size...');

const functionsDir = path.resolve('.vercel/output/functions');
let size = 0;
const MAX_MB = 15; // Set the desired limit here

try {
  // Get the size of the largest item (likely a function directory) in megabytes
  const duOutput = execSync(`du -m ${functionsDir}/* | sort -n | tail -1`, {
    encoding: 'utf8',
  });
  console.log(`du output: ${duOutput.trim()}`);
  // Parse the size (first column, tab-separated)
  const sizeMatch = duOutput.match(/^(\d+)\s+/); 
  if (sizeMatch && sizeMatch[1]) {
    size = parseInt(sizeMatch[1], 10);
  } else {
    console.warn('Could not parse bundle size from du output.');
    // Optionally exit here if parsing fails, or proceed with size 0
    // process.exit(1); 
  }
} catch (error: any) {
  console.error(`Error running du command: ${error.message}`);
  console.error('Bundle size check failed. Ensure `npm run build` ran successfully and `.vercel/output/functions` exists.');
  process.exit(1); // Exit with failure if du command fails
}

console.log(`Largest bundle size found: ${size} MB`);

if (size > MAX_MB) {
  console.error(`❌ Error: Bundle size (${size} MB) exceeds maximum limit of ${MAX_MB} MB.`);
  process.exit(1);
} else {
  console.log(`✅ Bundle size (${size} MB) is within the limit of ${MAX_MB} MB.`);
} 