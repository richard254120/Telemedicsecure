const path = require('path');

console.log('==> [TeleMedSecure Server Startup]');
console.log('==> Starting TeleMedSecure backend server...');
require(path.join(__dirname, '../dist/index.js'));
