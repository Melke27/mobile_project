import React, { useCallback, useEffect, useState } from 'react';
import {
  Alert, FlatList, RefreshControl,
  SafeAreaView, StyleSheet, Text, View,
} from 'react-native';
import FilterBar from '../components/FilterBar';
import EmptyState from '../components/EmptyState';
import ItemCard from '../components/ItemCard';
import AppIcon from '../components/AppIcon';
import { useItems } from '../context/ItemsContext';

const C = {
  blue:     '#1a6edb',
  blueSoft: '#eff6ff',
  white:    '#ffffff',
  bg:       '#f5f7fb',
  card:     '#ffffff',
  border:   '#e5e7eb',
  text:     '#111827',
  muted:    '#6b7280',
};

const DEFAULT_FILTERS = { keyword: '', status: '', category: '', location: '' };

const SearchScreen = ({ navigation, route }) => {
  const { searchReports } = useItems();

  const [filters, setFilters] = useState(DEFAULT_FILTERS);
  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(false);

  const runSearch = useCallback(async (f) => {
    setLoading(true);
    try {
      const found = await searchReports(f);
      setResults(found || []);
    } catch (e) {
      Alert.alert('Search failed', e?.response?.data?.message || 'Please try again.');
    } finally {
      setLoading(false);
    }
  }, [searchReports]);

  useEffect(() => {
    const initialFilters = route?.params?.initialFilters
      ? { ...DEFAULT_FILTERS, ...route.params.initialFilters }
      : DEFAULT_FILTERS;
    setFilters(initialFilters);
    runSearch(initialFilters);
  }, [route?.params?.initialFilters, runSearch]);

  const onSearch = () => runSearch(filters);
  const onReset = () => {
    setFilters(DEFAULT_FILTERS);
    runSearch(DEFAULT_FILTERS);
  };

  const listHeader = (
    <View>
      {/* Blue Header */}
      <View style={styles.header}>
        <View style={styles.headerLeft}>
          <AppIcon name="magnify" size={24} color={C.white} />
          <View>
            <Text style={styles.headerTitle}>Search Items</Text>
            <Text style={styles.headerSub}>Find lost or found reports</Text>
          </View>
        </View>

        <View style={styles.countBadge}>
          <Text style={styles.countTxt}>{results.length}</Text>
          <Text style={styles.countLabel}>RESULTS</Text>
        </View>
      </View>

      {/* Filter Bar */}
      <View style={styles.filterContainer}>
        <FilterBar
          filters={filters}
          onChange={setFilters}
          onSearch={onSearch}
          onReset={onReset}
          loading={loading}
        />
      </View>

      {/* Results Header */}
      {results.length > 0 && (
        <View style={styles.resultsHeader}>
          <Text style={styles.resultsTitle}>
            {results.length} report{results.length !== 1 ? 's' : ''} found
          </Text>
        </View>
      )}
    </View>
  );

  return (
    <SafeAreaView style={styles.root}>
      <FlatList
        data={results}
        keyExtractor={(item) => item?._id || item?.id || `${item?.title || 'report'}-${item?.createdAt || '0'}`}
        keyboardShouldPersistTaps="handled"
        initialNumToRender={8}
        maxToRenderPerBatch={8}
        windowSize={5}
        ListHeaderComponent={listHeader}
        contentContainerStyle={styles.listContent}
        refreshControl={
          <RefreshControl refreshing={loading} onRefresh={onSearch} tintColor={C.blue} />
        }
        renderItem={({ item }) => (
          <ItemCard
            item={item}
            onPress={() => navigation.navigate('ItemDetail', { item })}
          />
        )}
        ListEmptyComponent={
          !loading && (
            <EmptyState
              iconName="compass-outline"
              title="No Results"
              message="Try different keywords, status, or category."
              actionLabel="Reset Filters"
              onAction={onReset}
            />
          )
        }
      />
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: C.bg },

  listContent: { paddingHorizontal: 12, paddingBottom: 30 },

  /* Header */
  header: {
    backgroundColor: C.blue,
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 20,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginHorizontal: -12,
  },
  headerLeft: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  headerTitle: { fontSize: 19, fontWeight: '700', color: C.white },
  headerSub: { fontSize: 12, color: 'rgba(255,255,255,0.75)', marginTop: 2 },

  countBadge: {
    backgroundColor: 'rgba(255,255,255,0.25)',
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 12,
    alignItems: 'center',
  },
  countTxt: { fontSize: 22, fontWeight: '800', color: C.white },
  countLabel: { fontSize: 10, fontWeight: '600', color: 'rgba(255,255,255,0.85)' },

  filterContainer: { marginTop: -20, marginHorizontal: 12, marginBottom: 8 },

  resultsHeader: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  resultsTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: C.text,
  },
});

export default SearchScreen;
