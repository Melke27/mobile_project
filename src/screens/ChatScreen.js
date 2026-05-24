import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Pressable,
  RefreshControl,
  SafeAreaView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import AppIcon from '../components/AppIcon';
import { useAuth } from '../context/AuthContext';
import { chatService } from '../services/chatService';

const resolveId = (value) => {
  if (!value) {
    return '';
  }

  if (typeof value === 'string') {
    return value;
  }

  return value._id || '';
};

const ChatScreen = ({ route, navigation }) => {
  const params = route?.params || {};
  const item = params.item || null;
  const otherUserId = resolveId(params.otherUserId);
  const canChat = Boolean(item?._id && otherUserId);
  const { user } = useAuth();

  const [messages, setMessages] = useState([]);
  const [text, setText] = useState('');
  const [loading, setLoading] = useState(false);
  const [sending, setSending] = useState(false);
  const pollingInFlightRef = useRef(false);

  const load = useCallback(async ({ silent = false } = {}) => {
    if (!canChat) {
      setMessages([]);
      return;
    }

    if (silent && pollingInFlightRef.current) {
      return;
    }

    if (!silent) {
      setLoading(true);
    } else {
      pollingInFlightRef.current = true;
    }

    try {
      const data = await chatService.getConversation(item._id, otherUserId);
      setMessages(Array.isArray(data?.messages) ? data.messages : []);
    } catch (error) {
      if (!silent) {
        Alert.alert('Chat error', error?.response?.data?.message || 'Could not load messages.');
      }
    } finally {
      if (!silent) {
        setLoading(false);
      }
      pollingInFlightRef.current = false;
    }
  }, [canChat, item?._id, otherUserId]);

  useEffect(() => {
    load().catch(() => undefined);

    if (!canChat) {
      return undefined;
    }

    const timer = setInterval(() => {
      load({ silent: true }).catch(() => undefined);
    }, 8000);

    return () => clearInterval(timer);
  }, [canChat, load]);

  const send = async () => {
    const message = text.trim();
    if (!canChat || !message || sending) {
      return;
    }

    setSending(true);
    try {
      await chatService.sendMessage({
        itemId: item._id,
        receiverId: otherUserId,
        message,
      });
      setText('');
      await load();
    } catch (error) {
      Alert.alert('Send failed', error?.response?.data?.message || 'Please try again.');
    } finally {
      setSending(false);
    }
  };

  return (
    <SafeAreaView style={styles.root}>
      <View style={styles.headerWrap}>
        <AppIcon name="chat-processing-outline" size={18} color="#1e434a" />
        <Text style={styles.header}>{canChat ? `Chat about: ${item.title || 'Item'}` : 'Campus Chat'}</Text>
      </View>
      <View style={styles.noticeWrap}>
        <AppIcon name="shield-lock-outline" size={14} color="#1a6edb" />
        <Text style={styles.noticeText}>Private chat only. No phone numbers are shared in chat.</Text>
      </View>

      <FlatList
        data={messages}
        keyExtractor={(m, index) => m?._id || `${resolveId(m?.senderId)}-${m?.createdAt || index}`}
        keyboardShouldPersistTaps="handled"
        initialNumToRender={12}
        maxToRenderPerBatch={12}
        windowSize={7}
        contentContainerStyle={{ padding: 12, flexGrow: 1 }}
        refreshControl={<RefreshControl refreshing={loading} onRefresh={load} />}
        renderItem={({ item: message }) => {
          const mine = resolveId(message?.senderId) === user?._id;
          return (
            <View style={[styles.bubble, mine ? styles.mine : styles.theirs]}>
              <Text style={[styles.message, mine && styles.myMessage]}>{message?.message || ''}</Text>
            </View>
          );
        }}
        ListEmptyComponent={(
          <View style={styles.emptyWrap}>
            <AppIcon name="message-text-outline" size={24} color="#6a7f86" />
            <Text style={styles.emptyText}>
              {canChat
                ? 'No messages yet. Start the conversation.'
                : 'Open any report and tap "Message Reporter" to start chat.'}
            </Text>
            {!canChat && (
              <Pressable style={styles.openReportsBtn} onPress={() => navigation.navigate('Home')}>
                <Text style={styles.openReportsText}>Go To Home Reports</Text>
              </Pressable>
            )}
          </View>
        )}
      />

      <View style={styles.composer}>
        <TextInput
          style={[styles.input, !canChat && styles.inputDisabled]}
          placeholder={canChat ? 'Type message' : 'Open a report first to chat'}
          placeholderTextColor="#6a7f86"
          value={text}
          onChangeText={setText}
          editable={!sending && canChat}
        />
        <Pressable
          style={[styles.send, (sending || !canChat) && styles.sendDisabled]}
          onPress={send}
          disabled={sending || !canChat}
        >
          {sending ? (
            <ActivityIndicator size="small" color="#ffffff" />
          ) : (
            <View style={styles.sendInner}>
              <AppIcon name="send-outline" size={14} color="#ffffff" />
              <Text style={styles.sendText}>Send</Text>
            </View>
          )}
        </Pressable>
      </View>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#f5f7fb' },
  headerWrap: { padding: 12, flexDirection: 'row', alignItems: 'center', gap: 6 },
  header: { fontWeight: '700', color: '#1e434a' },
  noticeWrap: {
    marginHorizontal: 12,
    marginBottom: 6,
    padding: 8,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#bfdbfe',
    backgroundColor: '#eff6ff',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  noticeText: { flex: 1, color: '#1d4f91', fontSize: 11, fontWeight: '600' },
  bubble: {
    maxWidth: '82%',
    borderRadius: 10,
    paddingHorizontal: 10,
    paddingVertical: 8,
    marginBottom: 8,
  },
  mine: { backgroundColor: '#1a6edb', alignSelf: 'flex-end' },
  theirs: { backgroundColor: '#e2eef1', alignSelf: 'flex-start' },
  message: { color: '#172a2f' },
  myMessage: { color: '#fff' },
  emptyWrap: { alignItems: 'center', paddingTop: 28, paddingHorizontal: 20 },
  emptyText: { color: '#6a7f86', marginTop: 6, fontWeight: '600', textAlign: 'center' },
  openReportsBtn: {
    marginTop: 12,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
    backgroundColor: '#1a6edb',
  },
  openReportsText: { color: '#fff', fontWeight: '700' },
  composer: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 10,
    borderTopWidth: 1,
    borderTopColor: '#d4e0e4',
    backgroundColor: '#fff',
  },
  input: {
    flex: 1,
    borderWidth: 1,
    borderColor: '#c6d6db',
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 8,
    marginRight: 8,
    color: '#1f2937',
    backgroundColor: '#fff',
  },
  inputDisabled: { backgroundColor: '#f1f5f9', color: '#7b8791' },
  send: { backgroundColor: '#1a6edb', borderRadius: 8, paddingHorizontal: 14, paddingVertical: 10 },
  sendDisabled: { backgroundColor: '#87aeb5' },
  sendInner: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  sendText: { color: '#fff', fontWeight: '700' },
});

export default ChatScreen;
