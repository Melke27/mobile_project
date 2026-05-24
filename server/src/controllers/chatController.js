const mongoose = require('mongoose');
const Message = require('../models/Message');
const Item = require('../models/Item');
const User = require('../models/User');
const Notification = require('../models/Notification');

const composeConversationId = (a, b, itemId) => [a, b].sort().join('_') + `_${itemId}`;

const canAccessItemConversation = ({ item, userId, otherUserId, isAdmin }) => {
  if (isAdmin) {
    return true;
  }

  const reporterId = item?.reportedBy?.toString();
  if (!reporterId) {
    return false;
  }

  // To keep chats tied to the report owner, at least one side must be the reporter.
  return reporterId === userId || reporterId === otherUserId;
};

const listConversation = async (req, res, next) => {
  try {
    const { itemId, otherUserId } = req.params;

    if (!mongoose.isValidObjectId(itemId) || !mongoose.isValidObjectId(otherUserId)) {
      return res.status(400).json({ message: 'Invalid parameters.' });
    }

    const item = await Item.findById(itemId).select('_id reportedBy');
    if (!item) {
      return res.status(404).json({ message: 'Referenced item not found.' });
    }

    const currentUserId = req.user._id.toString();
    const isAdmin = req.user.role === 'admin';
    if (!canAccessItemConversation({ item, userId: currentUserId, otherUserId, isAdmin })) {
      return res.status(403).json({ message: 'Not allowed to access this conversation.' });
    }

    const conversationId = composeConversationId(currentUserId, otherUserId, itemId);

    await Message.updateMany(
      {
        conversationId,
        receiverId: req.user._id,
        readAt: null,
      },
      {
        $set: { readAt: new Date() },
      }
    );

    const messages = await Message.find({ conversationId }).sort({ createdAt: 1 });

    return res.json({ messages, conversationId });
  } catch (error) {
    return next(error);
  }
};

const listConversations = async (req, res, next) => {
  try {
    const currentUserId = req.user._id;
    const currentUserIdStr = currentUserId.toString();

    const messages = await Message.find({
      $or: [{ senderId: currentUserId }, { receiverId: currentUserId }],
    })
      .sort({ createdAt: -1 })
      .limit(800)
      .lean();

    const latestByConversation = new Map();
    const itemIds = new Set();
    const otherUserIds = new Set();

    messages.forEach((entry) => {
      if (!latestByConversation.has(entry.conversationId)) {
        latestByConversation.set(entry.conversationId, entry);

        const senderId = entry.senderId?.toString();
        const receiverId = entry.receiverId?.toString();
        const otherId = senderId === currentUserIdStr ? receiverId : senderId;

        if (entry.itemId) {
          itemIds.add(entry.itemId.toString());
        }
        if (otherId) {
          otherUserIds.add(otherId);
        }
      }
    });

    const conversationIds = [...latestByConversation.keys()];
    const unreadAgg = conversationIds.length
      ? await Message.aggregate([
          {
            $match: {
              conversationId: { $in: conversationIds },
              receiverId: currentUserId,
              readAt: null,
            },
          },
          {
            $group: {
              _id: '$conversationId',
              count: { $sum: 1 },
            },
          },
        ])
      : [];

    const unreadByConversation = unreadAgg.reduce((acc, row) => {
      acc[row._id] = row.count;
      return acc;
    }, {});

    const [items, users] = await Promise.all([
      itemIds.size
        ? Item.find({ _id: { $in: [...itemIds] } }).select('_id title status approvalStatus').lean()
        : [],
      otherUserIds.size
        ? User.find({ _id: { $in: [...otherUserIds] } }).select('_id name').lean()
        : [],
    ]);

    const itemById = new Map(items.map((entry) => [entry._id.toString(), entry]));
    const userById = new Map(users.map((entry) => [entry._id.toString(), entry]));

    const conversations = [...latestByConversation.values()].map((entry) => {
      const senderId = entry.senderId?.toString();
      const receiverId = entry.receiverId?.toString();
      const otherUserId = senderId === currentUserIdStr ? receiverId : senderId;
      const itemId = entry.itemId?.toString() || '';
      const item = itemById.get(itemId);
      const otherUser = userById.get(otherUserId);

      return {
        conversationId: entry.conversationId,
        itemId,
        itemTitle: item?.title || 'Unknown Item',
        itemStatus: item?.status || '',
        approvalStatus: item?.approvalStatus || '',
        otherUserId,
        otherUserName: otherUser?.name || 'User',
        lastMessage: entry.message,
        lastMessageAt: entry.createdAt,
        unreadCount: unreadByConversation[entry.conversationId] || 0,
      };
    });

    conversations.sort((a, b) => new Date(b.lastMessageAt).getTime() - new Date(a.lastMessageAt).getTime());

    return res.json({ conversations });
  } catch (error) {
    return next(error);
  }
};

const getUnreadCount = async (req, res, next) => {
  try {
    const unreadCount = await Message.countDocuments({
      receiverId: req.user._id,
      readAt: null,
    });

    return res.json({ unreadCount });
  } catch (error) {
    return next(error);
  }
};

const sendMessage = async (req, res, next) => {
  try {
    const { itemId, receiverId, message } = req.body;

    if (!itemId || !receiverId || !message?.trim()) {
      return res.status(400).json({ message: 'itemId, receiverId, and message are required.' });
    }

    if (!mongoose.isValidObjectId(itemId) || !mongoose.isValidObjectId(receiverId)) {
      return res.status(400).json({ message: 'Invalid id format.' });
    }

    if (receiverId.toString() === req.user._id.toString()) {
      return res.status(400).json({ message: 'Cannot send message to yourself.' });
    }

    const item = await Item.findById(itemId);
    if (!item) {
      return res.status(404).json({ message: 'Referenced item not found.' });
    }

    const currentUserId = req.user._id.toString();
    const isAdmin = req.user.role === 'admin';
    if (!canAccessItemConversation({ item, userId: currentUserId, otherUserId: receiverId.toString(), isAdmin })) {
      return res.status(403).json({ message: 'Not allowed to start this conversation.' });
    }

    const conversationId = composeConversationId(currentUserId, receiverId, itemId);

    const created = await Message.create({
      conversationId,
      itemId,
      senderId: req.user._id,
      receiverId,
      message: message.trim(),
      readAt: null,
    });

    Notification.create({
      userId: receiverId,
      type: 'chat',
      title: 'New chat message',
      body: `You have a new message about ${item.title}.`,
      meta: { itemId: item._id },
    }).catch(() => undefined);

    return res.status(201).json({ message: created, conversationId });
  } catch (error) {
    return next(error);
  }
};

module.exports = {
  listConversation,
  listConversations,
  getUnreadCount,
  sendMessage,
  composeConversationId,
};
