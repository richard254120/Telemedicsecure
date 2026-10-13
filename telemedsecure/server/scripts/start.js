const { execSync } = require('child_process');
const path = require('path');

console.log('==> [TeleMedSecure Server Startup]');

// 1. Resolve failed migration if present in _prisma_migrations
try {
  console.log('==> Checking and resolving any interrupted migration state...');
  execSync('npx prisma migrate resolve --rolled-back 20261013170000_add_verification_and_staff_invitation', {
    stdio: 'inherit'
  });
  console.log('==> Successfully marked previous failed migration as rolled-back.');
} catch (e) {
  // It is expected to exit with non-zero if there was no failed migration to roll back
  console.log('==> No failed migration record needed roll-back (or already resolved).');
}

// 2. Deploy migrations
try {
  console.log('==> Applying database migrations with prisma migrate deploy...');
  execSync('npx prisma migrate deploy', { stdio: 'inherit' });
  console.log('==> Migrations applied successfully.');
} catch (e) {
  console.error('==> prisma migrate deploy encountered an error. Attempting db push sync...', e.message);
  try {
    execSync('npx prisma db push --accept-data-loss', { stdio: 'inherit' });
    console.log('==> Schema synchronized via db push.');
  } catch (pushErr) {
    console.error('==> db push failed:', pushErr.message);
  }
}

// 3. Seed database
try {
  console.log('==> Running database seed...');
  execSync('npx prisma db seed', { stdio: 'inherit' });
  console.log('==> Database seed complete.');
} catch (e) {
  console.warn('==> Note: Seed step exited (continuing startup):', e.message);
}

// 4. Start Node application
console.log('==> Starting TeleMedSecure backend server...');
require(path.join(__dirname, '../dist/index.js'));
