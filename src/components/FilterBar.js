import React from 'react';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import AppIcon from './AppIcon';

const C = {
  blue: '#1a6edb',
  card: '#ffffff',
  border: '#e5e7eb',
  text: '#111827',
  muted: '#6b7280',
};

const IconInput = ({ iconName, style, value = '', onClear, ...props }) => {
  const hasValue = Boolean(value);

  return (
    <View style={[styles.inputWrap, style]}>
      <AppIcon name={iconName} size={18} color={C.muted} />
      <TextInput
        {...props}
        value={value}
        style={styles.inputField}
        placeholderTextColor={C.muted}
      />
      {hasValue && onClear ? (
        <Pressable style={styles.clearInputButton} onPress={onClear}>
          <AppIcon name="close-circle" size={16} color={C.muted} />
        </Pressable>
      ) : null}
    </View>
  );
};

const StatusButton = ({ value, current, onSelect }) => {
  const active = value === current;
  const iconName =
    value === 'lost'
      ? 'help-circle-outline'
      : value === 'found'
        ? 'hand-coin-outline'
        : 'check-circle-outline';
  const label = value === 'recovered' ? 'RETURNED' : value.toUpperCase();

  return (
    <Pressable
      style={[styles.statusButton, active && styles.statusButtonActive]}
      onPress={() => onSelect(active ? '' : value)}
    >
      <AppIcon name={iconName} size={16} color={active ? '#ffffff' : C.muted} />
      <Text style={[styles.statusButtonText, active && styles.statusButtonTextActive]}>
        {label}
      </Text>
    </Pressable>
  );
};

const FilterBar = ({ filters, onChange, onSearch, onReset, loading = false }) => {
  return (
    <View style={styles.container}>
      <View style={styles.headerRow}>
        <View style={styles.headerLeft}>
          <AppIcon name="tune-variant" size={16} color="#17424d" />
          <Text style={styles.headerText}>Filters</Text>
        </View>
        <Pressable onPress={onReset} disabled={loading}>
          <Text style={styles.clearAllText}>Clear all</Text>
        </Pressable>
      </View>

      <IconInput
        iconName="text-box-search-outline"
        placeholder="Keyword"
        value={filters.keyword || ''}
        onChangeText={(text) => onChange({ ...filters, keyword: text })}
        autoCapitalize="none"
        returnKeyType="search"
        onSubmitEditing={onSearch}
        onClear={() => onChange({ ...filters, keyword: '' })}
      />

      <IconInput
        iconName="tag-multiple-outline"
        placeholder="Category"
        value={filters.category || ''}
        onChangeText={(text) => onChange({ ...filters, category: text })}
        autoCapitalize="words"
        returnKeyType="done"
        onSubmitEditing={onSearch}
        onClear={() => onChange({ ...filters, category: '' })}
      />

      <IconInput
        iconName="map-marker-outline"
        placeholder="Location"
        value={filters.location || ''}
        onChangeText={(text) => onChange({ ...filters, location: text })}
        autoCapitalize="words"
        returnKeyType="done"
        onSubmitEditing={onSearch}
        onClear={() => onChange({ ...filters, location: '' })}
      />

      <View style={styles.statusRow}>
        <StatusButton
          value="lost"
          current={filters.status}
          onSelect={(status) => onChange({ ...filters, status })}
        />
        <StatusButton
          value="found"
          current={filters.status}
          onSelect={(status) => onChange({ ...filters, status })}
        />
        <StatusButton
          value="recovered"
          current={filters.status}
          onSelect={(status) => onChange({ ...filters, status })}
        />
      </View>

      <Pressable style={[styles.searchButton, loading && styles.searchButtonDisabled]} onPress={onSearch} disabled={loading}>
        <AppIcon name="magnify" size={16} color="#ffffff" />
        <Text style={styles.searchButtonText}>{loading ? 'Searching...' : 'Apply Filters'}</Text>
      </Pressable>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    backgroundColor: C.card,
    borderRadius: 16,
    padding: 14,
    marginHorizontal: 12,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: C.border,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 10,
  },
  headerLeft: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  headerText: { color: '#17424d', fontWeight: '800', fontSize: 13 },
  clearAllText: { color: '#4b5563', fontSize: 12, fontWeight: '700' },

  inputWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f8fafc',
    borderWidth: 1,
    borderColor: C.border,
    borderRadius: 12,
    paddingHorizontal: 12,
    marginBottom: 10,
    height: 46,
  },
  inputField: {
    flex: 1,
    marginLeft: 10,
    fontSize: 14,
    color: C.text,
  },
  clearInputButton: { paddingLeft: 8, paddingVertical: 2 },

  statusRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 10,
  },
  statusButton: {
    flex: 1,
    minWidth: 90,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: C.border,
    backgroundColor: '#fff',
  },
  statusButtonActive: {
    backgroundColor: C.blue,
    borderColor: C.blue,
  },
  statusButtonText: {
    fontSize: 13,
    fontWeight: '700',
    color: C.muted,
    textTransform: 'uppercase',
  },
  statusButtonTextActive: {
    color: '#ffffff',
  },

  searchButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingHorizontal: 18,
    paddingVertical: 11,
    borderRadius: 10,
    backgroundColor: C.blue,
  },
  searchButtonDisabled: { backgroundColor: '#8ea5c7' },
  searchButtonText: {
    color: '#ffffff',
    fontWeight: '700',
    fontSize: 13,
  },
});

export default FilterBar;
