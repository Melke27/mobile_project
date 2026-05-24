import React, { useMemo, useState } from 'react';
import { Image, Pressable, StyleSheet, Text, View } from 'react-native';
import AppIcon from './AppIcon';
import { generateItemImageUrl, resolveItemImageUrl } from '../utils/imageFallback';

const C = {
  blue: '#1a6edb',
  white: '#ffffff',
  card: '#ffffff',
  border: '#e5e7eb',
  text: '#111827',
  muted: '#6b7280',
  lost: { bg: '#fff0f0', text: '#cc2222' },
  found: { bg: '#e8f5e9', text: '#15803d' },
};

const STATUS_MAP = {
  lost: { label: 'LOST', color: C.lost.text, bg: C.lost.bg },
  found: { label: 'FOUND', color: C.found.text, bg: C.found.bg },
  recovered: { label: 'RETURNED', color: C.blue, bg: '#eff6ff' },
  returned: { label: 'RETURNED', color: C.blue, bg: '#eff6ff' },
};

const getStatus = (status = '') => STATUS_MAP[status.toLowerCase()] || {
  label: 'FOUND',
  color: C.found.text,
  bg: C.found.bg,
};

const ItemCard = ({ item = {}, onPress }) => {
  const [imgFailed, setImgFailed] = useState(false);

  const status = getStatus(item.status);
  const isUrgent = /exam permit|admit card|id card|identity/i.test(
    `${item.category || ''} ${item.title || ''}`
  );

  const imageSource = useMemo(() => ({
    uri: imgFailed ? generateItemImageUrl(item) : resolveItemImageUrl(item)
  }), [imgFailed, item]);

  return (
    <Pressable
      style={({ pressed }) => [styles.card, pressed && styles.pressed]}
      onPress={onPress}
    >
      {/* Image */}
      <View style={styles.imageContainer}>
        <Image
          source={imageSource}
          style={styles.image}
          resizeMode="cover"
          onError={() => setImgFailed(true)}
        />
        {isUrgent && (
          <View style={styles.urgentBadge}>
            <Text style={styles.urgentText}>URGENT</Text>
          </View>
        )}
      </View>

      {/* Content */}
      <View style={styles.content}>
        <View style={styles.titleRow}>
          <Text style={styles.title} numberOfLines={2}>{item.title}</Text>
          <View style={[styles.statusBadge, { backgroundColor: status.bg }]}>
            <Text style={[styles.statusText, { color: status.color }]}>
              {status.label}
            </Text>
          </View>
        </View>

        <Text style={styles.description} numberOfLines={2}>
          {item.description || 'No description provided'}
        </Text>

        <View style={styles.metaRow}>
          <View style={styles.metaItem}>
            <AppIcon name="tag-outline" size={14} color={C.muted} />
            <Text style={styles.metaText}>{item.category}</Text>
          </View>
          <View style={styles.metaItem}>
            <AppIcon name="map-marker-outline" size={14} color={C.muted} />
            <Text style={styles.metaText} numberOfLines={1}>
              {item.locationText || 'Unknown location'}
            </Text>
          </View>
        </View>

        <View style={styles.footer}>
          <Text style={styles.date}>
            {item.createdAt ? new Date(item.createdAt).toLocaleDateString() : 'Recently'}
          </Text>
          <View style={styles.viewDetails}>
            <Text style={styles.viewDetailsText}>View Details</Text>
            <AppIcon name="arrow-right" size={14} color={C.blue} />
          </View>
        </View>
      </View>
    </Pressable>
  );
};

const styles = StyleSheet.create({
  card: {
    backgroundColor: C.card,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: C.border,
    marginBottom: 12,
    overflow: 'hidden',
  },
  pressed: { opacity: 0.9 },

  imageContainer: { position: 'relative' },
  image: {
    width: '100%',
    height: 160,
    backgroundColor: '#f1f5f9',
  },
  urgentBadge: {
    position: 'absolute',
    top: 12,
    right: 12,
    backgroundColor: '#b45309',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 999,
  },
  urgentText: {
    color: '#fff',
    fontSize: 10,
    fontWeight: '700',
  },

  content: { padding: 14 },

  titleRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 8,
  },
  title: {
    flex: 1,
    fontSize: 16,
    fontWeight: '700',
    color: C.text,
    marginRight: 8,
  },
  statusBadge: {
    paddingHorizontal: 10,
    paddingVertical: 3,
    borderRadius: 999,
  },
  statusText: {
    fontSize: 10,
    fontWeight: '700',
  },

  description: {
    fontSize: 13,
    color: C.muted,
    lineHeight: 18,
    marginBottom: 10,
  },

  metaRow: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 12,
  },
  metaItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  metaText: {
    fontSize: 12,
    color: C.muted,
  },

  footer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  date: {
    fontSize: 12,
    color: C.muted,
  },
  viewDetails: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  viewDetailsText: {
    color: C.blue,
    fontSize: 13,
    fontWeight: '600',
  },
});

export default ItemCard;
