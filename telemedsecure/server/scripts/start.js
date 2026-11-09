const { execSync } = require('child_process');
const path = require('path');

console.log('==> [TeleMedSecure Server Startup]');


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
