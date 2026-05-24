const express = require('express');
const { listConversation, listConversations, getUnreadCount, sendMessage } = require('../controllers/chatController');
const { requireAuth } = require('../middleware/auth');

const router = express.Router();

router.get('/conversations', requireAuth, listConversations);
router.get('/unread/count', requireAuth, getUnreadCount);
router.get('/:itemId/:otherUserId', requireAuth, listConversation);
router.post('/send', requireAuth, sendMessage);

module.exports = router;
