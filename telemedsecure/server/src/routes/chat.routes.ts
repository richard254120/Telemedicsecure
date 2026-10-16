import { Router, Request, Response } from 'express';
import { requireAuth } from '../middlewares/auth';
import { chatService } from '../services/chat.service';

const router = Router();

router.use(requireAuth);

/**
 * GET /api/v1/chat/channels/:channelId/messages
 * Retrieve persistent messages for a clinical channel
 */
router.get('/channels/:channelId/messages', (req: Request, res: Response) => {
  try {
    const channelId = String(req.params.channelId);
    const messages = chatService.getChannelMessages(channelId);
    res.json(messages);
  } catch (err: any) {
    res.status(500).json({ error: 'Failed to retrieve messages', details: err.message });
  }
});

/**
 * POST /api/v1/chat/channels/:channelId/messages
 * Post a new encrypted message to a clinical channel
 */
router.post('/channels/:channelId/messages', async (req: Request, res: Response) => {
  try {
    const channelId = String(req.params.channelId);
    const user = (req as any).user;
    const { text, ciphertext, iv, senderName, senderRole } = req.body;

    if (!text && !ciphertext) {
      return res.status(400).json({ error: 'Message content is required' });
    }

    const savedMessage = await chatService.postMessage(
      channelId,
      {
        senderId: user.id,
        senderName: senderName || `${user.firstName} ${user.lastName}`,
        senderRole: senderRole || user.role,
        text: text || ciphertext,
        ciphertext,
        iv,
      },
      req.ip
    );

    res.status(201).json(savedMessage);
  } catch (err: any) {
    res.status(500).json({ error: 'Failed to send message', details: err.message });
  }
});

export default router;
