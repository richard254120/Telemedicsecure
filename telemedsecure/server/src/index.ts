import dotenv from 'dotenv';
import http from 'http';
import app from './app';
import { Server } from 'socket.io';
import { setupSignaling } from './socket/signaling';
import { backfillChainIfEmpty, startPeriodicAnchoring } from './services/audit.service';
import { setIO } from './socket';

dotenv.config();

// generateTokens() falls back to 'secret' / 'rsecret' when the environment is
// unset, and anyone who knows the signing key can forge an ADMIN access token.
// Fail at boot instead of running on a guessable or copy-pasted key.
if (process.env.NODE_ENV === 'production') {
  const PLACEHOLDER_SECRETS = [
    'secret', 'rsecret', 'changeme',
    'your_super_secret_jwt_key_here', 'your_super_secret_refresh_key_here',
  ];
  const weak = ['JWT_SECRET', 'JWT_REFRESH_SECRET'].filter((name) => {
    const value = process.env[name] ?? '';
    return value.length < 24 || PLACEHOLDER_SECRETS.includes(value);
  });
  if (weak.length > 0) {
    console.error(`Refusing to start: ${weak.join(', ')} must be a unique random value of at least 24 characters.`);
    process.exit(1);
  }
  if (process.env.JWT_SECRET === process.env.JWT_REFRESH_SECRET) {
    console.error('Refusing to start: JWT_SECRET and JWT_REFRESH_SECRET must not be the same value.');
    process.exit(1);
  }
}

const PORT = process.env.PORT || 4000;
const HOST = process.env.HOST || '0.0.0.0';
const server = http.createServer(app);

const io = new Server(server, {
  cors: {
    origin: (origin, callback) => {
      const allowed = [
        process.env.FRONTEND_URL || 'http://localhost:5173',
        'http://localhost:5173',
        'http://127.0.0.1:5173',
        'https://telemedicsecure.vercel.app'
      ];

      // Allow requests with no origin
      if (!origin) {
        return callback(null, true);
      }

      // Check if origin is in allowed list
      if (allowed.includes(origin)) {
        return callback(null, true);
      }

      // Allow local network IP addresses (192.168.x.x, 10.x.x.x, 172.16-31.x.x)
      const localNetworkPattern = /^(http:\/\/)?(192\.168\.\d+\.\d+|10\.\d+\.\d+\.\d+|172\.(1[6-9]|2[0-9]|3[0-1])\.\d+\.\d+)(:\d+)?$/;
      if (localNetworkPattern.test(origin)) {
        return callback(null, true);
      }

      callback(new Error('CORS not allowed'), false);
    },
    methods: ['GET', 'POST'],
    credentials: true,
    allowedHeaders: ['Content-Type', 'Authorization'],
  },
});

setIO(io);
setupSignaling(io);

server.listen({ port: PORT, host: HOST }, async () => {
  console.log(`Server running on http://${HOST}:${PORT}`);
  try {
    await backfillChainIfEmpty();
    startPeriodicAnchoring();
    console.log('AuditChain: Hash chaining and periodic Merkle anchoring active');
  } catch (err: any) {
    console.error('AuditChain initialization warning:', err.message);
  }
});
