import apiClient from './apiClient';

export const itemService = {
  async createReport(report) {
    const { data } = await apiClient.post('/items', report);
    return data;
  },

  async updateReport(id, patch) {
    const { data } = await apiClient.put(`/items/${id}`, patch);
    return data;
  },

  async getLatestReports(params = {}) {
    const { data } = await apiClient.get('/items', { params });
    return data;
  },

  async searchReports(filters = {}) {
    const { data } = await apiClient.get('/items', { params: filters });
    return data;
  },

  async getById(id) {
    const { data } = await apiClient.get(`/items/${id}`);
    return data;
  },

  async getFlaggedReports(params = {}) {
    const { data } = await apiClient.get('/items/flagged/list', { params });
    return data;
  },

  async getPendingApprovalReports(params = {}) {
    try {
      const { data } = await apiClient.get('/items/approval/pending', { params });
      return data;
    } catch (error) {
      if (error?.response?.status !== 404) {
        throw error;
      }

      // Backward-compatible fallback for older backend deployments
      // that do not yet expose /items/approval/pending.
      const { data } = await apiClient.get('/items', { params });
      const items = Array.isArray(data?.items) ? data.items : [];
      const pendingItems = items.filter((item) => String(item?.approvalStatus || '').toLowerCase() === 'pending');
      return {
        items: pendingItems,
        pagination: data?.pagination || {
          page: 1,
          limit: pendingItems.length,
          total: pendingItems.length,
          totalPages: 1,
        },
      };
    }
  },

  async getPendingClaimReports(params = {}) {
    try {
      const { data } = await apiClient.get('/items/claims/pending', { params });
      return data;
    } catch (error) {
      if (error?.response?.status !== 404) {
        throw error;
      }

      // Backward-compatible fallback for older backend deployments.
      const { data } = await apiClient.get('/items', { params });
      const items = Array.isArray(data?.items) ? data.items : [];
      const pendingItems = items.filter((item) => String(item?.claim?.status || '').toLowerCase() === 'pending');
      return {
        items: pendingItems,
        pagination: data?.pagination || {
          page: 1,
          limit: pendingItems.length,
          total: pendingItems.length,
          totalPages: 1,
        },
      };
    }
  },

  async getAdminStats() {
    const { data } = await apiClient.get('/items/admin/stats');
    return data;
  },

  async reviewFlaggedReport(id, action, note = '') {
    const { data } = await apiClient.patch(`/items/${id}/review`, { action, note });
    return data;
  },

  async reviewItemApproval(id, action, note = '') {
    const { data } = await apiClient.patch(`/items/${id}/approval`, { action, note });
    return data;
  },

  async flagReport(id, reason) {
    const { data } = await apiClient.patch(`/items/${id}/flag`, { reason });
    return data;
  },

  async markRecovered(id) {
    const { data } = await apiClient.patch(`/items/${id}/recovered`);
    return data;
  },

  async deleteReport(id) {
    const { data } = await apiClient.delete(`/items/${id}`);
    return data;
  },

  async getPotentialMatches(id) {
    const { data } = await apiClient.get(`/items/${id}/matches`);
    return data;
  },

  async requestClaim(id, payload) {
    const { data } = await apiClient.post(`/items/${id}/claim`, payload);
    return data;
  },

  async reviewClaim(id, payload) {
    const { data } = await apiClient.patch(`/items/${id}/claim/review`, payload);
    return data;
  },

  async getClaimContact(id) {
    const { data } = await apiClient.get(`/items/${id}/claim/contact`);
    return data;
  },
};
