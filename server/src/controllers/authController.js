const bcrypt = require('bcryptjs');
const User = require('../models/User');
const generateToken = require('../utils/generateToken');
const MAX_AVATAR_LENGTH = 1500000;

const trimString = (value = '') => (typeof value === 'string' ? value.trim() : '');
const normalizeEmail = (value = '') => trimString(value).toLowerCase();

const isValidEmail = (email = '') => /^\S+@\S+\.\S+$/.test(email);
const isValidPhone = (phone = '') => {
  if (!phone) {
    return true;
  }
  return /^[+]?[\d\s\-()]{7,20}$/.test(phone);
};

const ADMIN_EMAILS = (process.env.ADMIN_EMAILS || 'admin@findit.app')
  .split(',')
  .map((email) => normalizeEmail(email))
  .filter(Boolean);

const isConfiguredAdminEmail = (email = '') => ADMIN_EMAILS.includes(normalizeEmail(email));

const serializeUser = (user) => ({
  _id: user._id,
  name: user.name,
  email: user.email,
  campus: user.campus,
  avatarUrl: user.avatarUrl || '',
  phoneNumber: user.phoneNumber || '',
  role: user.role,
  isSuspended: Boolean(user.isSuspended),
  suspendedAt: user.suspendedAt || null,
  suspensionReason: user.suspensionReason || '',
  createdAt: user.createdAt,
  updatedAt: user.updatedAt,
});

const register = async (req, res, next) => {
  try {
    const name = trimString(req.body.name);
    const email = normalizeEmail(req.body.email);
    const password = req.body.password || '';
    const campus = trimString(req.body.campus);
    const avatarUrl = trimString(req.body.avatarUrl);
    const phoneNumber = trimString(req.body.phoneNumber);

    if (!name || !email || !password || !campus) {
      return res.status(400).json({ message: 'name, email, password, and campus are required.' });
    }

    if (!isValidEmail(email)) {
      return res.status(400).json({ message: 'Please provide a valid email address.' });
    }

    if (password.length < 6) {
      return res.status(400).json({ message: 'Password must be at least 6 characters.' });
    }

    if (avatarUrl.length > MAX_AVATAR_LENGTH) {
      return res.status(400).json({ message: 'Profile image is too large. Please choose a smaller image.' });
    }
    if (!isValidPhone(phoneNumber)) {
      return res.status(400).json({ message: 'Please provide a valid phone number.' });
    }

    const existing = await User.findOne({ email });
    if (existing) {
      return res.status(409).json({ message: 'Email is already registered.' });
    }

    // Bootstrap convenience: first account becomes admin for moderation setup.
    // Also allow configured admin emails to auto-receive admin role.
    const role = (await User.estimatedDocumentCount()) === 0 || isConfiguredAdminEmail(email) ? 'admin' : 'user';

    const passwordHash = await bcrypt.hash(password, 10);
    const user = await User.create({
      name,
      email,
      passwordHash,
      campus,
      avatarUrl,
      phoneNumber,
      role,
    });

    const token = generateToken(user._id.toString());

    return res.status(201).json({
      token,
      user: serializeUser(user),
    });
  } catch (error) {
    return next(error);
  }
};

const login = async (req, res, next) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ message: 'email and password are required.' });
    }

    const user = await User.findOne({ email: normalizeEmail(email) });
    if (!user) {
      return res.status(401).json({ message: 'Invalid credentials.' });
    }

    const ok = await bcrypt.compare(password, user.passwordHash);
    if (!ok) {
      return res.status(401).json({ message: 'Invalid credentials.' });
    }

    // Keep admin role in sync for configured admin emails.
    if (user.role !== 'admin' && isConfiguredAdminEmail(user.email)) {
      user.role = 'admin';
      await user.save();
    }

    const token = generateToken(user._id.toString());

    return res.json({ token, user: serializeUser(user) });
  } catch (error) {
    return next(error);
  }
};

const me = async (req, res) => {
  return res.json({ user: serializeUser(req.user) });
};

const updateProfile = async (req, res, next) => {
  try {
    const user = await User.findById(req.user._id);
    if (!user) {
      return res.status(404).json({ message: 'User not found.' });
    }

    const nextName = trimString(req.body.name);
    const nextEmail = normalizeEmail(req.body.email);
    const nextCampus = trimString(req.body.campus);
    const nextAvatarUrl = trimString(req.body.avatarUrl);
    const nextPhoneNumber = trimString(req.body.phoneNumber);

    if (!nextName || !nextEmail || !nextCampus) {
      return res.status(400).json({ message: 'name, email, and campus are required.' });
    }

    if (!isValidEmail(nextEmail)) {
      return res.status(400).json({ message: 'Please provide a valid email address.' });
    }

    if (nextAvatarUrl.length > MAX_AVATAR_LENGTH) {
      return res.status(400).json({ message: 'Profile image is too large. Please choose a smaller image.' });
    }
    if (!isValidPhone(nextPhoneNumber)) {
      return res.status(400).json({ message: 'Please provide a valid phone number.' });
    }

    if (nextEmail !== user.email) {
      const existing = await User.findOne({ email: nextEmail, _id: { $ne: user._id } });
      if (existing) {
        return res.status(409).json({ message: 'Email is already registered.' });
      }
    }

    user.name = nextName;
    user.email = nextEmail;
    if (isConfiguredAdminEmail(nextEmail) && user.role !== 'admin') {
      user.role = 'admin';
    }
    user.campus = nextCampus;
    user.avatarUrl = nextAvatarUrl;
    user.phoneNumber = nextPhoneNumber;
    await user.save();

    return res.json({ user: serializeUser(user) });
  } catch (error) {
    return next(error);
  }
};

const updatePassword = async (req, res, next) => {
  try {
    const currentPassword = req.body.currentPassword || '';
    const newPassword = req.body.newPassword || '';

    if (!currentPassword || !newPassword) {
      return res.status(400).json({ message: 'currentPassword and newPassword are required.' });
    }

    if (newPassword.length < 6) {
      return res.status(400).json({ message: 'New password must be at least 6 characters.' });
    }

    const user = await User.findById(req.user._id);
    if (!user) {
      return res.status(404).json({ message: 'User not found.' });
    }

    const matches = await bcrypt.compare(currentPassword, user.passwordHash);
    if (!matches) {
      return res.status(401).json({ message: 'Current password is incorrect.' });
    }

    user.passwordHash = await bcrypt.hash(newPassword, 10);
    await user.save();

    return res.json({ message: 'Password updated successfully.' });
  } catch (error) {
    return next(error);
  }
};

const listUsersAdmin = async (req, res, next) => {
  try {
    const page = Math.max(Number(req.query.page) || 1, 1);
    const limit = Math.min(Math.max(Number(req.query.limit) || 50, 1), 200);
    const keyword = trimString(req.query.keyword);
    const filter = {};

    if (keyword) {
      const regex = new RegExp(keyword.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i');
      filter.$or = [{ name: regex }, { email: regex }, { campus: regex }, { phoneNumber: regex }];
    }

    const [users, total] = await Promise.all([
      User.find(filter).select('-passwordHash').sort({ createdAt: -1 }).skip((page - 1) * limit).limit(limit),
      User.countDocuments(filter),
    ]);

    return res.json({
      users: users.map(serializeUser),
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

const setUserSuspension = async (req, res, next) => {
  try {
    const { id } = req.params;
    const suspend = Boolean(req.body.suspend);
    const reason = trimString(req.body.reason);

    const user = await User.findById(id);
    if (!user) {
      return res.status(404).json({ message: 'User not found.' });
    }

    if (user._id.toString() === req.user._id.toString()) {
      return res.status(400).json({ message: 'You cannot suspend your own account.' });
    }

    if (user.role === 'admin' && suspend) {
      return res.status(400).json({ message: 'Suspending another admin is not allowed.' });
    }

    user.isSuspended = suspend;
    user.suspendedAt = suspend ? new Date() : null;
    user.suspensionReason = suspend ? reason || 'Policy violation' : '';
    await user.save();

    return res.json({ user: serializeUser(user) });
  } catch (error) {
    return next(error);
  }
};

const setUserRole = async (req, res, next) => {
  try {
    const { id } = req.params;
    const nextRole = trimString(req.body.role).toLowerCase();

    if (!['user', 'admin'].includes(nextRole)) {
      return res.status(400).json({ message: 'Role must be either user or admin.' });
    }

    const target = await User.findById(id);
    if (!target) {
      return res.status(404).json({ message: 'User not found.' });
    }

    if (target._id.toString() === req.user._id.toString()) {
      return res.status(400).json({ message: 'You cannot change your own role.' });
    }

    if (target.role === 'admin' && nextRole === 'user') {
      const adminCount = await User.countDocuments({ role: 'admin' });
      if (adminCount <= 1) {
        return res.status(400).json({ message: 'At least one admin account is required.' });
      }
    }

    target.role = nextRole;
    await target.save();

    return res.json({ user: serializeUser(target) });
  } catch (error) {
    return next(error);
  }
};

module.exports = {
  register,
  login,
  me,
  updateProfile,
  updatePassword,
  listUsersAdmin,
  setUserSuspension,
  setUserRole,
};
