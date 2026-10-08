import http from 'http';
import app from './app';
import { Server } from 'socket.io';
import dotenv from 'dotenv';
import { setupSignaling } from './socket/signaling';

dotenv.config();

const PORT = process.env.PORT || 4000;
const server = http.createServer(app);

const io = new Server(server, {
  cors: {
    origin: process.env.FRONTEND_URL || 'http://localhost:5173',
    methods: ['GET', 'POST'],
    credentials: true,
  },
});

import { backfillChainIfEmpty, startPeriodicAnchoring } from './services/audit.service';
import { setIO } from './socket';

setIO(io);
setupSignaling(io);

server.listen(PORT, async () => {
  console.log(`Server running on port ${PORT}`);
  try {
    await backfillChainIfEmpty();
    startPeriodicAnchoring();
    console.log('AuditChain: Hash chaining and periodic Merkle anchoring active');
  } catch (err: any) {
    console.error('AuditChain initialization warning:', err.message);
  }
});
