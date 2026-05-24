import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Pressable,
  RefreshControl,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import AppIcon from '../components/AppIcon';
import EmptyState from '../components/EmptyState';
import { useAuth } from '../context/AuthContext';
import { useItems } from '../context/ItemsContext';
import { authService } from '../services/authService';

const C = {
  blue: '#1a6edb',
  bg: '#f5f7fb',
  card: '#ffffff',
  border: '#e5e7eb',
  text: '#111827',
  muted: '#6b7280',
  green: '#15803d',
  red: '#b42318',
  orange: '#9a3412',
};

const TABS = [
  { key: 'posts', label: 'All Posts' },
  { key: 'approvals', label: 'Approvals' },
  { key: 'claims', label: 'Claims' },
  { key: 'users', label: 'Users' },
  { key: 'analytics', label: 'Analytics' },
];

const normalizeStatus = (status = '') => (String(status).toLowerCase() === 'returned' ? 'recovered' : String(status).toLowerCase());
const fmt = (value) => {
  if (!value) return 'Unknown';
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? 'Unknown' : date.toLocaleString();
};

const statusStyle = (status) => {
  const key = normalizeStatus(status);
  if (key === 'lost') return { bg: '#fff0f0', text: '#cc2222' };
  if (key === 'found') return { bg: '#e8f5e9', text: '#1b5e20' };
  if (key === 'recovered') return { bg: '#eff6ff', text: '#1a6edb' };
  return { bg: '#f3f4f6', text: C.muted };
};

const approvalStyle = (status) => {
  const key = String(status || '').toLowerCase();
  if (key === 'approved') return { bg: '#ecfdf3', text: '#15803d' };
  if (key === 'rejected') return { bg: '#ffe4e6', text: '#be123c' };
  return { bg: '#fff7ed', text: '#9a3412' };
};

const MiniButton = ({ label, onPress, tone = 'neutral', disabled, busy }) => {
  const palette =
    tone === 'danger'
      ? { bg: '#b42318', border: '#b42318', text: '#fff' }
      : tone === 'success'
        ? { bg: '#ecfdf3', border: '#bbf7d0', text: '#15803d' }
        : tone === 'warning'
          ? { bg: '#fff7ed', border: '#fed7aa', text: '#9a3412' }
          : { bg: '#eff6ff', border: '#bfdbfe', text: '#1a6edb' };

  return (
    <Pressable
      onPress={onPress}
      disabled={disabled || busy}
      style={({ pressed }) => [
        styles.miniBtn,
        { backgroundColor: palette.bg, borderColor: palette.border },
        (disabled || busy) && styles.disabled,
        pressed && !disabled && !busy && styles.pressed,
      ]}
    >
      {busy ? <ActivityIndicator size="small" color={palette.text} /> : <Text style={[styles.miniBtnText, { color: palette.text }]}>{label}</Text>}
    </Pressable>
  );
};

const AdminDashboardScreen = () => {
  const { isAdmin, logout } = useAuth();
  const {
    items,
    loadLatest,
    deleteReport,
    reviewItemApproval,
    reviewClaim,
    getPendingApprovalReports,
    getPendingClaimReports,
    getAdminStats,
  } = useItems();

  const [activeTab, setActiveTab] = useState('posts');
  const [users, setUsers] = useState([]);
  const [pendingApprovals, setPendingApprovals] = useState([]);
  const [pendingClaims, setPendingClaims] = useState([]);
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(false);
  const [workingKey, setWorkingKey] = useState('');

  const loadDashboard = useCallback(async () => {
    setLoading(true);
    try {
      const [
        _allPosts,
        approvalsResp,
        claimsResp,
        usersResp,
        statsResp,
      ] = await Promise.all([
        loadLatest({ limit: 200 }),
        getPendingApprovalReports({ limit: 200 }),
        getPendingClaimReports({ limit: 200 }),
        authService.getAdminUsers({ limit: 200 }),
        getAdminStats(),
      ]);

      setPendingApprovals(Array.isArray(approvalsResp?.items) ? approvalsResp.items : []);
      setPendingClaims(Array.isArray(claimsResp?.items) ? claimsResp.items : []);
      setUsers(Array.isArray(usersResp?.users) ? usersResp.users : []);
      setStats(statsResp?.stats || null);
    } catch (error) {
      Alert.alert('Error', error?.response?.data?.message || 'Could not load admin dashboard.');
    } finally {
      setLoading(false);
    }
  }, [getAdminStats, getPendingApprovalReports, getPendingClaimReports, loadLatest]);

  useEffect(() => {
    loadDashboard();
  }, [loadDashboard]);

  const allPosts = useMemo(() => (Array.isArray(items) ? items : []), [items]);

  const refreshAfterAction = async () => {
    await loadDashboard();
  };

  const confirmDeletePost = (post) => {
    Alert.alert('Delete Post', `Delete "${post?.title || 'this post'}"?`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          const key = `delete-${post?._id}`;
          setWorkingKey(key);
          try {
            await deleteReport(post?._id);
            await refreshAfterAction();
          } catch (error) {
            Alert.alert('Error', error?.response?.data?.message || 'Could not delete post.');
          } finally {
            setWorkingKey('');
          }
        },
      },
    ]);
  };

  const confirmApproval = (item, action) => {
    Alert.alert(
      action === 'approve' ? 'Approve Post' : 'Reject Post',
      `Are you sure you want to ${action} this post?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Confirm',
          onPress: async () => {
            const key = `approval-${item?._id}-${action}`;
            setWorkingKey(key);
            try {
              await reviewItemApproval(item?._id, action, action === 'approve' ? 'Approved by admin.' : 'Rejected by admin.');
              await refreshAfterAction();
            } catch (error) {
              Alert.alert('Error', error?.response?.data?.message || 'Could not update approval.');
            } finally {
              setWorkingKey('');
            }
          },
        },
      ]
    );
  };

  const confirmClaimReview = (item, action) => {
    Alert.alert(
      action === 'approve' ? 'Approve Claim' : 'Decline Claim',
      `Are you sure you want to ${action} this claim?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Confirm',
          onPress: async () => {
            const key = `claim-${item?._id}-${action}`;
            setWorkingKey(key);
            try {
              await reviewClaim(item?._id, { action, note: action === 'approve' ? 'Approved by admin.' : 'Declined by admin.' });
              await refreshAfterAction();
            } catch (error) {
              Alert.alert('Error', error?.response?.data?.message || 'Could not review claim.');
            } finally {
              setWorkingKey('');
            }
          },
        },
      ]
    );
  };

  const confirmSuspensionToggle = (targetUser) => {
    const willSuspend = !targetUser?.isSuspended;
    Alert.alert(
      willSuspend ? 'Suspend User' : 'Unsuspend User',
      willSuspend ? 'This user will not be able to access the app.' : 'This user will regain app access.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Confirm',
          onPress: async () => {
            const key = `user-${targetUser?._id}-${willSuspend ? 'suspend' : 'unsuspend'}`;
            setWorkingKey(key);
            try {
              await authService.setUserSuspension(targetUser?._id, willSuspend, willSuspend ? 'Suspended by admin.' : '');
              await refreshAfterAction();
            } catch (error) {
              Alert.alert('Error', error?.response?.data?.message || 'Could not update user status.');
            } finally {
              setWorkingKey('');
            }
          },
        },
      ]
    );
  };

  if (!isAdmin) {
    return (
      <SafeAreaView style={styles.root}>
        <EmptyState iconName="shield-lock-outline" title="Restricted" message="Admin access only." />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.root}>
      <View style={styles.header}>
        <View>
          <Text style={styles.title}>Admin Panel</Text>
          <Text style={styles.subtitle}>Posts, users, claims and analytics</Text>
        </View>
        <View style={styles.headerActions}>
          <Pressable style={styles.iconBtn} onPress={loadDashboard}>
            <AppIcon name="refresh" size={18} color="#fff" />
          </Pressable>
          <Pressable style={[styles.iconBtn, styles.logoutBtn]} onPress={logout}>
            <AppIcon name="logout" size={18} color="#fff" />
          </Pressable>
        </View>
      </View>

      <View style={styles.tabRow}>
        {TABS.map((tab) => {
          const active = activeTab === tab.key;
          return (
            <Pressable key={tab.key} style={[styles.tabBtn, active && styles.tabBtnActive]} onPress={() => setActiveTab(tab.key)}>
              <Text style={[styles.tabText, active && styles.tabTextActive]}>{tab.label}</Text>
            </Pressable>
          );
        })}
      </View>

      <ScrollView
        contentContainerStyle={styles.content}
        refreshControl={<RefreshControl refreshing={loading} onRefresh={loadDashboard} tintColor={C.blue} />}
      >
        {activeTab === 'posts' && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>All Posts ({allPosts.length})</Text>
            {allPosts.length === 0 ? (
              <EmptyState iconName="clipboard-text-outline" title="No Posts" message="No posts found." />
            ) : (
              allPosts.map((post) => {
                const sc = statusStyle(post?.status);
                const ac = approvalStyle(post?.approvalStatus);
                const deleteKey = `delete-${post?._id}`;
                return (
                  <View key={post?._id} style={styles.card}>
                    <View style={styles.cardTop}>
                      <Text style={styles.cardTitle} numberOfLines={1}>{post?.title || 'Untitled Post'}</Text>
                      <View style={styles.badgesRow}>
                        <View style={[styles.badge, { backgroundColor: sc.bg }]}>
                          <Text style={[styles.badgeText, { color: sc.text }]}>{normalizeStatus(post?.status).toUpperCase()}</Text>
                        </View>
                        <View style={[styles.badge, { backgroundColor: ac.bg }]}>
                          <Text style={[styles.badgeText, { color: ac.text }]}>{String(post?.approvalStatus || 'pending').toUpperCase()}</Text>
                        </View>
                      </View>
                    </View>
                    <Text style={styles.meta}>By: {post?.reportedBy?.name || 'Unknown'} • {fmt(post?.createdAt)}</Text>
                    <View style={styles.actionsRow}>
                      <MiniButton
                        label="Delete"
                        tone="danger"
                        onPress={() => confirmDeletePost(post)}
                        busy={workingKey === deleteKey}
                      />
                    </View>
                  </View>
                );
              })
            )}
          </View>
        )}

        {activeTab === 'approvals' && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Pending Post Approvals ({pendingApprovals.length})</Text>
            {pendingApprovals.length === 0 ? (
              <EmptyState iconName="check-circle-outline" title="No Pending Approvals" message="All posts are reviewed." />
            ) : (
              pendingApprovals.map((post) => {
                const approveKey = `approval-${post?._id}-approve`;
                const rejectKey = `approval-${post?._id}-reject`;
                return (
                  <View key={post?._id} style={styles.card}>
                    <Text style={styles.cardTitle}>{post?.title || 'Untitled Post'}</Text>
                    <Text style={styles.meta}>By: {post?.reportedBy?.name || 'Unknown'} • {fmt(post?.createdAt)}</Text>
                    <View style={styles.actionsRow}>
                      <MiniButton
                        label="Approve"
                        tone="success"
                        onPress={() => confirmApproval(post, 'approve')}
                        busy={workingKey === approveKey}
                        disabled={workingKey === rejectKey}
                      />
                      <MiniButton
                        label="Reject"
                        tone="warning"
                        onPress={() => confirmApproval(post, 'reject')}
                        busy={workingKey === rejectKey}
                        disabled={workingKey === approveKey}
                      />
                    </View>
                  </View>
                );
              })
            )}
          </View>
        )}

        {activeTab === 'claims' && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Disputed / Pending Claims ({pendingClaims.length})</Text>
            {pendingClaims.length === 0 ? (
              <EmptyState iconName="shield-check-outline" title="No Pending Claims" message="No claim disputes to resolve." />
            ) : (
              pendingClaims.map((entry) => {
                const approveKey = `claim-${entry?._id}-approve`;
                const declineKey = `claim-${entry?._id}-decline`;
                return (
                  <View key={entry?._id} style={styles.card}>
                    <Text style={styles.cardTitle}>{entry?.title || 'Untitled Post'}</Text>
                    <Text style={styles.meta}>Finder: {entry?.reportedBy?.name || 'Unknown'}</Text>
                    <Text style={styles.meta}>Requester: {entry?.claim?.requester?.name || 'Unknown'}</Text>
                    <Text style={styles.meta}>Claim Note: {entry?.claim?.note || 'No note'}</Text>
                    <View style={styles.actionsRow}>
                      <MiniButton
                        label="Approve Claim"
                        tone="success"
                        onPress={() => confirmClaimReview(entry, 'approve')}
                        busy={workingKey === approveKey}
                        disabled={workingKey === declineKey}
                      />
                      <MiniButton
                        label="Decline Claim"
                        tone="warning"
                        onPress={() => confirmClaimReview(entry, 'decline')}
                        busy={workingKey === declineKey}
                        disabled={workingKey === approveKey}
                      />
                    </View>
                  </View>
                );
              })
            )}
          </View>
        )}

        {activeTab === 'users' && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>All Users ({users.length})</Text>
            {users.length === 0 ? (
              <EmptyState iconName="account-group-outline" title="No Users" message="No users found." />
            ) : (
              users.map((entry) => {
                const key = `user-${entry?._id}-${entry?.isSuspended ? 'unsuspend' : 'suspend'}`;
                return (
                  <View key={entry?._id} style={styles.card}>
                    <Text style={styles.cardTitle}>{entry?.name || 'Unknown User'}</Text>
                    <Text style={styles.meta}>{entry?.email || 'No email'}</Text>
                    <Text style={styles.meta}>Role: {entry?.role || 'user'}</Text>
                    <Text style={styles.meta}>Status: {entry?.isSuspended ? 'SUSPENDED' : 'ACTIVE'}</Text>
                    <View style={styles.actionsRow}>
                      <MiniButton
                        label={entry?.isSuspended ? 'Unsuspend' : 'Suspend'}
                        tone={entry?.isSuspended ? 'success' : 'danger'}
                        onPress={() => confirmSuspensionToggle(entry)}
                        busy={workingKey === key}
                      />
                    </View>
                  </View>
                );
              })
            )}
          </View>
        )}

        {activeTab === 'analytics' && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Analytics</Text>
            {!stats ? (
              <ActivityIndicator size="small" color={C.blue} />
            ) : (
              <>
                <View style={styles.statsGrid}>
                  <View style={styles.statCard}>
                    <Text style={styles.statValue}>{stats?.totalReports || 0}</Text>
                    <Text style={styles.statLabel}>Total Posts</Text>
                  </View>
                  <View style={styles.statCard}>
                    <Text style={styles.statValue}>{stats?.recoveredReports || 0}</Text>
                    <Text style={styles.statLabel}>Recovered Items</Text>
                  </View>
                  <View style={styles.statCard}>
                    <Text style={styles.statValue}>{stats?.pendingApprovals || 0}</Text>
                    <Text style={styles.statLabel}>Pending Approvals</Text>
                  </View>
                  <View style={styles.statCard}>
                    <Text style={styles.statValue}>{stats?.pendingClaims || 0}</Text>
                    <Text style={styles.statLabel}>Pending Claims</Text>
                  </View>
                </View>

                <View style={styles.card}>
                  <Text style={styles.cardTitle}>Most Lost Category</Text>
                  <Text style={styles.meta}>{stats?.mostLostCategory || 'N/A'} ({stats?.mostLostCategoryCount || 0})</Text>
                </View>
              </>
            )}
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: C.bg },
  header: {
    paddingHorizontal: 14,
    paddingVertical: 12,
    backgroundColor: C.blue,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  title: { color: '#fff', fontSize: 22, fontWeight: '800' },
  subtitle: { color: 'rgba(255,255,255,0.88)', marginTop: 2, fontSize: 12 },
  headerActions: { flexDirection: 'row', gap: 8 },
  iconBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.22)',
  },
  logoutBtn: { backgroundColor: 'rgba(180,35,24,0.45)' },

  tabRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: C.border,
  },
  tabBtn: {
    borderWidth: 1,
    borderColor: '#c7d2fe',
    backgroundColor: '#eef2ff',
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 7,
  },
  tabBtnActive: { backgroundColor: C.blue, borderColor: C.blue },
  tabText: { color: '#1e3a8a', fontWeight: '700', fontSize: 12 },
  tabTextActive: { color: '#fff' },

  content: { padding: 12, paddingBottom: 24 },
  section: { gap: 10 },
  sectionTitle: { fontSize: 18, fontWeight: '800', color: C.text },

  card: {
    backgroundColor: C.card,
    borderWidth: 1,
    borderColor: C.border,
    borderRadius: 14,
    padding: 12,
  },
  cardTop: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    marginBottom: 6,
    gap: 8,
  },
  cardTitle: { flex: 1, color: C.text, fontSize: 15, fontWeight: '700' },
  meta: { color: C.muted, fontSize: 12, marginTop: 2 },

  badgesRow: { flexDirection: 'row', gap: 6, alignItems: 'center', flexWrap: 'wrap' },
  badge: { borderRadius: 999, paddingHorizontal: 8, paddingVertical: 3 },
  badgeText: { fontSize: 10, fontWeight: '800' },

  actionsRow: { flexDirection: 'row', gap: 8, marginTop: 10 },
  miniBtn: {
    minHeight: 36,
    minWidth: 100,
    borderRadius: 10,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 10,
  },
  miniBtnText: { fontWeight: '700', fontSize: 12 },

  statsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  statCard: {
    width: '48.8%',
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: C.border,
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
  },
  statValue: { fontSize: 22, fontWeight: '800', color: C.blue },
  statLabel: { marginTop: 2, fontSize: 12, fontWeight: '600', color: C.muted },

  disabled: { opacity: 0.55 },
  pressed: { opacity: 0.85 },
});

export default AdminDashboardScreen;
