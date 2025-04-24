#!/usr/bin/env node
const { exec } = require('child_process');
const fs = require('fs');
const path = require('path');

// Ensure the dist directory exists
const distDir = path.join(process.cwd(), 'dist');
if (!fs.existsSync(distDir)) {
  fs.mkdirSync(distDir, { recursive: true });
}

// Compile the TypeScript file
console.log('Building seeder...');
exec(
  'npx tsc --esModuleInterop --target ES2020 --module ESNext --moduleResolution node --allowSyntheticDefaultImports --outDir dist src/lib/timewarp-seeder.ts',
  (error, stdout, stderr) => {
    if (error) {
      console.error('Error building seeder:', error);
      console.error(stderr);
      process.exit(1);
    }

    console.log('Seeder built successfully!');
    console.log(stdout);

    // Update the import in scripts/timewarp-seeder.js
    const wrapperPath = path.join(process.cwd(), 'scripts/timewarp-seeder.js');
    let wrapperContent = fs.readFileSync(wrapperPath, 'utf8');
    wrapperContent = wrapperContent.replace(
      '../src/lib/timewarp-seeder.js',
      '../dist/lib/timewarp-seeder.js',
    );
    fs.writeFileSync(wrapperPath, wrapperContent);

    console.log('Updated wrapper script to point to compiled file.');
  },
);
