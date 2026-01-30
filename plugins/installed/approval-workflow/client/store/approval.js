/**
 * Approval Workflow Vuex Store Module
 */

export default {
  namespaced: true,

  state: {
    stats: {
      pending: 0,
      approved: 0,
      rejected: 0,
      total: 0
    },
    approvals: [],
    loading: false,
    lastFetched: null
  },

  getters: {
    pendingCount: state => state.stats.pending,
    approvedCount: state => state.stats.approved,
    rejectedCount: state => state.stats.rejected,
    totalCount: state => state.stats.total,
    allApprovals: state => state.approvals,
    isLoading: state => state.loading,
    needsRefresh: state => {
      if (!state.lastFetched) return true
      const fiveMinutes = 5 * 60 * 1000
      return (Date.now() - state.lastFetched) > fiveMinutes
    }
  },

  mutations: {
    SET_STATS(state, stats) {
      state.stats = stats
    },

    SET_APPROVALS(state, approvals) {
      state.approvals = approvals
    },

    SET_LOADING(state, loading) {
      state.loading = loading
    },

    SET_LAST_FETCHED(state, timestamp) {
      state.lastFetched = timestamp
    },

    UPDATE_APPROVAL(state, updatedApproval) {
      const index = state.approvals.findIndex(a => a.id === updatedApproval.id)
      if (index >= 0) {
        state.approvals.splice(index, 1, updatedApproval)
      }
    },

    REMOVE_APPROVAL(state, approvalId) {
      state.approvals = state.approvals.filter(a => a.id !== approvalId)
    }
  },

  actions: {
    async fetchStats({ commit }) {
      try {
        const response = await fetch('/api/plugin/approval-workflow/stats')
        const data = await response.json()

        if (data.stats) {
          commit('SET_STATS', data.stats)
          commit('SET_LAST_FETCHED', Date.now())
        }
      } catch (err) {
        console.error('[Approval Store] Failed to fetch stats:', err)
      }
    },

    async fetchApprovals({ commit }, { status, limit = 50, offset = 0 } = {}) {
      try {
        commit('SET_LOADING', true)

        let url = `/api/plugin/approval-workflow/approvals?limit=${limit}&offset=${offset}`
        if (status) {
          url += `&status=${status}`
        }

        const response = await fetch(url)
        const data = await response.json()

        if (data.approvals) {
          commit('SET_APPROVALS', data.approvals)
          commit('SET_LAST_FETCHED', Date.now())
        }
      } catch (err) {
        console.error('[Approval Store] Failed to fetch approvals:', err)
      } finally {
        commit('SET_LOADING', false)
      }
    },

    async approveRequest({ commit, dispatch }, { id, notes }) {
      try {
        const response = await fetch(`/api/plugin/approval-workflow/approvals/${id}/approve`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({ notes })
        })

        const data = await response.json()

        if (data.success && data.approval) {
          commit('UPDATE_APPROVAL', data.approval)
          await dispatch('fetchStats')
          return { success: true, approval: data.approval }
        } else {
          throw new Error(data.message || 'Failed to approve request')
        }
      } catch (err) {
        console.error('[Approval Store] Failed to approve:', err)
        return { success: false, error: err.message }
      }
    },

    async rejectRequest({ commit, dispatch }, { id, notes }) {
      try {
        const response = await fetch(`/api/plugin/approval-workflow/approvals/${id}/reject`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({ notes })
        })

        const data = await response.json()

        if (data.success && data.approval) {
          commit('UPDATE_APPROVAL', data.approval)
          await dispatch('fetchStats')
          return { success: true, approval: data.approval }
        } else {
          throw new Error(data.message || 'Failed to reject request')
        }
      } catch (err) {
        console.error('[Approval Store] Failed to reject:', err)
        return { success: false, error: err.message }
      }
    }
  }
}
