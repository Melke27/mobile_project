import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import AppIcon from '../components/AppIcon';
import { DEFAULT_CAMPUS } from '../config/env';
import { useAuth } from '../context/AuthContext';
import { useItems } from '../context/ItemsContext';
import { storageService } from '../services/storageService';
import { isValidEmail } from '../utils/validators';

const C = {
  blue: '#1a6edb',
  white: '#ffffff',
  bg: '#f5f7fb',
  card: '#ffffff',
  border: '#e5e7eb',
  inputBorder: '#d1d5db',
  text: '#111827',
  textMuted: '#6b7280',
  danger: '#b42318',
};

const ActionButton = ({ label, icon, onPress, tone = 'neutral', loading, disabled }) => {
  const toneStyles =
    tone === 'primary'
      ? { button: styles.primaryBtn, text: styles.primaryBtnText, icon: C.white }
      : tone === 'danger'
        ? { button: styles.dangerBtn, text: styles.dangerBtnText, icon: C.white }
        : { button: styles.neutralBtn, text: styles.neutralBtnText, icon: C.text };

  return (
    <Pressable
      onPress={onPress}
      disabled={disabled || loading}
      style={({ pressed }) => [
        styles.actionBtn,
        toneStyles.button,
        (disabled || loading) && styles.btnDisabled,
        pressed && !disabled && !loading && styles.btnPressed,
      ]}
    >
      {loading ? (
        <ActivityIndicator size="small" color={toneStyles.icon} />
      ) : (
        <View style={styles.actionInner}>
          {icon ? <AppIcon name={icon} size={15} color={toneStyles.icon} /> : null}
          <Text style={[styles.actionText, toneStyles.text]}>{label}</Text>
        </View>
      )}
    </Pressable>
  );
};

const normalizeStatus = (status = '') => (String(status).toLowerCase() === 'returned' ? 'recovered' : String(status).toLowerCase());

const AccountScreen = ({ navigation }) => {
  const { user, updateProfile, updatePassword, logout } = useAuth();
  const { items, loadLatest, deleteReport } = useItems();

  const [profileForm, setProfileForm] = useState({ name: '', email: '' });
  const [passwordForm, setPasswordForm] = useState({
    currentPassword: '',
    newPassword: '',
    confirmNewPassword: '',
  });
  const [actionLoading, setActionLoading] = useState('');
  const [reportsRefreshing, setReportsRefreshing] = useState(false);
  const [reportDeletingId, setReportDeletingId] = useState('');

  useEffect(() => {
    setProfileForm({
      name: user?.name || '',
      email: user?.email || '',
    });
  }, [user]);

  const refreshMyReports = useCallback(async () => {
    setReportsRefreshing(true);
    try {
      await loadLatest({ onlyMine: true, limit: 100 });
    } catch (_error) {
      // Keep screen usable even if refresh fails.
    } finally {
      setReportsRefreshing(false);
    }
  }, [loadLatest]);

  useFocusEffect(
    useCallback(() => {
      refreshMyReports();
    }, [refreshMyReports])
  );

  const memberSince = useMemo(() => {
    if (!user?.createdAt) return 'Unknown';
    const date = new Date(user.createdAt);
    return Number.isNaN(date.getTime()) ? 'Unknown' : date.toLocaleDateString();
  }, [user?.createdAt]);

  const myReports = useMemo(() => {
    const safeItems = Array.isArray(items) ? items : [];
    return safeItems.filter((entry) => {
      const reporterId = typeof entry?.reportedBy === 'string' ? entry.reportedBy : entry?.reportedBy?._id;
      return Boolean(user?._id) && reporterId === user._id;
    });
  }, [items, user?._id]);

  const onSaveProfile = async () => {
    const payload = {
      name: profileForm.name.trim(),
      email: profileForm.email.trim(),
      campus: (user?.campus || DEFAULT_CAMPUS).trim(),
      avatarUrl: user?.avatarUrl || '',
      phoneNumber: user?.phoneNumber || '',
    };

    if (!payload.name) {
      Alert.alert('Validation', 'Please enter your name.');
      return;
    }
    if (!isValidEmail(payload.email)) {
      Alert.alert('Validation', 'Please enter a valid email.');
      return;
    }

    setActionLoading('saveProfile');
    try {
      await updateProfile(payload);
      Alert.alert('Success', 'Profile updated successfully.');
    } finally {
      setActionLoading('');
    }
  };

  const onChangePassword = async () => {
    if (!passwordForm.currentPassword || !passwordForm.newPassword || !passwordForm.confirmNewPassword) {
      Alert.alert('Validation', 'Please fill all password fields.');
      return;
    }
    if (passwordForm.newPassword.length < 6) {
      Alert.alert('Validation', 'New password must be at least 6 characters.');
      return;
    }
    if (passwordForm.newPassword !== passwordForm.confirmNewPassword) {
      Alert.alert('Validation', 'New password and confirm password do not match.');
      return;
    }

    setActionLoading('changePassword');
    try {
      await updatePassword({
        currentPassword: passwordForm.currentPassword,
        newPassword: passwordForm.newPassword,
      });
      setPasswordForm({ currentPassword: '', newPassword: '', confirmNewPassword: '' });
      Alert.alert('Success', 'Password updated successfully.');
    } finally {
      setActionLoading('');
    }
  };

  const onClearDraftAndCache = () => {
    Alert.alert('Clear Draft + Cache', 'Clear local report draft and cached feed data?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Clear',
        style: 'destructive',
        onPress: async () => {
          setActionLoading('clearCache');
          try {
            await Promise.all([
              storageService.remove(storageService.keys.LAST_REPORT_DRAFT),
              storageService.remove(storageService.keys.CACHED_REPORTS),
            ]);
            Alert.alert('Done', 'Draft and cache cleared.');
          } finally {
            setActionLoading('');
          }
        },
      },
    ]);
  };

  const onDeleteReport = (reportId) => {
    Alert.alert('Delete Report', 'Are you sure you want to delete this report?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          setReportDeletingId(reportId);
          try {
            await deleteReport(reportId);
            await refreshMyReports();
          } catch (error) {
            Alert.alert('Error', error?.response?.data?.message || 'Could not delete report.');
          } finally {
            setReportDeletingId('');
          }
        },
      },
    ]);
  };

  const onLogout = () => {
    Alert.alert('Sign Out', 'Are you sure you want to sign out?', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Sign Out', style: 'destructive', onPress: () => logout() },
    ]);
  };

  return (
    <SafeAreaView style={styles.root}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={styles.root}>
        <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
          <View style={styles.headerCard}>
            <Text style={styles.headerTitle}>My Dashboard</Text>
            <Text style={styles.headerSub}>Simple account settings</Text>
            <View style={styles.infoRow}>
              <Text style={styles.infoLabel}>Role</Text>
              <Text style={styles.infoValue}>{user?.role === 'admin' ? 'Admin' : 'User'}</Text>
            </View>
            <View style={styles.infoRow}>
              <Text style={styles.infoLabel}>My Reports</Text>
              <Text style={styles.infoValue}>{myReports.length}</Text>
            </View>
            <View style={styles.infoRow}>
              <Text style={styles.infoLabel}>Member Since</Text>
              <Text style={styles.infoValue}>{memberSince}</Text>
            </View>
          </View>

          <View style={styles.card}>
            <View style={styles.sectionHead}>
              <Text style={styles.sectionTitle}>My Reports</Text>
              <Pressable style={styles.refreshMiniBtn} onPress={refreshMyReports}>
                <AppIcon name="refresh" size={14} color={C.blue} />
                <Text style={styles.refreshMiniText}>Refresh</Text>
              </Pressable>
            </View>

            {reportsRefreshing ? (
              <ActivityIndicator color={C.blue} />
            ) : myReports.length === 0 ? (
              <Text style={styles.emptyText}>You have not posted any reports yet.</Text>
            ) : (
              myReports.map((report) => (
                <View key={report?._id} style={styles.reportCard}>
                  <Text style={styles.reportTitle} numberOfLines={1}>{report?.title || 'Untitled report'}</Text>
                  <Text style={styles.reportMeta}>
                    {normalizeStatus(report?.status).toUpperCase()} • {report?.createdAt ? new Date(report.createdAt).toLocaleDateString() : 'Unknown date'}
                  </Text>

                  <View style={styles.reportActionsRow}>
                    <Pressable
                      style={styles.reportEditBtn}
                      onPress={() => navigation.navigate('Post', { mode: 'edit', item: report })}
                    >
                      <Text style={styles.reportEditText}>Edit</Text>
                    </Pressable>
                    <Pressable
                      style={[styles.reportDeleteBtn, reportDeletingId === report?._id && styles.btnDisabled]}
                      onPress={() => onDeleteReport(report?._id)}
                      disabled={reportDeletingId === report?._id}
                    >
                      {reportDeletingId === report?._id ? (
                        <ActivityIndicator size="small" color="#fff" />
                      ) : (
                        <Text style={styles.reportDeleteText}>Delete</Text>
                      )}
                    </Pressable>
                  </View>
                </View>
              ))
            )}
          </View>

          <View style={styles.card}>
            <Text style={styles.sectionTitle}>Profile Info</Text>
            <TextInput
              style={styles.input}
              placeholder="Full name"
              placeholderTextColor={C.textMuted}
              value={profileForm.name}
              onChangeText={(name) => setProfileForm((prev) => ({ ...prev, name }))}
            />
            <TextInput
              style={styles.input}
              placeholder="Email"
              keyboardType="email-address"
              autoCapitalize="none"
              autoCorrect={false}
              placeholderTextColor={C.textMuted}
              value={profileForm.email}
              onChangeText={(email) => setProfileForm((prev) => ({ ...prev, email }))}
            />
            <ActionButton
              label="Save Profile"
              icon="content-save-outline"
              tone="primary"
              onPress={onSaveProfile}
              loading={actionLoading === 'saveProfile'}
              disabled={Boolean(actionLoading) && actionLoading !== 'saveProfile'}
            />
          </View>

          <View style={styles.card}>
            <Text style={styles.sectionTitle}>Change Password</Text>
            <TextInput
              style={styles.input}
              placeholder="Current password"
              secureTextEntry
              placeholderTextColor={C.textMuted}
              value={passwordForm.currentPassword}
              onChangeText={(currentPassword) => setPasswordForm((prev) => ({ ...prev, currentPassword }))}
            />
            <TextInput
              style={styles.input}
              placeholder="New password"
              secureTextEntry
              placeholderTextColor={C.textMuted}
              value={passwordForm.newPassword}
              onChangeText={(newPassword) => setPasswordForm((prev) => ({ ...prev, newPassword }))}
            />
            <TextInput
              style={styles.input}
              placeholder="Confirm new password"
              secureTextEntry
              placeholderTextColor={C.textMuted}
              value={passwordForm.confirmNewPassword}
              onChangeText={(confirmNewPassword) => setPasswordForm((prev) => ({ ...prev, confirmNewPassword }))}
            />
            <ActionButton
              label="Update Password"
              icon="lock-reset"
              tone="neutral"
              onPress={onChangePassword}
              loading={actionLoading === 'changePassword'}
              disabled={Boolean(actionLoading) && actionLoading !== 'changePassword'}
            />
          </View>

          <View style={styles.card}>
            <Text style={styles.sectionTitle}>Phone Storage</Text>
            <ActionButton
              label="Clear Draft + Cache"
              icon="broom"
              tone="neutral"
              onPress={onClearDraftAndCache}
              loading={actionLoading === 'clearCache'}
              disabled={Boolean(actionLoading) && actionLoading !== 'clearCache'}
            />
          </View>

          <View style={styles.card}>
            <Text style={styles.sectionTitle}>Session</Text>
            <ActionButton label="Sign Out" icon="logout" tone="danger" onPress={onLogout} disabled={Boolean(actionLoading)} />
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: C.bg },
  content: { padding: 14, paddingBottom: 30, gap: 12 },

  headerCard: {
    backgroundColor: '#ffffff',
    borderWidth: 1,
    borderColor: C.border,
    borderRadius: 16,
    padding: 14,
  },
  headerTitle: { color: C.text, fontWeight: '800', fontSize: 24 },
  headerSub: { color: C.textMuted, marginTop: 4, marginBottom: 10 },
  infoRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 6 },
  infoLabel: { color: C.textMuted, fontWeight: '600' },
  infoValue: { color: C.text, fontWeight: '700' },

  card: {
    backgroundColor: C.card,
    borderWidth: 1,
    borderColor: C.border,
    borderRadius: 16,
    padding: 14,
    gap: 10,
  },
  sectionHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  sectionTitle: { fontSize: 16, fontWeight: '800', color: C.text },
  refreshMiniBtn: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  refreshMiniText: { color: C.blue, fontWeight: '700', fontSize: 12 },

  emptyText: { color: C.textMuted, fontSize: 13 },
  reportCard: {
    borderWidth: 1,
    borderColor: C.border,
    borderRadius: 12,
    padding: 10,
    backgroundColor: '#fff',
  },
  reportTitle: { fontSize: 14, fontWeight: '700', color: C.text },
  reportMeta: { marginTop: 2, color: C.textMuted, fontSize: 12 },
  reportActionsRow: { flexDirection: 'row', gap: 8, marginTop: 10 },
  reportEditBtn: {
    flex: 1,
    minHeight: 38,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#bfdbfe',
    backgroundColor: '#eff6ff',
    alignItems: 'center',
    justifyContent: 'center',
  },
  reportEditText: { color: C.blue, fontWeight: '700' },
  reportDeleteBtn: {
    flex: 1,
    minHeight: 38,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: C.danger,
    backgroundColor: C.danger,
    alignItems: 'center',
    justifyContent: 'center',
  },
  reportDeleteText: { color: '#fff', fontWeight: '700' },

  input: {
    borderWidth: 1,
    borderColor: C.inputBorder,
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: Platform.OS === 'ios' ? 12 : 10,
    color: C.text,
    fontSize: 15,
    backgroundColor: '#fff',
  },

  actionBtn: {
    borderRadius: 12,
    minHeight: 44,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
  },
  actionInner: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  actionText: { fontWeight: '700', fontSize: 14 },
  primaryBtn: { backgroundColor: C.blue, borderColor: C.blue },
  primaryBtnText: { color: C.white },
  neutralBtn: { backgroundColor: '#eef4fb', borderColor: '#d7e5f6' },
  neutralBtnText: { color: '#18416c' },
  dangerBtn: { backgroundColor: C.danger, borderColor: C.danger },
  dangerBtnText: { color: C.white },
  btnDisabled: { opacity: 0.55 },
  btnPressed: { opacity: 0.86 },
});

export default AccountScreen;
