const ITEM_IMAGE_BASE_URL = 'https://api.dicebear.com/9.x/shapes/png';

const normalizeSeed = (value) => {
  const raw = typeof value === 'string' ? value.trim() : '';
  return raw || 'findit-item';
};

export const generateItemImageUrl = (item = {}) => {
  const seedParts = [item.title, item.category, item.status]
    .filter((part) => typeof part === 'string' && part.trim())
    .map((part) => part.trim().toLowerCase());

  const seed = encodeURIComponent(normalizeSeed(seedParts.join('-')));
  return `${ITEM_IMAGE_BASE_URL}?seed=${seed}&size=256&backgroundColor=b6e3f4,c0aede,d1d4f9,ffd5dc`;
};

export const resolveItemImageUrl = (item = {}) => {
  const imageUrl = typeof item.imageUrl === 'string' ? item.imageUrl.trim() : '';
  return imageUrl || generateItemImageUrl(item);
};
