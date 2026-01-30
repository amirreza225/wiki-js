<template>
  <v-btn
    text
    color="purple"
    @click="showMessage"
    class="ml-2"
  >
    <v-icon left>mdi-puzzle</v-icon>
    <span v-if="$vuetify.breakpoint.lgAndUp">{{ buttonText }}</span>
  </v-btn>
</template>

<script>
export default {
  name: 'TestButton',
  // No need to specify components - Vuetify components are globally registered
  computed: {
    buttonText() {
      // Access plugin config if available
      return 'Test Plugin'
    }
  },
  methods: {
    showMessage() {
      // Show a notification
      this.$store.commit('showNotification', {
        message: 'Hello from the Test Plugin! The plugin system is working! 🎉',
        style: 'success'
      })

      console.log('[Test Plugin] Button clicked!')
    }
  }
}
</script>

<style scoped>
/* Plugin-specific styles */
</style>
