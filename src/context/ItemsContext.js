import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { itemService } from '../services/itemService';
import { matchingService } from '../services/matchingService';
import { storageService } from '../services/storageService';

const ItemsContext = createContext(null);

export const ItemsProvider = ({ children }) => {
  const [items, setItems] = useState([]);
  const [savedItems, setSavedItems] = useState([]);
  const [loading, setLoading] = useState(false);
  const savedItemsRef = useRef([]);

  useEffect(() => {
    storageService
      .getJSON(storageService.keys.SAVED_ITEMS, [])
      .then((saved) => {
        const safeSaved = Array.isArray(saved) ? saved : [];
        savedItemsRef.current = safeSaved;
        setSavedItems(safeSaved);
      })
      .catch(() => {
        savedItemsRef.current = [];
        setSavedItems([]);
      });
  }, []);

  const persistSavedItems = useCallback(async (nextSavedItems) => {
    savedItemsRef.current = nextSavedItems;
    setSavedItems(nextSavedItems);
    await storageService.setJSON(storageService.keys.SAVED_ITEMS, nextSavedItems);
  }, []);

  const toggleSavedItem = useCallback(async (item) => {
    if (!item?._id) {
      return false;
    }

    const exists = savedItems.some((saved) => saved._id === item._id);
    const nextSaved = exists
      ? savedItems.filter((saved) => saved._id !== item._id)
      : [item, ...savedItems];

    await persistSavedItems(nextSaved);
    return !exists;
  }, [persistSavedItems, savedItems]);

  const isItemSaved = useCallback(
    (itemId) => Boolean(itemId && savedItems.some((saved) => saved._id === itemId)),
    [savedItems]
  );

  const clearSavedItems = useCallback(async () => {
    await persistSavedItems([]);
  }, [persistSavedItems]);

  const recordViewedItem = useCallback(async (item) => {
    if (!item?._id) {
      return;
    }
    const key = 'lf_recently_viewed_items';
    const existing = await storageService.getJSON(key, []);
    const safeExisting = Array.isArray(existing) ? existing : [];
    const deduped = [item, ...safeExisting.filter((entry) => entry?._id !== item._id)].slice(0, 20);
    await storageService.setJSON(key, deduped);
  }, []);

  const loadLatest = useCallback(async (params = {}) => {
    setLoading(true);
    const canUseCache = !params.page && !params.status && !params.keyword;
    let cached = [];

    try {
      const cachedRaw = await storageService.getJSON(storageService.keys.CACHED_REPORTS, []);
      cached = Array.isArray(cachedRaw) ? cachedRaw : [];

      if (cached.length && canUseCache) {
        setItems(cached);
      }

      const data = await itemService.getLatestReports(params);
      const nextItems = Array.isArray(data?.items) ? data.items : [];

      setItems(nextItems);
      if (canUseCache) {
        await storageService.setJSON(storageService.keys.CACHED_REPORTS, nextItems);
      }

      const currentSaved = savedItemsRef.current;
      if (currentSaved.length) {
        const indexById = new Map(nextItems.map((entry) => [entry._id, entry]));
        const refreshedSaved = currentSaved
          .map((saved) => indexById.get(saved._id) || saved)
          .filter(Boolean);
        await persistSavedItems(refreshedSaved);
      }

      return nextItems;
    } catch (error) {
      if (cached.length && canUseCache) {
        setItems(cached);
        return cached;
      }
      throw error;
    } finally {
      setLoading(false);
    }
  }, [persistSavedItems]);

  const createReport = useCallback(async (report) => {
    const data = await itemService.createReport(report);
    await loadLatest();
    return data;
  }, [loadLatest]);

  const updateReport = useCallback(async (id, patch) => {
    const data = await itemService.updateReport(id, patch);
    await loadLatest();
    return data;
  }, [loadLatest]);

  const searchReports = useCallback(async (filters) => {
    const data = await itemService.searchReports(filters);
    return data.items || [];
  }, []);

  const getMatchesFor = useCallback(async (item) => {
    const data = await itemService.getPotentialMatches(item._id);
    if (data?.matches?.length) {
      return data.matches;
    }

    // Fallback local matching if backend matching endpoint is unavailable.
    return matchingService.findPotentialMatches(item, items);
  }, [items]);

  const markRecovered = useCallback(async (id) => {
    const data = await itemService.markRecovered(id);
    await loadLatest();
    return data;
  }, [loadLatest]);

  const flagReport = useCallback(async (id, reason) => {
    const data = await itemService.flagReport(id, reason);
    await loadLatest();
    return data;
  }, [loadLatest]);

  const deleteReport = useCallback(async (id) => {
    const data = await itemService.deleteReport(id);
    await loadLatest();
    return data;
  }, [loadLatest]);

  const reviewFlaggedReport = useCallback(async (id, action, note) => {
    const data = await itemService.reviewFlaggedReport(id, action, note);
    await loadLatest();
    return data;
  }, [loadLatest]);

  const reviewItemApproval = useCallback(async (id, action, note) => {
    const data = await itemService.reviewItemApproval(id, action, note);
    await loadLatest();
    return data;
  }, [loadLatest]);

  const requestClaim = useCallback(async (id, payload) => {
    const data = await itemService.requestClaim(id, payload);
    await loadLatest();
    return data;
  }, [loadLatest]);

  const reviewClaim = useCallback(async (id, payload) => {
    const data = await itemService.reviewClaim(id, payload);
    await loadLatest();
    return data;
  }, [loadLatest]);

  const getClaimContact = useCallback(async (id) => {
    const data = await itemService.getClaimContact(id);
    return data;
  }, []);

  const value = useMemo(
    () => ({
      items,
      savedItems,
      loading,
      loadLatest,
      createReport,
      updateReport,
      searchReports,
      getMatchesFor,
      markRecovered,
      flagReport,
      deleteReport,
      reviewFlaggedReport,
      reviewItemApproval,
      requestClaim,
      reviewClaim,
      getClaimContact,
      toggleSavedItem,
      isItemSaved,
      clearSavedItems,
      recordViewedItem,
      getFlaggedReports: itemService.getFlaggedReports,
      getPendingApprovalReports: itemService.getPendingApprovalReports,
      getPendingClaimReports: itemService.getPendingClaimReports,
      getAdminStats: itemService.getAdminStats,
    }),
    [
      items,
      savedItems,
      loading,
      loadLatest,
      createReport,
      updateReport,
      searchReports,
      getMatchesFor,
      markRecovered,
      flagReport,
      deleteReport,
      reviewFlaggedReport,
      reviewItemApproval,
      requestClaim,
      reviewClaim,
      getClaimContact,
      toggleSavedItem,
      isItemSaved,
      clearSavedItems,
      recordViewedItem,
    ]
  );

  return <ItemsContext.Provider value={value}>{children}</ItemsContext.Provider>;
};

export const useItems = () => {
  const ctx = useContext(ItemsContext);
  if (!ctx) {
    throw new Error('useItems must be used inside ItemsProvider');
  }
  return ctx;
};
