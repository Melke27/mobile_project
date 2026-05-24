const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const Item = require('../models/Item');
const User = require('../models/User');
const Notification = require('../models/Notification');
const { scorePair } = require('../utils/matchEngine');

const ALLOWED_STATUSES = ['lost', 'found', 'recovered'];
const ALLOWED_CREATE_STATUSES = ['lost', 'found'];

const trimString = (value = '') => (typeof value === 'string' ? value.trim() : '');

const escapeRegExp = (input = '') => input.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

const sanitizeSecrets = (rawQuestions) => {
  if (!Array.isArray(rawQuestions)) {
    return [];
  }

  return rawQuestions
    .map((entry) => ({
      question: trimString(entry?.question),
      answer: trimString(entry?.answer).toLowerCase(),
    }))
    .filter((entry) => entry.question && entry.answer)
    .slice(0, 5);
};

const parseLocation = (location) => {
  if (!location || typeof location !== 'object') {
    return null;
  }

  const latitude = Number(location.latitude);
  const longitude = Number(location.longitude);
  const accuracy = Number(location.accuracy || 0);

  const hasValidLat = Number.isFinite(latitude) && latitude >= -90 && latitude <= 90;
  const hasValidLng = Number.isFinite(longitude) && longitude >= -180 && longitude <= 180;

  if (!hasValidLat || !hasValidLng) {
    return null;
  }

  return {
    latitude,
    longitude,
    accuracy: Number.isFinite(accuracy) ? Math.max(0, accuracy) : 0,
  };
};

const buildListQuery = (query) => {
  const filter = {};

  // By default, exclude archived items unless explicitly requested
  if (query.includeArchived !== 'true') {
    filter.status = { $ne: 'archived' };
  }

  if (query.status && ALLOWED_STATUSES.includes(query.status)) {
    filter.status = query.status;
  }

  if (query.campus) {
    filter.campus = trimString(query.campus);
  }

  if (query.category) {
    filter.category = trimString(query.category);
  }

  if (query.keyword) {
    const safeKeyword = escapeRegExp(trimString(query.keyword));
    if (safeKeyword) {
      const keywordRegex = new RegExp(safeKeyword, 'i');
      filter.$or = [{ title: keywordRegex }, { description: keywordRegex }, { locationText: keywordRegex }];
    }
  }

  if (query.location) {
    const safeLocation = escapeRegExp(trimString(query.location));
    if (safeLocation) {
      filter.locationText = new RegExp(safeLocation, 'i');
    }
  }

  if (query.dateFrom || query.dateTo) {
    const createdAt = {};

    if (query.dateFrom) {
      const from = new Date(query.dateFrom);
      if (!Number.isNaN(from.valueOf())) {
        createdAt.$gte = from;
      }
    }

    if (query.dateTo) {
      const to = new Date(query.dateTo);
      if (!Number.isNaN(to.valueOf())) {
        createdAt.$lte = to;
      }
    }

    if (Object.keys(createdAt).length) {
      filter.createdAt = createdAt;
    }
  }

  return filter;
};

const mergeWithVisibility = (baseFilter, visibilityClause) => {
  const nextFilter = { ...baseFilter };

  if (nextFilter.$and) {
    nextFilter.$and = [...nextFilter.$and, visibilityClause];
    return nextFilter;
  }

  return { $and: [nextFilter, visibilityClause] };
};

const applyRoleAwareVisibility = ({ baseFilter, user, query = {} }) => {
  const isAdmin = user?.role === 'admin';

  if (isAdmin) {
    const approvalStatus = trimString(query.approvalStatus).toLowerCase();
    if (['pending', 'approved', 'rejected'].includes(approvalStatus)) {
      return { ...baseFilter, approvalStatus };
    }
    return baseFilter;
  }

  const visibilityClauses = [
    {
      reporterRole: { $ne: 'admin' },
      $or: [{ approvalStatus: 'approved' }, { approvalStatus: { $exists: false } }],
    },
  ];

  if (user?._id) {
    if (query.onlyMine === 'true') {
      return { ...baseFilter, reportedBy: user._id };
    }
    visibilityClauses.push({ reportedBy: user._id });
  }

  return mergeWithVisibility(baseFilter, { $or: visibilityClauses });
};

const notifyPotentialMatches = async (newItem) => {
  const oppositeStatus = newItem.status === 'lost' ? 'found' : 'lost';

  const candidates = await Item.find({
    _id: { $ne: newItem._id },
    status: oppositeStatus,
    campus: newItem.campus,
  })
    .sort({ createdAt: -1 })
    .limit(80);

  const notifications = [];

  candidates.forEach((candidate) => {
    const score = scorePair(newItem, candidate);

    if (score < 0.6) {
      return;
    }

    if (candidate.reportedBy.toString() !== newItem.reportedBy.toString()) {
      notifications.push({
        userId: candidate.reportedBy,
        type: 'match',
        title: 'Potential match found',
        body: `A new ${newItem.status} report may match your item (${Math.round(score * 100)}%).`,
        meta: { itemId: newItem._id, score },
      });
    }

    notifications.push({
      userId: newItem.reportedBy,
      type: 'match',
      title: 'Potential match discovered',
      body: `One of the existing reports looks similar (${Math.round(score * 100)}%).`,
      meta: { itemId: candidate._id, score },
    });
  });

  if (notifications.length) {
    await Notification.insertMany(notifications, { ordered: false });
  }
};

const notifyAdminsForPendingApproval = async (item, reporter) => {
  try {
    const admins = await User.find({ role: 'admin', isSuspended: { $ne: true } }).select('_id');
    if (!admins.length) {
      return;
    }

    const notifications = admins.map((admin) => ({
      userId: admin._id,
      type: 'moderation',
      title: 'New report pending approval',
      body: `${reporter?.name || 'A user'} submitted "${item.title}".`,
      meta: { itemId: item._id, approvalStatus: item.approvalStatus },
    }));

    await Notification.insertMany(notifications, { ordered: false });
  } catch (error) {
    console.error('Pending-approval notification failure:', error.message);
  }
};

const createItem = async (req, res, next) => {
  try {
    const status = trimString(req.body.status).toLowerCase();
    const title = trimString(req.body.title);
    const description = trimString(req.body.description);
    const category = trimString(req.body.category);
    const campus = trimString(req.body.campus);
    const locationText = trimString(req.body.locationText);
    const imageUrl = trimString(req.body.imageUrl);
    const location = parseLocation(req.body.location);
    const safeQuestions = sanitizeSecrets(req.body.secretQuestions);

    if (!ALLOWED_CREATE_STATUSES.includes(status)) {
      return res.status(400).json({ message: 'Status must be either lost or found.' });
    }

    if (title.length < 3) {
      return res.status(400).json({ message: 'Title must be at least 3 characters.' });
    }

    if (description.length < 10) {
      return res.status(400).json({ message: 'Description must be at least 10 characters.' });
    }

    if (!category || !campus) {
      return res.status(400).json({ message: 'Category and campus are required.' });
    }
    if (status === 'found' && !safeQuestions.length) {
      return res.status(400).json({ message: 'At least one secret question is required for found items.' });
    }

    const secretQuestions = await Promise.all(
      safeQuestions.map(async (entry) => ({
        question: entry.question,
        answerHash: await bcrypt.hash(entry.answer, 10),
      }))
    );

    const created = await Item.create({
      status,
      title,
      description,
      category,
      campus,
      locationText,
      location,
      imageUrl,
      secretQuestions,
      reportedBy: req.user._id,
      reporterRole: req.user.role === 'admin' ? 'admin' : 'user',
      approvalStatus: req.user.role === 'admin' ? 'approved' : 'pending',
      approvedBy: req.user.role === 'admin' ? req.user._id : null,
      approvedAt: req.user.role === 'admin' ? new Date() : null,
      approvalNote: req.user.role === 'admin' ? 'Auto-approved for admin post.' : '',
    });

    notifyPotentialMatches(created).catch((err) => {
      console.error('Potential match notification failure:', err.message);
    });
    if (req.user.role !== 'admin') {
      notifyAdminsForPendingApproval(created, req.user).catch((err) => {
        console.error('Admin approval notification failure:', err.message);
      });
    }

    const item = await Item.findById(created._id).populate('reportedBy', '_id name email campus role');
    return res.status(201).json({ item });
  } catch (error) {
    return next(error);
  }
};

const listItems = async (req, res, next) => {
  try {
    const rawFilter = buildListQuery(req.query);
    const filter = applyRoleAwareVisibility({
      baseFilter: rawFilter,
      user: req.user || null,
      query: req.query || {},
    });
    const page = Math.max(Number(req.query.page) || 1, 1);
    const limit = Math.min(Math.max(Number(req.query.limit) || 30, 1), 100);

    const [items, total] = await Promise.all([
      Item.find(filter)
        .populate('reportedBy', '_id name email campus role')
        .sort({ createdAt: -1 })
        .skip((page - 1) * limit)
        .limit(limit),
      Item.countDocuments(filter),
    ]);
    const isAdminRequester = req.user?.role === 'admin';
    const visibleItems = isAdminRequester
      ? items
      : items.filter((entry) => {
          const isOwner =
            req.user?._id && entry.reportedBy?._id?.toString() === req.user._id.toString();
          if (isOwner) {
            return true;
          }

          const reporterRole = entry.reporterRole || entry.reportedBy?.role || 'user';
          const approvalStatus = entry.approvalStatus || 'approved';
          return approvalStatus === 'approved' && reporterRole !== 'admin';
        });
    const hiddenOnPage = Math.max(0, items.length - visibleItems.length);
    const visibleTotal = isAdminRequester ? total : Math.max(0, total - hiddenOnPage);

    return res.json({
      items: visibleItems,
      pagination: {
        page,
        limit,
        total: visibleTotal,
        totalPages: Math.max(Math.ceil(visibleTotal / limit), 1),
      },
    });
  } catch (error) {
    return next(error);
  }
};

const getItemById = async (req, res, next) => {
  try {
    const { id } = req.params;
    if (!mongoose.isValidObjectId(id)) {
      return res.status(400).json({ message: 'Invalid item id.' });
    }

    const item = await Item.findById(id)
      .populate('reportedBy', '_id name email campus role phoneNumber')
      .populate('claim.requester', '_id name email campus');
    if (!item) {
      return res.status(404).json({ message: 'Item not found.' });
    }

    const isAdmin = req.user?.role === 'admin';
    const isOwner = req.user?._id && item.reportedBy?._id?.toString() === req.user._id.toString();
    const approvalStatus = item.approvalStatus || 'approved';
    const reporterRole = item.reporterRole || item.reportedBy?.role || 'user';
    const isPubliclyVisible = approvalStatus === 'approved' && reporterRole !== 'admin';
    if (!isAdmin && !isOwner && !isPubliclyVisible) {
      return res.status(404).json({ message: 'Item not found.' });
    }

    return res.json({ item });
  } catch (error) {
    return next(error);
  }
};

const updateItem = async (req, res, next) => {
  try {
    const { id } = req.params;
    const item = await Item.findById(id);
    if (!item) {
      return res.status(404).json({ message: 'Item not found.' });
    }

    if (item.reportedBy.toString() !== req.user._id.toString() && req.user.role !== 'admin') {
      return res.status(403).json({ message: 'Not allowed to edit this item.' });
    }

    const nextTitle = trimString(req.body.title);
    const nextDescription = trimString(req.body.description);
    const nextCategory = trimString(req.body.category);
    const nextLocationText = trimString(req.body.locationText);
    const nextImageUrl = trimString(req.body.imageUrl);
    const nextLocation = req.body.location ? parseLocation(req.body.location) : item.location;
    const requestedStatus = trimString(req.body.status).toLowerCase();
    let requiresReapproval = false;

    if (nextTitle) {
      if (nextTitle.length < 3) {
        return res.status(400).json({ message: 'Title must be at least 3 characters.' });
      }
      item.title = nextTitle;
      requiresReapproval = true;
    }
    if (nextDescription) {
      if (nextDescription.length < 10) {
        return res.status(400).json({ message: 'Description must be at least 10 characters.' });
      }
      item.description = nextDescription;
      requiresReapproval = true;
    }
    if (nextCategory) {
      item.category = nextCategory;
      requiresReapproval = true;
    }
    if (nextLocationText || req.body.locationText === '') {
      item.locationText = nextLocationText;
      requiresReapproval = true;
    }
    if (nextImageUrl || req.body.imageUrl === '') {
      item.imageUrl = nextImageUrl;
      requiresReapproval = true;
    }
    if (nextLocation) {
      item.location = nextLocation;
      requiresReapproval = true;
    }
    if (requestedStatus && ALLOWED_STATUSES.includes(requestedStatus)) {
      item.status = requestedStatus;
      if (requestedStatus === 'recovered' && !item.recoveredAt) {
        item.recoveredAt = new Date();
      }
    }

    if (Array.isArray(req.body.secretQuestions)) {
      const safeQuestions = sanitizeSecrets(req.body.secretQuestions);
      const hashedQuestions = await Promise.all(
        safeQuestions.map(async (entry) => ({
          question: entry.question,
          answerHash: await bcrypt.hash(entry.answer, 10),
        }))
      );
      item.secretQuestions = hashedQuestions;
      requiresReapproval = true;
    }

    if (req.user.role !== 'admin' && requiresReapproval) {
      item.approvalStatus = 'pending';
      item.approvedBy = null;
      item.approvedAt = null;
      item.approvalNote = 'Awaiting admin approval after edit.';
    }

    await item.save();
    const updated = await Item.findById(item._id)
      .populate('reportedBy', '_id name email campus role phoneNumber')
      .populate('claim.requester', '_id name email campus');
    return res.json({ item: updated });
  } catch (error) {
    return next(error);
  }
};

const requestClaim = async (req, res, next) => {
  try {
    const { id } = req.params;
    const item = await Item.findById(id);
    if (!item) {
      return res.status(404).json({ message: 'Item not found.' });
    }

    if (item.status !== 'found') {
      return res.status(400).json({ message: 'Only found items can be claimed.' });
    }
    if (item.reportedBy.toString() === req.user._id.toString()) {
      return res.status(400).json({ message: 'You cannot claim your own post.' });
    }
    if (!Array.isArray(item.secretQuestions) || !item.secretQuestions.length) {
      return res.status(400).json({ message: 'This item has no secret questions for claiming.' });
    }
    if (item.claim?.status === 'pending') {
      return res.status(400).json({ message: 'This item already has a pending claim.' });
    }

    const answers = Array.isArray(req.body.answers) ? req.body.answers.map((entry) => trimString(entry).toLowerCase()) : [];
    if (answers.length !== item.secretQuestions.length || answers.some((entry) => !entry)) {
      return res.status(400).json({ message: 'Please answer all secret questions.' });
    }

    let autoMatched = true;
    for (let i = 0; i < item.secretQuestions.length; i += 1) {
      const ok = await bcrypt.compare(answers[i], item.secretQuestions[i].answerHash);
      if (!ok) {
        autoMatched = false;
      }
    }

    item.claim = {
      status: 'pending',
      requester: req.user._id,
      answers,
      note: trimString(req.body.note),
      autoMatched,
      requestedAt: new Date(),
      reviewedAt: null,
      reviewedBy: null,
      reviewNote: '',
    };
    await item.save();

    await Notification.create({
      userId: item.reportedBy,
      type: 'system',
      title: 'New claim request',
      body: `${req.user.name || 'A user'} submitted \"This is Mine!\" for your found item.`,
      meta: { itemId: item._id, claimStatus: 'pending' },
    });

    return res.json({
      claim: {
        status: item.claim.status,
        requester: item.claim.requester,
        autoMatched: item.claim.autoMatched,
        requestedAt: item.claim.requestedAt,
      },
    });
  } catch (error) {
    return next(error);
  }
};

const reviewClaim = async (req, res, next) => {
  try {
    const { id } = req.params;
    const action = trimString(req.body.action).toLowerCase();
    const note = trimString(req.body.note);
    if (!['approve', 'decline'].includes(action)) {
      return res.status(400).json({ message: 'Action must be approve or decline.' });
    }

    const item = await Item.findById(id);
    if (!item) {
      return res.status(404).json({ message: 'Item not found.' });
    }

    if (item.reportedBy.toString() !== req.user._id.toString() && req.user.role !== 'admin') {
      return res.status(403).json({ message: 'Only finder or admin can review claims.' });
    }
    if (!item.claim?.requester || item.claim.status !== 'pending') {
      return res.status(400).json({ message: 'No pending claim for this item.' });
    }

    item.claim.status = action === 'approve' ? 'approved' : 'declined';
    item.claim.reviewedAt = new Date();
    item.claim.reviewedBy = req.user._id;
    item.claim.reviewNote = note;

    if (action === 'approve') {
      item.status = 'recovered';
      item.recoveredAt = new Date();
    }

    const requesterId = item.claim.requester;
    await item.save();

    await Notification.create({
      userId: requesterId,
      type: 'system',
      title: action === 'approve' ? 'Claim approved' : 'Claim declined',
      body:
        action === 'approve'
          ? 'Your claim was approved. You can now reveal owner contact details.'
          : 'Your claim was declined by the finder.',
      meta: { itemId: item._id, claimStatus: item.claim.status },
    });

    const updated = await Item.findById(item._id)
      .populate('reportedBy', '_id name email campus role phoneNumber')
      .populate('claim.requester', '_id name email campus');
    return res.json({ item: updated });
  } catch (error) {
    return next(error);
  }
};

const getClaimContact = async (req, res, next) => {
  try {
    const { id } = req.params;
    const item = await Item.findById(id).populate('reportedBy', '_id name phoneNumber');
    if (!item) {
      return res.status(404).json({ message: 'Item not found.' });
    }
    if (item.claim?.status !== 'approved' || !item.claim?.requester) {
      return res.status(400).json({ message: 'No approved claim contact available.' });
    }

    const isRequester = item.claim.requester.toString() === req.user._id.toString();
    const isOwner = item.reportedBy?._id?.toString() === req.user._id.toString();
    const isAdmin = req.user.role === 'admin';
    if (!isRequester && !isOwner && !isAdmin) {
      return res.status(403).json({ message: 'Not allowed to access contact details.' });
    }

    return res.json({
      contact: {
        name: item.reportedBy?.name || 'Owner',
        phoneNumber: item.reportedBy?.phoneNumber || '',
      },
    });
  } catch (error) {
    return next(error);
  }
};

const markRecovered = async (req, res, next) => {
  try {
    const { id } = req.params;
    const item = await Item.findById(id);
    if (!item) {
      return res.status(404).json({ message: 'Item not found.' });
    }

    if (item.reportedBy.toString() !== req.user._id.toString() && req.user.role !== 'admin') {
      return res.status(403).json({ message: 'Not allowed to update this item.' });
    }

    if (item.status !== 'recovered') {
      item.status = 'recovered';
      item.recoveredAt = new Date();
      await item.save();
    }

    return res.json({ item });
  } catch (error) {
    return next(error);
  }
};

const flagItem = async (req, res, next) => {
  try {
    const { id } = req.params;
    const item = await Item.findById(id);
    if (!item) {
      return res.status(404).json({ message: 'Item not found.' });
    }

    if (item.reportedBy.toString() === req.user._id.toString()) {
      return res.status(400).json({ message: 'You cannot flag your own report.' });
    }

    item.flagged = true;
    item.flagReason = trimString(req.body.reason) || 'User flagged this report';
    item.flaggedBy = req.user._id;
    item.reviewStatus = 'not_reviewed';
    item.reviewedBy = null;
    item.reviewedAt = null;
    await item.save();

    if (item.reportedBy.toString() !== req.user._id.toString()) {
      await Notification.create({
        userId: item.reportedBy,
        type: 'moderation',
        title: 'Your report was flagged',
        body: 'A user flagged your item report. Admin review may follow.',
        meta: { itemId: item._id },
      });
    }

    return res.json({ item });
  } catch (error) {
    return next(error);
  }
};

const getFlaggedItems = async (req, res, next) => {
  try {
    const page = Math.max(Number(req.query.page) || 1, 1);
    const limit = Math.min(Math.max(Number(req.query.limit) || 30, 1), 100);

    const [items, total] = await Promise.all([
      Item.find({ flagged: true })
        .populate('reportedBy', '_id name email campus role')
        .populate('flaggedBy', '_id name email campus role')
        .sort({ createdAt: -1 })
        .skip((page - 1) * limit)
        .limit(limit),
      Item.countDocuments({ flagged: true }),
    ]);

    return res.json({
      items,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.max(Math.ceil(total / limit), 1),
      },
    });
  } catch (error) {
    return next(error);
  }
};

const getPendingApprovalItems = async (req, res, next) => {
  try {
    const page = Math.max(Number(req.query.page) || 1, 1);
    const limit = Math.min(Math.max(Number(req.query.limit) || 30, 1), 100);
    const keyword = trimString(req.query.keyword);
    const filter = { approvalStatus: 'pending' };

    if (keyword) {
      const safeKeyword = escapeRegExp(keyword);
      const keywordRegex = new RegExp(safeKeyword, 'i');
      filter.$or = [
        { title: keywordRegex },
        { description: keywordRegex },
        { category: keywordRegex },
        { campus: keywordRegex },
        { locationText: keywordRegex },
      ];
    }

    const [items, total] = await Promise.all([
      Item.find(filter)
        .populate('reportedBy', '_id name email campus role')
        .sort({ createdAt: -1 })
        .skip((page - 1) * limit)
        .limit(limit),
      Item.countDocuments(filter),
    ]);

    return res.json({
      items,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.max(Math.ceil(total / limit), 1),
      },
    });
  } catch (error) {
    return next(error);
  }
};

const getPendingClaimItems = async (req, res, next) => {
  try {
    const page = Math.max(Number(req.query.page) || 1, 1);
    const limit = Math.min(Math.max(Number(req.query.limit) || 30, 1), 100);
    const keyword = trimString(req.query.keyword);
    const filter = { 'claim.status': 'pending' };

    if (keyword) {
      const safeKeyword = escapeRegExp(keyword);
      const keywordRegex = new RegExp(safeKeyword, 'i');
      filter.$or = [
        { title: keywordRegex },
        { description: keywordRegex },
        { category: keywordRegex },
        { campus: keywordRegex },
        { locationText: keywordRegex },
      ];
    }

    const [items, total] = await Promise.all([
      Item.find(filter)
        .populate('reportedBy', '_id name email campus role')
        .populate('claim.requester', '_id name email campus role')
        .sort({ createdAt: -1 })
        .skip((page - 1) * limit)
        .limit(limit),
      Item.countDocuments(filter),
    ]);

    return res.json({
      items,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.max(Math.ceil(total / limit), 1),
      },
    });
  } catch (error) {
    return next(error);
  }
};

const reviewFlaggedItem = async (req, res, next) => {
  try {
    const { id } = req.params;
    const action = trimString(req.body.action).toLowerCase();
    const note = trimString(req.body.note);

    if (!['clear', 'keep'].includes(action)) {
      return res.status(400).json({ message: 'Action must be either clear or keep.' });
    }

    const item = await Item.findById(id);
    if (!item) {
      return res.status(404).json({ message: 'Item not found.' });
    }

    if (action === 'clear') {
      item.flagged = false;
      item.flagReason = '';
      item.flaggedBy = null;
      item.reviewStatus = 'reviewed_clear';
    } else {
      item.flagged = true;
      item.reviewStatus = 'reviewed_keep';
    }

    item.reviewNote = note;
    item.reviewedBy = req.user._id;
    item.reviewedAt = new Date();

    await item.save();

    if (item.reportedBy?.toString() !== req.user._id.toString()) {
      await Notification.create({
        userId: item.reportedBy,
        type: 'moderation',
        title: action === 'clear' ? 'Report approved' : 'Report needs attention',
        body:
          action === 'clear'
            ? 'Admin reviewed your flagged report and kept it active.'
            : 'Admin reviewed your report and marked it for further attention.',
        meta: { itemId: item._id },
      });
    }

    return res.json({ item });
  } catch (error) {
    return next(error);
  }
};

const reviewItemApproval = async (req, res, next) => {
  try {
    const { id } = req.params;
    const action = trimString(req.body.action).toLowerCase();
    const note = trimString(req.body.note);

    if (!['approve', 'reject'].includes(action)) {
      return res.status(400).json({ message: 'Action must be either approve or reject.' });
    }

    const item = await Item.findById(id);
    if (!item) {
      return res.status(404).json({ message: 'Item not found.' });
    }

    item.approvalStatus = action === 'approve' ? 'approved' : 'rejected';
    item.approvedBy = req.user._id;
    item.approvedAt = new Date();
    item.approvalNote = note;

    await item.save();

    if (item.reportedBy?.toString() !== req.user._id.toString()) {
      await Notification.create({
        userId: item.reportedBy,
        type: 'moderation',
        title: action === 'approve' ? 'Report approved' : 'Report rejected',
        body:
          action === 'approve'
            ? 'Admin approved your report. It is now visible on the public feed.'
            : 'Admin rejected your report. Please review and edit your details.',
        meta: { itemId: item._id, approvalStatus: item.approvalStatus },
      });
    }

    const updated = await Item.findById(item._id)
      .populate('reportedBy', '_id name email campus role phoneNumber')
      .populate('claim.requester', '_id name email campus');

    return res.json({ item: updated });
  } catch (error) {
    return next(error);
  }
};

const deleteItem = async (req, res, next) => {
  try {
    const { id } = req.params;
    const item = await Item.findById(id);

    if (!item) {
      return res.status(404).json({ message: 'Item not found.' });
    }
    if (item.reportedBy.toString() !== req.user._id.toString() && req.user.role !== 'admin') {
      return res.status(403).json({ message: 'Not allowed to delete this item.' });
    }

    await item.deleteOne();
    return res.json({ message: 'Item deleted successfully.' });
  } catch (error) {
    return next(error);
  }
};

const getPotentialMatches = async (req, res, next) => {
  try {
    const { id } = req.params;
    const item = await Item.findById(id);

    if (!item) {
      return res.status(404).json({ message: 'Item not found.' });
    }

    const targetStatus = item.status === 'lost' ? 'found' : 'lost';

    const candidates = await Item.find({
      _id: { $ne: item._id },
      status: targetStatus,
      campus: item.campus,
      category: item.category,
      reporterRole: { $ne: 'admin' },
      $or: [{ approvalStatus: 'approved' }, { approvalStatus: { $exists: false } }],
    })
      .populate('reportedBy', '_id name email campus role')
      .sort({ createdAt: -1 })
      .limit(80);

    const matches = candidates
      .map((candidate) => ({ item: candidate, score: scorePair(item, candidate) }))
      .filter((entry) => entry.score >= 0.45)
      .sort((a, b) => b.score - a.score)
      .slice(0, 20);

    return res.json({ matches });
  } catch (error) {
    return next(error);
  }
};

const getAdminStats = async (_req, res, next) => {
  try {
    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);

    const [
      totalUsers,
      suspendedUsers,
      totalReports,
      lostReports,
      foundReports,
      recoveredReports,
      flaggedReports,
      todayReports,
      pendingClaims,
      approvedClaims,
      pendingApprovals,
      rejectedApprovals,
      topLostCategory,
    ] = await Promise.all([
      User.countDocuments(),
      User.countDocuments({ isSuspended: true }),
      Item.countDocuments(),
      Item.countDocuments({ status: 'lost' }),
      Item.countDocuments({ status: 'found' }),
      Item.countDocuments({ status: 'recovered' }),
      Item.countDocuments({ flagged: true }),
      Item.countDocuments({ createdAt: { $gte: todayStart } }),
      Item.countDocuments({ 'claim.status': 'pending' }),
      Item.countDocuments({ 'claim.status': 'approved' }),
      Item.countDocuments({ approvalStatus: 'pending' }),
      Item.countDocuments({ approvalStatus: 'rejected' }),
      Item.aggregate([
        { $match: { status: 'lost' } },
        { $group: { _id: '$category', count: { $sum: 1 } } },
        { $sort: { count: -1 } },
        { $limit: 1 },
      ]),
    ]);

    return res.json({
      stats: {
        totalUsers,
        suspendedUsers,
        totalReports,
        lostReports,
        foundReports,
        recoveredReports,
        flaggedReports,
        todayReports,
        pendingClaims,
        approvedClaims,
        pendingApprovals,
        rejectedApprovals,
        mostLostCategory: topLostCategory?.[0]?._id || 'N/A',
        mostLostCategoryCount: topLostCategory?.[0]?.count || 0,
      },
    });
  } catch (error) {
    return next(error);
  }
};

module.exports = {
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
};
