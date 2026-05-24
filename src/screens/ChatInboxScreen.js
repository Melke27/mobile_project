import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Pressable,
  RefreshControl,
  SafeAreaView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import AppIcon from '../components/AppIcon';
import EmptyState from '../components/EmptyState';
import { chatService } from '../services/chatService';
import { useFocusEffect } from '@react-navigation/native';

const C = {
  blue: '#1a6edb',
  bg: '#f5f7fb',
  card: '#ffffff',
  border: '#e5e7eb',
  text: '#111827',
  muted: '#6b7280',
};

const normalizeStatus = (status = '') => (String(status).toLowerCase() === 'returned' ? 'recovered' : String(status).toLowerCase());

const statusColor = (status = '') => {
  const key = normalizeStatus(status);
  if (key === 'lost') return { bg: '#fff0f0', text: '#cc2222' };
  if (key === 'found') return { bg: '#e8f5e9', text: '#1b5e20' };
  if (key === 'recovered') return { bg: '#eff6ff', text: '#1a6edb' };
  return { bg: '#f3f4f6', text: C.muted };
};

const fmt = (value) => {
  if (!value) return 'Unknown';
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? 'Unknown' : d.toLocaleString();
};

const ChatInboxScreen = ({ navigation }) => {
  const [conversations, setConversations] = useState([]);
  const [loading, setLoading] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const data = await chatService.getConversations();
      setConversations(Array.isArray(data?.conversations) ? data.conversations : []);
    } catch (error) {
      Alert.alert('Chat', error?.response?.data?.message || 'Could not load conversations.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load().catch(() => undefined);
  }, [load]);

  useFocusEffect(
    useCallback(() => {
      load().catch(() => undefined);
    }, [load])
  );

  const unreadTotal = useMemo(
    () => conversations.reduce((sum, entry) => sum + (Number(entry?.unreadCount) || 0), 0),
    [conversations]
  );

  return (
    <SafeAreaView style={styles.root}>
      <View style={styles.header}>
        <View>
          <Text style={styles.title}>Messages</Text>
          <Text style={styles.subtitle}>Anonymous in-app chat only</Text>
        </View>
        <View style={styles.unreadBadge}>
          <Text style={styles.unreadText}>{unreadTotal}</Text>
        </View>
      </View>

      <FlatList
        data={conversations}
        keyExtractor={(entry) => entry?.conversationId || `${entry?.itemId}-${entry?.otherUserId}`}
        contentContainerStyle={styles.listContent}
        refreshControl={<RefreshControl refreshing={loading} onRefresh={load} tintColor={C.blue} />}
        renderItem={({ item }) => {
          const sc = statusColor(item?.itemStatus);
          return (
            <Pressable
              style={({ pressed }) => [styles.card, pressed && styles.pressed]}
              onPress={() => navigation.navigate('ChatConversation', {
                item: { _id: item?.itemId, title: item?.itemTitle, status: item?.itemStatus },
                otherUserId: item?.otherUserId,
              })}
            >
              <View style={styles.cardTop}>
                <Text style={styles.cardTitle} numberOfLines={1}>{item?.itemTitle || 'Unknown Item'}</Text>
                <View style={[styles.statusBadge, { backgroundColor: sc.bg }]}>
                  <Text style={[styles.statusText, { color: sc.text }]}>{normalizeStatus(item?.itemStatus).toUpperCase()}</Text>
                </View>
              </View>

              <Text style={styles.meta} numberOfLines={1}>With: {item?.otherUserName || 'User'}</Text>
              <Text style={styles.preview} numberOfLines={2}>{item?.lastMessage || ''}</Text>

              <View style={styles.footer}>
                <Text style={styles.time}>{fmt(item?.lastMessageAt)}</Text>
                {!!item?.unreadCount && (
                  <View style={styles.unreadDotWrap}>
                    <Text style={styles.unreadDotText}>{item.unreadCount}</Text>
                  </View>
                )}
              </View>
            </Pressable>
          );
        }}
        ListEmptyComponent={
          loading ? (
            <View style={styles.loadingWrap}>
              <ActivityIndicator size="large" color={C.blue} />
            </View>
          ) : (
            <EmptyState
              iconName="chat-processing-outline"
              title="No Conversations"
              message="Open any item and tap Message to start chat."
              actionLabel="Go To Home"
              onAction={() => navigation.navigate('Home')}
            />
          )
        }
      />
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: C.bg },
  header: {
    paddingHorizontal: 14,
    paddingVertical: 12,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: C.border,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  title: { fontSize: 22, fontWeight: '800', color: C.text },
  subtitle: { color: C.muted, marginTop: 2, fontSize: 12 },
  unreadBadge: {
    minWidth: 30,
    height: 30,
    borderRadius: 15,
    paddingHorizontal: 8,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#e0ecff',
  },
  unreadText: { color: C.blue, fontWeight: '800' },

  listContent: { padding: 12, paddingBottom: 24 },
  card: {
    backgroundColor: C.card,
    borderWidth: 1,
    borderColor: C.border,
    borderRadius: 14,
    padding: 12,
    marginBottom: 10,
  },
  pressed: { opacity: 0.86 },
  cardTop: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    marginBottom: 6,
    gap: 8,
  },
  cardTitle: { flex: 1, color: C.text, fontSize: 15, fontWeight: '700' },
  statusBadge: { borderRadius: 999, paddingHorizontal: 9, paddingVertical: 3 },
  statusText: { fontSize: 10, fontWeight: '800' },
  meta: { color: C.muted, fontSize: 12, marginBottom: 4 },
  preview: { color: '#27383d', fontSize: 13 },
  footer: {
    marginTop: 8,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  time: { color: C.muted, fontSize: 11 },
  unreadDotWrap: {
    minWidth: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: C.blue,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 6,
  },
  unreadDotText: { color: '#fff', fontSize: 11, fontWeight: '700' },
  loadingWrap: { paddingVertical: 40, alignItems: 'center' },
});

export default ChatInboxScreen;
