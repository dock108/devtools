#!/usr/bin/env node
import('../dist/lib/timewarp-seeder.js').then(({ runSeeder }) => {
  runSeeder()
    .then((result) => {
      if (result) {
        console.log('Seeder completed successfully:', result);
      } else {
        console.log('Seeder did not run (safety flag not set)');
      }
    })
    .catch((error) => {
      console.error('Seeder failed:', error);
      process.exit(1);
    });
});
