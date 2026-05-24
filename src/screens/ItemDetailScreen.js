import React, { useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Image,
  Pressable,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import AppIcon from '../components/AppIcon';
import { useAuth } from '../context/AuthContext';
import { useItems } from '../context/ItemsContext';
import { itemService } from '../services/itemService';
import { generateItemImageUrl, resolveItemImageUrl } from '../utils/imageFallback';

const C = {
  blue: '#1a6edb',
  bg: '#f5f7fb',
  card: '#ffffff',
  border: '#e5e7eb',
  text: '#111827',
  muted: '#6b7280',
  red: '#b42318',
};

const normalizeStatus = (status = '') => (status === 'returned' ? 'recovered' : status);

const statusStyle = (status) => {
  const key = normalizeStatus(String(status || '').toLowerCase());
  if (key === 'lost') return { label: 'LOST', bg: '#fff0f0', text: '#cc2222' };
  if (key === 'found') return { label: 'FOUND', bg: '#e8f5e9', text: '#1b5e20' };
  if (key === 'recovered') return { label: 'RETURNED', bg: '#eff6ff', text: '#1a6edb' };
  return { label: 'UNKNOWN', bg: '#f3f4f6', text: C.muted };
};

const toDisplayTime = (val) => {
  if (!val) return 'Unknown';
  const d = new Date(val);
  return Number.isNaN(d.getTime()) ? 'Unknown' : d.toLocaleString();
};

const ItemDetailScreen = ({ route, navigation }) => {
  const initial = route.params?.item || {};
  const { user } = useAuth();
  const {
    markRecovered,
    deleteReport,
    requestClaim,
    reviewClaim,
    getClaimContact,
  } = useItems();

  const [item, setItem] = useState(initial);
  const [loading, setLoading] = useState(!initial?.title);
  const [busy, setBusy] = useState('');
  const [imgFailed, setImgFailed] = useState(false);

  const [showClaimForm, setShowClaimForm] = useState(false);
  const [claimAnswers, setClaimAnswers] = useState([]);
  const [claimNote, setClaimNote] = useState('');
  const [claimContact, setClaimContact] = useState(null);

  useEffect(() => {
    setImgFailed(false);
  }, [item?._id]);

  useEffect(() => {
    if (initial?.title || !initial?._id) {
      return;
    }

    setLoading(true);
    itemService
      .getById(initial._id)
      .then((d) => setItem(d.item || initial))
      .catch((e) => Alert.alert('Error', e?.response?.data?.message || 'Could not load item details.'))
      .finally(() => setLoading(false));
  }, [initial]);

  useEffect(() => {
    const count = Array.isArray(item?.secretQuestions) ? item.secretQuestions.length : 0;
    setClaimAnswers(Array.from({ length: count }, () => ''));
    setClaimNote('');
    setClaimContact(null);
    setShowClaimForm(false);
  }, [item?._id, item?.secretQuestions]);

  const reloadItem = async () => {
    if (!item?._id) return;
    const data = await itemService.getById(item._id);
    setItem(data?.item || item);
  };

  const reporterId = typeof item?.reportedBy === 'string' ? item.reportedBy : item?.reportedBy?._id;
  const isGuest = !user?._id;
  const isOwner = Boolean(user?._id) && reporterId === user?._id;
  const canManage = Boolean(user?._id) && (isOwner || user?.role === 'admin');
  const canChat = Boolean(user?._id && reporterId && reporterId !== user?._id);
  const isRecovered = normalizeStatus(item?.status) === 'recovered';

  const claimStatus = String(item?.claim?.status || 'none').toLowerCase();
  const claimRequesterId = typeof item?.claim?.requester === 'string'
    ? item.claim.requester
    : item?.claim?.requester?._id;
  const isClaimRequester = Boolean(user?._id) && claimRequesterId === user?._id;
  const hasQuestions = Array.isArray(item?.secretQuestions) && item.secretQuestions.length > 0;

  const canRequestClaim = !isGuest && !isOwner && item?.status === 'found' && hasQuestions
    && claimStatus !== 'pending' && claimStatus !== 'approved';
  const canReviewClaim = canManage && claimStatus === 'pending';
  const canRevealContact = claimStatus === 'approved' && (isClaimRequester || canManage);

  const status = statusStyle(item?.status);
  const imageSource = useMemo(
    () => ({ uri: imgFailed ? generateItemImageUrl(item) : resolveItemImageUrl(item) }),
    [imgFailed, item]
  );

  const onMarkRecovered = async () => {
    if (!canManage || !item?._id || isRecovered) {
      return;
    }

    setBusy('recover');
    try {
      await markRecovered(item._id);
      await reloadItem();
      Alert.alert('Done', 'Report marked as recovered.');
    } catch (e) {
      Alert.alert('Error', e?.response?.data?.message || 'Could not update report.');
    } finally {
      setBusy('');
    }
  };

  const onDelete = () => {
    if (!canManage || !item?._id) {
      return;
    }

    Alert.alert('Delete Report', 'This will permanently delete the report.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          setBusy('delete');
          try {
            await deleteReport(item._id);
            navigation.goBack();
          } catch (e) {
            Alert.alert('Error', e?.response?.data?.message || 'Could not delete report.');
          } finally {
            setBusy('');
          }
        },
      },
    ]);
  };

  const onEdit = () => {
    if (!isOwner || !item?._id) {
      return;
    }
    navigation.navigate('Post', { mode: 'edit', item });
  };

  const onOpenChat = () => {
    if (!canChat) {
      return;
    }
    navigation.navigate('ChatConversation', {
      item: { _id: item._id, title: item.title, status: item.status },
      otherUserId: reporterId,
    });
  };

  const onSubmitClaim = async () => {
    const answers = claimAnswers.map((entry) => String(entry || '').trim());
    if (answers.some((entry) => !entry)) {
      Alert.alert('Claim', 'Please answer all secret questions.');
      return;
    }

    setBusy('claim-submit');
    try {
      await requestClaim(item._id, { answers, note: claimNote.trim() });
      await reloadItem();
      Alert.alert('Submitted', 'Claim submitted. Finder/admin will review it.');
      setShowClaimForm(false);
    } catch (e) {
      Alert.alert('Error', e?.response?.data?.message || 'Could not submit claim.');
    } finally {
      setBusy('');
    }
  };

  const onReviewClaim = async (action) => {
    setBusy(`claim-${action}`);
    try {
      await reviewClaim(item._id, {
        action,
        note: action === 'approve' ? 'Approved after review.' : 'Declined after review.',
      });
      await reloadItem();
      Alert.alert('Done', action === 'approve' ? 'Claim approved.' : 'Claim declined.');
    } catch (e) {
      Alert.alert('Error', e?.response?.data?.message || 'Could not review claim.');
    } finally {
      setBusy('');
    }
  };

  const onRevealContact = async () => {
    setBusy('contact');
    try {
      const data = await getClaimContact(item._id);
      setClaimContact(data?.contact || null);
    } catch (e) {
      Alert.alert('Error', e?.response?.data?.message || 'Could not reveal contact.');
    } finally {
      setBusy('');
    }
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.loaderWrap}>
        <ActivityIndicator size="large" color={C.blue} />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.root}>
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <Image source={imageSource} style={styles.image} resizeMode="cover" onError={() => setImgFailed(true)} />

        <View style={styles.card}>
          <View style={styles.titleRow}>
            <Text style={styles.title}>{item?.title || 'Item Details'}</Text>
            <View style={[styles.statusBadge, { backgroundColor: status.bg }]}>
              <Text style={[styles.statusText, { color: status.text }]}>{status.label}</Text>
            </View>
          </View>

          <Text style={styles.desc}>{item?.description || 'No description provided.'}</Text>

          <View style={styles.infoRow}>
            <AppIcon name="tag-outline" size={16} color={C.muted} />
            <Text style={styles.infoText}>{item?.category || 'Unknown category'}</Text>
          </View>
          <View style={styles.infoRow}>
            <AppIcon name="map-marker-outline" size={16} color={C.muted} />
            <Text style={styles.infoText}>{item?.locationText || 'Unknown location'}</Text>
          </View>
          <View style={styles.infoRow}>
            <AppIcon name="account-outline" size={16} color={C.muted} />
            <Text style={styles.infoText}>{item?.reportedBy?.name || 'Unknown reporter'}</Text>
          </View>
          <View style={styles.infoRow}>
            <AppIcon name="clock-outline" size={16} color={C.muted} />
            <Text style={styles.infoText}>{toDisplayTime(item?.createdAt)}</Text>
          </View>
        </View>

        <View style={styles.card}>
          <Text style={styles.sectionTitle}>Simple Recovery Workflow</Text>
          <Text style={styles.stepText}>1. Chat in-app (anonymous)</Text>
          <Text style={styles.stepText}>2. Ask and answer secret questions</Text>
          <Text style={styles.stepText}>3. Approve claim</Text>
          <Text style={styles.stepText}>4. Mark returned</Text>

          {canChat && (
            <Pressable style={[styles.button, styles.primary]} onPress={onOpenChat}>
              <Text style={styles.primaryText}>Message User</Text>
            </Pressable>
          )}

          {canRequestClaim && (
            <Pressable
              style={[styles.button, styles.secondary]}
              onPress={() => setShowClaimForm((prev) => !prev)}
            >
              <Text style={styles.secondaryText}>{showClaimForm ? 'Hide Claim Form' : 'This Is Mine (Claim)'}</Text>
            </Pressable>
          )}

          {showClaimForm && canRequestClaim && (
            <View style={styles.claimFormWrap}>
              {(item?.secretQuestions || []).map((entry, idx) => (
                <View key={`${item?._id}-q-${idx}`}>
                  <Text style={styles.claimQuestion}>{entry?.question || `Question ${idx + 1}`}</Text>
                  <TextInput
                    style={styles.input}
                    value={claimAnswers[idx] || ''}
                    onChangeText={(value) => {
                      setClaimAnswers((prev) => prev.map((x, i) => (i === idx ? value : x)));
                    }}
                    placeholder="Your answer"
                    placeholderTextColor="#6b7280"
                  />
                </View>
              ))}
              <TextInput
                style={styles.input}
                value={claimNote}
                onChangeText={setClaimNote}
                placeholder="Optional note"
                placeholderTextColor="#6b7280"
              />
              <Pressable
                style={[styles.button, styles.primary, busy === 'claim-submit' && styles.disabled]}
                onPress={onSubmitClaim}
                disabled={busy === 'claim-submit'}
              >
                {busy === 'claim-submit'
                  ? <ActivityIndicator size="small" color="#fff" />
                  : <Text style={styles.primaryText}>Submit Claim</Text>}
              </Pressable>
            </View>
          )}

          <View style={styles.claimStatusWrap}>
            <Text style={styles.claimStatusText}>Claim Status: {claimStatus.toUpperCase()}</Text>
          </View>

          {canReviewClaim && (
            <View style={styles.actionsRow}>
              <Pressable
                style={[styles.button, styles.primary, styles.halfButton, busy === 'claim-approve' && styles.disabled]}
                onPress={() => onReviewClaim('approve')}
                disabled={busy === 'claim-approve'}
              >
                {busy === 'claim-approve'
                  ? <ActivityIndicator size="small" color="#fff" />
                  : <Text style={styles.primaryText}>Approve Claim</Text>}
              </Pressable>
              <Pressable
                style={[styles.button, styles.warning, styles.halfButton, busy === 'claim-decline' && styles.disabled]}
                onPress={() => onReviewClaim('decline')}
                disabled={busy === 'claim-decline'}
              >
                {busy === 'claim-decline'
                  ? <ActivityIndicator size="small" color="#9a3412" />
                  : <Text style={styles.warningText}>Decline Claim</Text>}
              </Pressable>
            </View>
          )}

          {canRevealContact && (
            <>
              <Pressable
                style={[styles.button, styles.secondary, busy === 'contact' && styles.disabled]}
                onPress={onRevealContact}
                disabled={busy === 'contact'}
              >
                {busy === 'contact'
                  ? <ActivityIndicator size="small" color={C.blue} />
                  : <Text style={styles.secondaryText}>Reveal Contact (After Approval)</Text>}
              </Pressable>

              {claimContact?.phoneNumber ? (
                <View style={styles.contactBox}>
                  <Text style={styles.contactText}>{claimContact?.name || 'Owner'}: {claimContact.phoneNumber}</Text>
                </View>
              ) : null}
            </>
          )}

          {canManage && !isRecovered && (
            <Pressable
              style={[styles.button, styles.secondary, busy === 'recover' && styles.disabled]}
              onPress={onMarkRecovered}
              disabled={busy === 'recover'}
            >
              {busy === 'recover'
                ? <ActivityIndicator size="small" color={C.blue} />
                : <Text style={styles.secondaryText}>Mark Returned</Text>}
            </Pressable>
          )}
        </View>

        <View style={styles.card}>
          <View style={styles.actions}>
            {isOwner && (
              <Pressable style={[styles.button, styles.primary]} onPress={onEdit}>
                <Text style={styles.primaryText}>Edit</Text>
              </Pressable>
            )}

            {canManage && (
              <Pressable
                style={[styles.button, styles.danger, busy === 'delete' && styles.disabled]}
                onPress={onDelete}
                disabled={busy === 'delete'}
              >
                {busy === 'delete'
                  ? <ActivityIndicator size="small" color="#fff" />
                  : <Text style={styles.dangerText}>Delete</Text>}
              </Pressable>
            )}
          </View>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: C.bg },
  loaderWrap: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: C.bg },
  content: { paddingBottom: 24 },

  image: {
    width: '100%',
    height: 260,
    backgroundColor: '#e5e7eb',
  },

  card: {
    marginTop: 12,
    marginHorizontal: 12,
    backgroundColor: C.card,
    borderWidth: 1,
    borderColor: C.border,
    borderRadius: 16,
    padding: 14,
  },

  titleRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  title: { flex: 1, fontSize: 22, fontWeight: '800', color: C.text, marginRight: 8 },
  statusBadge: { borderRadius: 999, paddingHorizontal: 9, paddingVertical: 4 },
  statusText: { fontSize: 11, fontWeight: '800' },

  desc: { fontSize: 14, color: C.muted, lineHeight: 20, marginBottom: 14 },

  infoRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 8 },
  infoText: { color: C.text, fontSize: 13 },

  sectionTitle: { fontSize: 16, fontWeight: '800', color: C.text, marginBottom: 8 },
  stepText: { color: C.muted, fontSize: 12, marginBottom: 4 },

  actions: { gap: 8 },
  actionsRow: { flexDirection: 'row', gap: 8, marginTop: 8 },

  claimFormWrap: { marginTop: 8, gap: 8 },
  claimQuestion: { color: C.text, fontSize: 12, fontWeight: '700', marginBottom: 4 },
  input: {
    borderWidth: 1,
    borderColor: C.border,
    borderRadius: 10,
    paddingHorizontal: 10,
    paddingVertical: 10,
    color: C.text,
    backgroundColor: '#fff',
  },
  claimStatusWrap: {
    marginTop: 8,
    paddingVertical: 8,
  },
  claimStatusText: { color: C.text, fontWeight: '700', fontSize: 12 },

  button: {
    minHeight: 42,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    marginTop: 8,
  },
  halfButton: { flex: 1 },
  primary: { backgroundColor: C.blue, borderColor: C.blue },
  secondary: { backgroundColor: '#eff6ff', borderColor: '#bfdbfe' },
  warning: { backgroundColor: '#fff7ed', borderColor: '#fed7aa' },
  danger: { backgroundColor: C.red, borderColor: C.red },

  primaryText: { color: '#fff', fontWeight: '700' },
  secondaryText: { color: C.blue, fontWeight: '700' },
  warningText: { color: '#9a3412', fontWeight: '700' },
  dangerText: { color: '#fff', fontWeight: '700' },
  disabled: { opacity: 0.6 },

  contactBox: {
    marginTop: 8,
    borderWidth: 1,
    borderColor: '#bbf7d0',
    backgroundColor: '#ecfdf3',
    borderRadius: 10,
    padding: 10,
  },
  contactText: { color: '#166534', fontWeight: '700' },
});

export default ItemDetailScreen;
