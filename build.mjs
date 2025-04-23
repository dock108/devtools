#!/usr/bin/env node
import fs from 'fs';
import path from 'path';
import { execSync } from 'child_process';
import { fileURLToPath } from 'url';

// Get the directory of the current module
const __dirname = path.dirname(fileURLToPath(import.meta.url));

// List of components to check
const componentsToCheck = [
  'components/guardian-demo/EventTable.tsx',
  'components/guardian-demo/ActionLog.tsx',
  'components/guardian-demo/SlackAlert.tsx',
  'components/guardian-demo/ScenarioPicker.tsx',
];

console.log('Checking for required components...');
const missingComponents = [];

componentsToCheck.forEach(componentPath => {
  const fullPath = path.join(__dirname, componentPath);
  if (!fs.existsSync(fullPath)) {
    missingComponents.push(componentPath);
    console.error(`Missing component: ${componentPath}`);
  } else {
    console.log(`Found component: ${componentPath}`);
  }
});

if (missingComponents.length > 0) {
  console.error('Missing components detected!');
  process.exit(1);
}

console.log('All components found. Proceeding with build...');

// Run the original build command
try {
  execSync('next build', { stdio: 'inherit' });
  console.log('Build completed successfully.');
} catch (error) {
  console.error('Build failed:', error.message);
  process.exit(1);
} 