<template lang="pug">
v-container(fluid, grid-list-lg)
  v-layout(row, wrap)
    v-flex(xs12)
      .admin-header
        v-icon.admin-header-icon mdi-check-circle
        .admin-header-title
          .headline.primary--text Approval Requests
          .subtitle-1.grey--text Manage page change approval requests

      v-card.mt-3
        v-toolbar(color="primary", dark, dense, flat)
          v-toolbar-title Approval Queue
          v-spacer
          v-btn-toggle(v-model="filterStatus", mandatory, dense)
            v-btn(value="all", small) All
            v-btn(value="pending", small) Pending
            v-btn(value="approved", small) Approved
            v-btn(value="rejected", small) Rejected

        v-card-text
          v-data-table(
            :headers="headers"
            :items="approvals"
            :loading="loading"
            :server-items-length="total"
            :options.sync="options"
            :footer-props="{ itemsPerPageOptions: [10, 25, 50] }"
          )
            template(v-slot:item.status="{ item }")
              v-chip(
                small
                :color="getStatusColor(item.status)"
                dark
              ) {{ item.status }}

            template(v-slot:item.isNew="{ item }")
              v-icon(v-if="item.isNew", small, color="green") mdi-file-plus
              v-icon(v-else, small, color="blue") mdi-file-edit

            template(v-slot:item.requestedAt="{ item }")
              | {{ formatDate(item.requestedAt) }}

            template(v-slot:item.actions="{ item }")
              v-btn(
                v-if="item.status === 'pending'"
                small
                color="success"
                @click="approveRequest(item)"
                :loading="item.approving"
              )
                v-icon(small, left) mdi-check
                | Approve

              v-btn(
                v-if="item.status === 'pending'"
                small
                color="error"
                class="ml-2"
                @click="rejectRequest(item)"
                :loading="item.rejecting"
              )
                v-icon(small, left) mdi-close
                | Reject

              v-btn(
                v-if="item.status !== 'pending'"
                small
                text
                @click="viewDetails(item)"
              )
                v-icon(small) mdi-eye
                | View

  v-dialog(v-model="detailsDialog", max-width="600")
    v-card(v-if="selectedApproval")
      v-card-title {{ selectedApproval.pageTitle }}
      v-card-text
        v-simple-table
          tbody
            tr
              td.font-weight-bold Status
              td
                v-chip(
                  small
                  :color="getStatusColor(selectedApproval.status)"
                  dark
                ) {{ selectedApproval.status }}
            tr
              td.font-weight-bold Type
              td {{ selectedApproval.isNew ? 'New Page' : 'Page Edit' }}
            tr
              td.font-weight-bold Page Path
              td {{ selectedApproval.pagePath }}
            tr
              td.font-weight-bold Requested By
              td {{ selectedApproval.requesterName }}
            tr
              td.font-weight-bold Requested At
              td {{ formatDate(selectedApproval.requestedAt) }}
            tr(v-if="selectedApproval.approverName")
              td.font-weight-bold Reviewed By
              td {{ selectedApproval.approverName }}
            tr(v-if="selectedApproval.reviewedAt")
              td.font-weight-bold Reviewed At
              td {{ formatDate(selectedApproval.reviewedAt) }}
            tr(v-if="selectedApproval.approverNotes")
              td.font-weight-bold Notes
              td {{ selectedApproval.approverNotes }}
      v-card-actions
        v-spacer
        v-btn(text, @click="detailsDialog = false") Close
</template>

<script>
export default {
  name: 'AdminApprovals',
  data() {
    return {
      approvals: [],
      loading: false,
      total: 0,
      filterStatus: 'all',
      options: {
        page: 1,
        itemsPerPage: 25
      },
      headers: [
        { text: 'Type', value: 'isNew', width: 80, sortable: false },
        { text: 'Page Title', value: 'pageTitle' },
        { text: 'Requester', value: 'requesterName' },
        { text: 'Status', value: 'status', width: 120 },
        { text: 'Requested', value: 'requestedAt', width: 180 },
        { text: 'Actions', value: 'actions', width: 200, sortable: false }
      ],
      detailsDialog: false,
      selectedApproval: null
    }
  },
  watch: {
    options: {
      handler() {
        this.fetchApprovals()
      },
      deep: true
    },
    filterStatus() {
      this.fetchApprovals()
    }
  },
  mounted() {
    this.fetchApprovals()
  },
  methods: {
    async fetchApprovals() {
      try {
        this.loading = true

        const { page, itemsPerPage } = this.options
        const offset = (page - 1) * itemsPerPage

        let url = `/api/plugin/approval-workflow/approvals?limit=${itemsPerPage}&offset=${offset}`

        if (this.filterStatus !== 'all') {
          url += `&status=${this.filterStatus}`
        }

        const response = await fetch(url)
        const data = await response.json()

        this.approvals = data.approvals || []
        this.total = data.total || 0
      } catch (err) {
        console.error('[AdminApprovals] Failed to fetch approvals:', err)
        this.$store.commit('showNotification', {
          message: 'Failed to load approval requests',
          style: 'error',
          icon: 'mdi-alert'
        })
      } finally {
        this.loading = false
      }
    },

    async approveRequest(approval) {
      try {
        this.$set(approval, 'approving', true)

        const response = await fetch(`/api/plugin/approval-workflow/approvals/${approval.id}/approve`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            userId: this.$store.get('user/id'),
            userName: this.$store.get('user/name')
          })
        })

        const data = await response.json()

        if (data.success) {
          this.$store.commit('showNotification', {
            message: 'Approval request approved',
            style: 'success',
            icon: 'mdi-check'
          })
          this.fetchApprovals()
        } else {
          throw new Error(data.message || 'Failed to approve request')
        }
      } catch (err) {
        console.error('[AdminApprovals] Failed to approve:', err)
        this.$store.commit('showNotification', {
          message: err.message,
          style: 'error',
          icon: 'mdi-alert'
        })
      } finally {
        this.$set(approval, 'approving', false)
      }
    },

    async rejectRequest(approval) {
      try {
        this.$set(approval, 'rejecting', true)

        const response = await fetch(`/api/plugin/approval-workflow/approvals/${approval.id}/reject`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            userId: this.$store.get('user/id'),
            userName: this.$store.get('user/name')
          })
        })

        const data = await response.json()

        if (data.success) {
          this.$store.commit('showNotification', {
            message: 'Approval request rejected',
            style: 'warning',
            icon: 'mdi-close'
          })
          this.fetchApprovals()
        } else {
          throw new Error(data.message || 'Failed to reject request')
        }
      } catch (err) {
        console.error('[AdminApprovals] Failed to reject:', err)
        this.$store.commit('showNotification', {
          message: err.message,
          style: 'error',
          icon: 'mdi-alert'
        })
      } finally {
        this.$set(approval, 'rejecting', false)
      }
    },

    viewDetails(approval) {
      this.selectedApproval = approval
      this.detailsDialog = true
    },

    getStatusColor(status) {
      const colors = {
        pending: 'orange',
        approved: 'green',
        rejected: 'red'
      }
      return colors[status] || 'grey'
    },

    formatDate(dateString) {
      if (!dateString) return '-'
      const date = new Date(dateString)
      return date.toLocaleString()
    }
  }
}
</script>

<style scoped>
.admin-header {
  display: flex;
  align-items: center;
  margin-bottom: 1rem;
}

.admin-header-icon {
  font-size: 2.5rem;
  margin-right: 1rem;
}

.admin-header-title {
  flex: 1;
}
</style>
