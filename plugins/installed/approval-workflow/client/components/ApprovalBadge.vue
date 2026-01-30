<template>
  <div>
    <v-menu
      offset-y
      bottom
      left
      min-width="300"
    >
      <template #activator="{ on, attrs }">
        <v-btn
          icon
          v-bind="attrs"
          v-on="on"
          :class="badgeClass"
        >
          <v-badge
            :content="pendingCount"
            :value="pendingCount > 0"
            color="red"
            overlap
          >
            <v-icon color="grey">
              mdi-check-circle-outline
            </v-icon>
          </v-badge>
        </v-btn>
      </template>
      <v-list
        nav
        dense
      >
        <v-list-item three-line>
          <v-list-item-content>
            <v-list-item-title class="font-weight-bold">
              Approval Requests
            </v-list-item-title>
            <v-list-item-subtitle>{{ stats.pending }} pending</v-list-item-subtitle>
            <v-list-item-subtitle>{{ stats.approved }} approved, {{ stats.rejected }} rejected</v-list-item-subtitle>
          </v-list-item-content>
        </v-list-item>
        <v-divider />
        <v-list-item
          v-if="stats.pending > 0"
          :to="'/a/plugin/approval-workflow/approvals'"
          color="primary"
        >
          <v-list-item-avatar size="24">
            <v-icon>mdi-clipboard-check-outline</v-icon>
          </v-list-item-avatar>
          <v-list-item-content>
            <v-list-item-title>View All Requests</v-list-item-title>
          </v-list-item-content>
        </v-list-item>
        <v-list-item
          v-else
          disabled
        >
          <v-list-item-content>
            <v-list-item-title class="grey--text">
              No pending requests
            </v-list-item-title>
          </v-list-item-content>
        </v-list-item>
      </v-list>
    </v-menu>
  </div>
</template>

<script>
export default {
  name: 'ApprovalBadge',
  data() {
    return {
      stats: {
        pending: 0,
        approved: 0,
        rejected: 0,
        total: 0
      },
      loading: false
    }
  },
  computed: {
    pendingCount() {
      return this.stats.pending
    },
    badgeClass() {
      return this.pendingCount > 0 ? 'pulse' : ''
    }
  },
  async mounted() {
    await this.fetchStats()

    // Refresh stats every 30 seconds
    this.statsInterval = setInterval(() => {
      this.fetchStats()
    }, 30000)
  },
  beforeDestroy() {
    if (this.statsInterval) {
      clearInterval(this.statsInterval)
    }
  },
  methods: {
    async fetchStats() {
      try {
        this.loading = true

        const response = await fetch('/api/plugin/approval-workflow/stats')
        const data = await response.json()

        if (data.stats) {
          this.stats = data.stats
        }
      } catch (err) {
        console.error('[ApprovalBadge] Failed to fetch stats:', err)
      } finally {
        this.loading = false
      }
    }
  }
}
</script>

<style scoped>
.pulse {
  animation: pulse 2s infinite;
}

@keyframes pulse {
  0%, 100% {
    opacity: 1;
  }
  50% {
    opacity: 0.5;
  }
}
</style>
