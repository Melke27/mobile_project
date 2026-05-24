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
  TextInput,
  View,
} from 'react-native';
import { useItems } from '../context/ItemsContext';
import { useAuth } from '../context/AuthContext';
import ItemCard from '../components/ItemCard';
import EmptyState from '../components/EmptyState';
import AppIcon from '../components/AppIcon';

const FEED_FILTERS = [
  { key: 'all', label: 'All', icon: 'view-grid-outline' },
  { key: 'lost', label: 'Lost', icon: 'help-circle-outline' },
  { key: 'found', label: 'Found', icon: 'hand-coin-outline' },
  { key: 'recovered', label: 'Returned', icon: 'check-circle-outline' },
];

const StatusMiniCard = ({ icon, label, value, color }) => (
  <View style={styles.miniCard}>
    <AppIcon name={icon} size={15} color={color} />
    <Text style={styles.miniCardValue}>{value}</Text>
    <Text style={styles.miniCardLabel}>{label}</Text>
  </View>
);

const normalizeStatus = (status = '') => (status === 'returned' ? 'recovered' : status);

const HomeScreen = ({ navigation }) => {
  const { items, loadLatest, loading } = useItems();
  const { user, isAdmin } = useAuth();

  const [loadError, setLoadError] = useState('');
  const [feedFilter, setFeedFilter] = useState('all');
  const [homeKeyword, setHomeKeyword] = useState('');

  const safeItems = Array.isArray(items) ? items : [];

  const init = useCallback(async () => {
    setLoadError('');
    try {
      await loadLatest();
    } catch (error) {
      const message = error?.response?.data?.message || 'Could not refresh reports right now.';
      setLoadError(message);
    }
  }, [loadLatest]);

  useEffect(() => {
    init();
  }, [init]);

  const requireLogin = useCallback(() => {
    Alert.alert('Login required', 'Please sign in first to use this feature.');
    navigation.navigate('Account');
  }, [navigation]);

  const summary = useMemo(() => {
    const lost = safeItems.filter((item) => normalizeStatus(item?.status) === 'lost').length;
    const found = safeItems.filter((item) => normalizeStatus(item?.status) === 'found').length;
    const recovered = safeItems.filter((item) => normalizeStatus(item?.status) === 'recovered').length;

    return { lost, found, recovered, total: safeItems.length };
  }, [safeItems]);

  const filteredItems = useMemo(() => {
    const byStatus = feedFilter === 'all'
      ? safeItems
      : safeItems.filter((item) => normalizeStatus(item?.status) === feedFilter);

    const q = homeKeyword.trim().toLowerCase();
    if (!q) {
      return byStatus;
    }

    return byStatus.filter((item) => {
      const haystack = `${item?.title || ''} ${item?.description || ''} ${item?.category || ''} ${item?.locationText || ''}`.toLowerCase();
      return haystack.includes(q);
    });
  }, [feedFilter, homeKeyword, safeItems]);

  const userLabel = user?.name ? user.name.split(' ')[0] : 'Guest';
  const dateLabel = useMemo(
    () => new Date().toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' }),
    []
  );

  const listHeader = (
    <View style={styles.headerWrap}>
      <View style={styles.heroCard}>
        <View style={styles.heroTopRow}>
          <Text style={styles.heroDate}>{dateLabel}</Text>
          <View style={styles.heroBadge}>
            <AppIcon name="shield-check-outline" size={12} color="#1a6edb" />
            <Text style={styles.heroBadgeText}>Trusted feed</Text>
          </View>
        </View>

        <Text style={styles.heroTitle}>Hi {userLabel}</Text>
        <Text style={styles.heroSub}>Lost something on campus? Report fast and track updates from one place.</Text>

        <View style={styles.heroCtaRow}>
          {!isAdmin && (
            <Pressable
              style={[styles.ctaButton, styles.ctaPrimary]}
              onPress={() => (user ? navigation.navigate('Post') : requireLogin())}
            >
              <AppIcon name="plus" size={16} color="#fff" />
              <Text style={styles.ctaPrimaryText}>Report Item</Text>
            </Pressable>
          )}

          <Pressable
            style={[styles.ctaButton, styles.ctaGhost, isAdmin && styles.ctaFullWidth]}
            onPress={() => navigation.navigate('Search')}
          >
            <AppIcon name="magnify" size={16} color="#1a6edb" />
            <Text style={styles.ctaGhostText}>Search</Text>
          </Pressable>
        </View>
      </View>

      <View style={styles.statsRow}>
        <StatusMiniCard icon="help-circle-outline" label="Lost" value={summary.lost} color="#a11b48" />
        <StatusMiniCard icon="hand-coin-outline" label="Found" value={summary.found} color="#0f6f4f" />
        <StatusMiniCard icon="check-circle-outline" label="Returned" value={summary.recovered} color="#2443a5" />
      </View>

      <View style={styles.feedTitleRow}>
        <Text style={styles.feedTitle}>Latest Reports</Text>
        <Text style={styles.feedCount}>{summary.total}</Text>
      </View>
      <Text style={styles.feedSub}>Pull down to refresh the feed.</Text>

      <View style={styles.searchRow}>
        <View style={styles.searchInputWrap}>
          <AppIcon name="magnify" size={16} color="#607780" />
          <TextInput
            style={styles.searchInput}
            placeholder="Search reports on home..."
            placeholderTextColor="#607780"
            value={homeKeyword}
            onChangeText={setHomeKeyword}
            returnKeyType="search"
          />
          {!!homeKeyword && (
            <Pressable onPress={() => setHomeKeyword('')}>
              <AppIcon name="close-circle" size={16} color="#607780" />
            </Pressable>
          )}
        </View>
        <Pressable
          style={styles.searchButton}
          onPress={() => navigation.navigate('Search', { initialFilters: { keyword: homeKeyword } })}
        >
          <Text style={styles.searchButtonText}>Advanced</Text>
        </Pressable>
      </View>

      <View style={styles.filtersRow}>
        {FEED_FILTERS.map((entry) => {
          const active = feedFilter === entry.key;
          return (
            <Pressable
              key={entry.key}
              style={[styles.filterChip, active && styles.filterChipActive]}
              onPress={() => setFeedFilter(entry.key)}
            >
              <AppIcon name={entry.icon} size={14} color={active ? '#fff' : '#45606a'} />
              <Text style={[styles.filterChipText, active && styles.filterChipTextActive]}>{entry.label}</Text>
            </Pressable>
          );
        })}
      </View>

      {!!loadError && (
        <View style={styles.errorBanner}>
          <AppIcon name="alert-circle-outline" size={16} color="#9f1239" />
          <Text style={styles.errorText} numberOfLines={2}>{loadError}</Text>
          <Pressable onPress={init} style={styles.retryButton}>
            <Text style={styles.retryText}>Retry</Text>
          </Pressable>
        </View>
      )}
    </View>
  );

  return (
    <SafeAreaView style={styles.root}>
      <FlatList
        data={filteredItems}
        keyExtractor={(item) => item?._id || item?.id || `${item?.title || 'item'}-${item?.createdAt || '0'}`}
        keyboardShouldPersistTaps="handled"
        initialNumToRender={8}
        maxToRenderPerBatch={8}
        windowSize={5}
        renderItem={({ item }) => (
          <ItemCard item={item} onPress={() => navigation.navigate('ItemDetail', { item })} />
        )}
        ListHeaderComponent={listHeader}
        contentContainerStyle={styles.listContent}
        refreshControl={<RefreshControl refreshing={loading} onRefresh={init} />}
        ListEmptyComponent={loading ? (
          <View style={styles.loadingWrap}>
            <ActivityIndicator size="large" color="#1a6edb" />
            <Text style={styles.loadingText}>Loading campus reports...</Text>
          </View>
        ) : safeItems.length > 0 ? (
          <EmptyState
            iconName="filter-outline"
            title="No Matching Reports"
            message="Try another filter to see more reports."
            actionLabel="Show All"
            onAction={() => setFeedFilter('all')}
          />
        ) : (
          <EmptyState
            iconName="basket-outline"
            title="No Reports Yet"
            message="Start by posting a lost or found item."
            actionLabel="Create First Report"
            onAction={() => (user && !isAdmin ? navigation.navigate('Post') : navigation.navigate('Search'))}
          />
        )}
      />
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#f1f5f9' },
  listContent: { paddingHorizontal: 12, paddingBottom: 24 },
  headerWrap: { paddingTop: 12 },

  heroCard: {
    backgroundColor: '#ffffff',
    borderWidth: 1,
    borderColor: '#d9e3e8',
    borderRadius: 16,
    padding: 14,
  },
  heroTopRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  heroDate: { color: '#5b7279', fontSize: 12, fontWeight: '700' },
  heroBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: '#ecf4ff',
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 5,
  },
  heroBadgeText: { color: '#1a6edb', fontWeight: '700', fontSize: 11 },
  heroTitle: { color: '#0f2f38', fontSize: 26, fontWeight: '900', marginTop: 10 },
  heroSub: { color: '#577078', fontSize: 13, marginTop: 5, lineHeight: 19 },

  heroCtaRow: { flexDirection: 'row', gap: 8, marginTop: 12 },
  ctaFullWidth: { flex: 1 },
  ctaButton: {
    flex: 1,
    borderRadius: 10,
    paddingVertical: 10,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: 6,
  },
  ctaPrimary: { backgroundColor: '#1a6edb' },
  ctaPrimaryText: { color: '#fff', fontWeight: '800', fontSize: 13 },
  ctaGhost: { borderWidth: 1, borderColor: '#c8d8e3', backgroundColor: '#f7fbff' },
  ctaGhostText: { color: '#1a6edb', fontWeight: '800', fontSize: 13 },

  statsRow: { flexDirection: 'row', gap: 8, marginTop: 12 },
  miniCard: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 10,
    backgroundColor: '#ffffff',
    borderWidth: 1,
    borderColor: '#d9e3e8',
    borderRadius: 12,
  },
  miniCardValue: { fontSize: 19, fontWeight: '900', color: '#123b45', marginTop: 3 },
  miniCardLabel: { fontSize: 12, fontWeight: '700', color: '#5e747b', marginTop: 1 },

  feedTitleRow: { marginTop: 15, flexDirection: 'row', alignItems: 'center' },
  feedTitle: { fontSize: 21, fontWeight: '900', color: '#123944' },
  feedCount: {
    marginLeft: 8,
    minWidth: 28,
    textAlign: 'center',
    borderRadius: 999,
    backgroundColor: '#e7f0fb',
    color: '#1a6edb',
    fontWeight: '800',
    fontSize: 12,
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  feedSub: { color: '#607780', marginTop: 2, fontSize: 12, fontWeight: '600' },
  searchRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 10 },
  searchInputWrap: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    borderWidth: 1,
    borderColor: '#cedce3',
    borderRadius: 10,
    backgroundColor: '#fff',
    paddingHorizontal: 10,
    minHeight: 42,
  },
  searchInput: { flex: 1, color: '#123944', fontSize: 13, paddingVertical: 0 },
  searchButton: {
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#c8d8e3',
    backgroundColor: '#f7fbff',
    paddingHorizontal: 10,
    paddingVertical: 10,
  },
  searchButtonText: { color: '#1a6edb', fontWeight: '800', fontSize: 12 },

  filtersRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 10 },
  filterChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 11,
    paddingVertical: 7,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: '#cedce3',
    backgroundColor: '#fff',
  },
  filterChipActive: { backgroundColor: '#1a6edb', borderColor: '#1a6edb' },
  filterChipText: { color: '#45606a', fontWeight: '700', fontSize: 12 },
  filterChipTextActive: { color: '#fff' },

  errorBanner: {
    marginTop: 10,
    backgroundColor: '#ffe4ec',
    borderWidth: 1,
    borderColor: '#fecdd3',
    borderRadius: 10,
    paddingHorizontal: 10,
    paddingVertical: 8,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  errorText: { flex: 1, color: '#9f1239', fontSize: 12, fontWeight: '600' },
  retryButton: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    backgroundColor: '#be123c',
    borderRadius: 8,
  },
  retryText: { color: '#fff', fontSize: 12, fontWeight: '700' },

  loadingWrap: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 32,
    gap: 10,
  },
  loadingText: { color: '#4b6b73', fontWeight: '600' },
});

export default HomeScreen;
