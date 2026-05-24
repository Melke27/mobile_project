const express = require('express');
const {
  createItem,
  listItems,
  getItemById,
  updateItem,
  requestClaim,
  reviewClaim,
  getClaimContact,
  markRecovered,
  flagItem,
  getFlaggedItems,
  getPendingApprovalItems,
  getPendingClaimItems,
  reviewFlaggedItem,
  reviewItemApproval,
  deleteItem,
  getPotentialMatches,
  getAdminStats,
} = require('../controllers/itemController');
const { requireAuth, optionalAuth, requireAdmin } = require('../middleware/auth');

const router = express.Router();

router.get('/', optionalAuth, listItems);
router.get('/flagged/list', requireAuth, requireAdmin, getFlaggedItems);
router.get('/approval/pending', requireAuth, requireAdmin, getPendingApprovalItems);
router.get('/claims/pending', requireAuth, requireAdmin, getPendingClaimItems);
router.get('/admin/stats', requireAuth, requireAdmin, getAdminStats);
router.get('/:id/matches', requireAuth, getPotentialMatches);
router.get('/:id', optionalAuth, getItemById);
router.post('/', requireAuth, createItem);
router.put('/:id', requireAuth, updateItem);
router.post('/:id/claim', requireAuth, requestClaim);
router.patch('/:id/claim/review', requireAuth, reviewClaim);
router.get('/:id/claim/contact', requireAuth, getClaimContact);
router.patch('/:id/recovered', requireAuth, markRecovered);
router.patch('/:id/flag', requireAuth, flagItem);
router.patch('/:id/review', requireAuth, requireAdmin, reviewFlaggedItem);
router.patch('/:id/approval', requireAuth, requireAdmin, reviewItemApproval);
router.delete('/:id', requireAuth, deleteItem);

module.exports = router;
