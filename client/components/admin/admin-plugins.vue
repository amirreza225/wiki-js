<template lang='pug'>
  v-container(fluid, grid-list-lg)
    v-layout(row wrap)
      v-flex(xs12)
        .admin-header
          img.animated.fadeInUp(src='/_assets/svg/icon-cube.svg', alt='Plugins', style='width: 80px;')
          .admin-header-title
            .headline.primary--text.animated.fadeInLeft Plugins
            .subtitle-1.grey--text.animated.fadeInLeft Extend Wiki.js with additional functionality
        v-card.mt-3
          v-toolbar(color='primary', dark, dense, flat)
            v-toolbar-title Installed Plugins
            v-spacer
            v-btn(color='success', @click='showInstallDialog', :disabled='loading')
              v-icon(left) mdi-plus-circle
              span Install Plugin
            v-btn(icon, @click='refresh')
              v-icon mdi-refresh
          v-data-table(
            :headers='headers'
            :items='plugins'
            :loading='loading'
            hide-default-footer
            :items-per-page='-1'
          )
            template(v-slot:item.name='{ item }')
              v-list-item(two-line, dense)
                v-list-item-content
                  v-list-item-title.font-weight-bold {{ item.name }}
                  v-list-item-subtitle {{ item.id }} v{{ item.version }}
            template(v-slot:item.description='{ item }')
              span.caption {{ item.description || 'No description' }}
            template(v-slot:item.status='{ item }')
              v-chip(
                label
                small
                :color='getStatusColor(item.status)'
                dark
              ) {{ item.status }}
            template(v-slot:item.isEnabled='{ item }')
              v-switch(
                v-model='item.isEnabled'
                @change='togglePlugin(item)'
                :disabled='loading'
                color='success'
                hide-details
              )
            template(v-slot:item.actions='{ item }')
              v-menu(offset-y, left)
                template(v-slot:activator='{ on }')
                  v-btn(icon, v-on='on')
                    v-icon mdi-dots-vertical
                v-list(dense)
                  v-list-item(@click='configurePlugin(item)')
                    v-list-item-icon: v-icon mdi-cog
                    v-list-item-title Configure
                  v-list-item(@click='viewLogs(item)')
                    v-list-item-icon: v-icon mdi-text-box-outline
                    v-list-item-title View Logs
                  v-list-item(@click='uninstallPlugin(item)', :disabled='item.isEnabled')
                    v-list-item-icon: v-icon mdi-delete
                    v-list-item-title Uninstall

          v-card-text.pa-4(v-if='plugins.length === 0')
            v-alert(type='info', text)
              | No plugins installed. Plugins should be placed in the
              code /plugins/installed/
              |  directory.

    //- Config Dialog
    v-dialog(v-model='configDialog', max-width='800', scrollable)
      v-card(v-if='selectedPlugin')
        v-toolbar(color='primary', dark, dense, flat)
          v-toolbar-title Configure {{ selectedPlugin.name }}
          v-spacer
          v-btn(icon, @click='configDialog = false')
            v-icon mdi-close
        v-card-text.pt-4
          v-alert(type='info', text, v-if='!configSchema || Object.keys(configSchema).length === 0')
            | This plugin does not have any configurable options.
          v-form(ref='configForm', v-else)
            div(v-for='(field, key) in configSchema', :key='key')
              //- Boolean fields
              v-switch(
                v-if='field.type === "boolean"'
                v-model='configValues[key]'
                :label='field.title'
                :hint='field.hint'
                persistent-hint
                color='primary'
                class='mb-4'
              )
              //- String fields
              v-text-field(
                v-else-if='field.type === "string"'
                v-model='configValues[key]'
                :label='field.title'
                :hint='field.hint'
                persistent-hint
                outlined
                dense
                class='mb-4'
              )
              //- Number fields
              v-text-field(
                v-else-if='field.type === "number"'
                v-model.number='configValues[key]'
                :label='field.title'
                :hint='field.hint'
                persistent-hint
                outlined
                dense
                type='number'
                class='mb-4'
              )
              //- Select/dropdown fields
              v-select(
                v-else-if='field.type === "select"'
                v-model='configValues[key]'
                :label='field.title'
                :hint='field.hint'
                :items='field.options || []'
                persistent-hint
                outlined
                dense
                class='mb-4'
              )
              //- Textarea fields
              v-textarea(
                v-else-if='field.type === "textarea"'
                v-model='configValues[key]'
                :label='field.title'
                :hint='field.hint'
                persistent-hint
                outlined
                dense
                rows='3'
                class='mb-4'
              )
        v-card-actions
          v-spacer
          v-btn(text, @click='configDialog = false') Cancel
          v-btn(color='primary', @click='saveConfig', :loading='saving') Save

    //- Logs Dialog
    v-dialog(v-model='logsDialog', max-width='1400', fullscreen)
      v-card(v-if='selectedPlugin')
        v-toolbar(color='primary', dark, flat)
          v-icon(large, left) mdi-math-log
          v-toolbar-title
            .title Plugin Logs: {{ selectedPlugin.name }}
            .caption {{ filteredLogs.length }} log entries
          v-spacer
          v-text-field(
            v-model='logSearchQuery'
            append-icon='mdi-magnify'
            label='Search logs...'
            single-line
            hide-details
            dense
            dark
            clearable
            style='max-width: 300px'
            class='mr-4'
          )
          v-btn-toggle(v-model='logLevelFilter', mandatory, dense, dark, class='mr-2')
            v-btn(small, value='all')
              v-icon(small, left) mdi-filter-variant
              span All
            v-btn(small, value='debug')
              v-icon(small, left) mdi-bug
              span Debug
            v-btn(small, value='info')
              v-icon(small, left) mdi-information
              span Info
            v-btn(small, value='warn')
              v-icon(small, left) mdi-alert
              span Warn
            v-btn(small, value='error')
              v-icon(small, left) mdi-alert-circle
              span Error
          v-menu(offset-y, left)
            template(v-slot:activator='{ on }')
              v-btn(icon, v-on='on', dark)
                v-icon mdi-dots-vertical
            v-list(dense)
              v-list-item(@click='exportLogs')
                v-list-item-icon: v-icon mdi-download
                v-list-item-title Export as JSON
              v-list-item(@click='clearLogs', :disabled='clearingLogs')
                v-list-item-icon: v-icon mdi-delete-sweep
                v-list-item-title Clear All Logs
          v-btn(icon, @click='logsDialog = false', dark)
            v-icon mdi-close

        v-card-text.pa-0
          v-alert(type='info', text, v-if='searchedLogs.length === 0', class='ma-4')
            span(v-if='logSearchQuery') No logs match your search query
            span(v-else) No logs recorded

          v-data-table(
            v-else
            :headers='logHeaders'
            :items='searchedLogs'
            :items-per-page='50'
            :footer-props='{ itemsPerPageOptions: [25, 50, 100, 500] }'
            dense
            class='log-table'
          )
            template(v-slot:item.level='{ item }')
              v-chip(
                x-small
                :color='getLogColor(item.level)'
                dark
                label
              )
                v-icon(x-small, left, v-text='getLogIcon(item.level)')
                span(v-text='item.level.toUpperCase()')

            template(v-slot:item.createdAt='{ item }')
              .caption
                div {{ item.createdAt | moment('YYYY-MM-DD HH:mm:ss') }}
                div.grey--text {{ item.createdAt | moment('from') }}

            template(v-slot:item.context='{ item }')
              code.caption(v-text='item.context')

            template(v-slot:item.message='{ item }')
              .log-message(v-text='item.message')
              v-expansion-panels(v-if='item.stackTrace', flat, class='mt-2')
                v-expansion-panel
                  v-expansion-panel-header.py-0.px-2
                    .caption.error--text
                      v-icon(small, color='error', left) mdi-code-tags
                      span Stack Trace
                  v-expansion-panel-content
                    .stack-trace-container
                      v-btn(
                        x-small
                        text
                        @click='copyToClipboard(item.stackTrace)'
                        class='mb-2'
                      )
                        v-icon(x-small, left) mdi-content-copy
                        span Copy
                      pre.stack-trace(v-text='item.stackTrace')

            template(v-slot:item.id='{ item }')
              code.caption.grey--text {{ '#' + item.id }}

    //- Uninstall Confirmation Dialog
    v-dialog(v-model='uninstallDialog', max-width='600')
      v-card(v-if='selectedPlugin')
        v-toolbar(color='error', dark, dense, flat)
          v-toolbar-title Uninstall {{ selectedPlugin.name }}
          v-spacer
          v-btn(icon, @click='uninstallDialog = false')
            v-icon mdi-close
        v-card-text.pt-4
          v-alert(type='warning', text)
            .body-2 You are about to uninstall
              strong  {{ selectedPlugin.name }} v{{ selectedPlugin.version }}
            .body-2.mt-2 This action will:
            ul.mt-2
              li Remove all plugin files from the server
              li Delete plugin database entries
              li Remove plugin permissions
            .body-2.mt-3.error--text This action cannot be undone.
          v-alert(type='error', text, v-if='selectedPlugin.isEnabled')
            | You must deactivate this plugin before uninstalling it.
        v-card-actions
          v-spacer
          v-btn(text, @click='uninstallDialog = false') Cancel
          v-btn(
            color='error'
            @click='confirmUninstall'
            :loading='uninstalling'
            :disabled='selectedPlugin.isEnabled'
          ) Uninstall

    //- Install Dialog
    v-dialog(v-model='installDialog', max-width='600', persistent)
      v-card
        v-toolbar(color='primary', dark, dense, flat)
          v-toolbar-title Install Plugin from ZIP
          v-spacer
          v-btn(icon, @click='closeInstallDialog', :disabled='uploading')
            v-icon mdi-close

        v-card-text.pt-4
          v-alert(type='info', text, v-if='!uploadFile && !installSuccess')
            .body-2 Upload a plugin ZIP file to install it on this Wiki.js instance.
            .body-2.mt-2 Requirements:
            ul.mt-2
              li Valid plugin.yml manifest
              li Compatible with this Wiki.js version
              li Maximum size: 50 MB

          //- File Upload Input
          div(v-if='!uploadFile && !installSuccess')
            v-file-input(
              v-model='uploadFile'
              accept='.zip,application/zip,application/x-zip-compressed'
              placeholder='Select plugin ZIP file'
              prepend-icon='mdi-zip-box'
              outlined
              show-size
              @change='validateFile'
              :error-messages='uploadError'
            )
              template(v-slot:selection='{ text }')
                v-chip(small, label, color='primary')
                  v-icon(small, left) mdi-file-check
                  span {{ text }}

          //- Upload in Progress
          div(v-else-if='uploading')
            v-progress-linear(
              :value='uploadProgress'
              height='25'
              striped
              color='primary'
            )
              template(v-slot:default='{ value }')
                strong {{ Math.ceil(value) }}%
            .text-center.mt-2.body-2 Installing plugin...
            .text-center.caption.grey--text Please wait, this may take a few moments

          //- Success Message
          v-alert(type='success', text, v-if='installSuccess')
            v-icon(large, color='success', left) mdi-check-circle
            .body-2 Plugin installed successfully!
            .body-2.mt-2 You can now activate it from the plugins list.

          //- Error Message
          v-alert(type='error', text, v-if='installError')
            v-icon(color='error', left) mdi-alert-circle
            .body-2 Installation failed: {{ installError }}

        v-card-actions
          v-spacer
          v-btn(text, @click='closeInstallDialog', :disabled='uploading') Cancel
          v-btn(
            color='primary'
            @click='uploadPlugin'
            :disabled='!uploadFile || uploading || installSuccess || !!uploadError'
            :loading='uploading'
          ) Install

    //- Restart Overlay
    v-overlay(:value='restartOverlay', z-index='9999', opacity='0.95')
      v-container(fill-height, fluid)
        v-row(align='center', justify='center')
          v-col(cols='12', class='text-center')
            v-progress-circular(
              :size='120'
              :width='8'
              color='primary'
              indeterminate
            )
            .display-1.white--text.mt-8 Restarting Server...
            .subtitle-1.white--text.mt-4 Please wait while the server restarts
            .caption.white--text.mt-2.grey--text.text--lighten-1 This will take a few seconds
</template>

<script>
import gql from 'graphql-tag'
import Cookies from 'js-cookie'

export default {
  data() {
    return {
      loading: false,
      saving: false,
      uninstalling: false,
      clearingLogs: false,
      plugins: [],
      configDialog: false,
      logsDialog: false,
      uninstallDialog: false,
      installDialog: false,
      uploadFile: null,
      uploading: false,
      uploadProgress: 0,
      installSuccess: false,
      installError: null,
      uploadError: null,
      selectedPlugin: null,
      pluginLogs: [],
      logLevelFilter: 'all',
      logSearchQuery: '',
      configSchema: {},
      configValues: {},
      restartOverlay: false,
      restartCheckInterval: null,
      restartPluginId: null,
      restartExpectedState: null,
      headers: [
        { text: 'Plugin', value: 'name', sortable: true, width: '250px' },
        { text: 'Description', value: 'description', sortable: false },
        { text: 'Status', value: 'status', sortable: true, width: '120px', align: 'center' },
        { text: 'Enabled', value: 'isEnabled', sortable: true, width: '100px', align: 'center' },
        { text: 'Actions', value: 'actions', sortable: false, width: '80px', align: 'center' }
      ],
      logHeaders: [
        { text: 'ID', value: 'id', sortable: true, width: '80px' },
        { text: 'Level', value: 'level', sortable: true, width: '100px' },
        { text: 'Timestamp', value: 'createdAt', sortable: true, width: '180px' },
        { text: 'Context', value: 'context', sortable: true, width: '150px' },
        { text: 'Message', value: 'message', sortable: false }
      ]
    }
  },
  computed: {
    filteredLogs() {
      if (this.logLevelFilter === 'all') {
        return this.pluginLogs
      }
      return this.pluginLogs.filter(log => log.level === this.logLevelFilter)
    },
    searchedLogs() {
      if (!this.logSearchQuery) {
        return this.filteredLogs
      }
      const query = this.logSearchQuery.toLowerCase()
      return this.filteredLogs.filter(log => {
        return (
          (log.message && log.message.toLowerCase().includes(query)) ||
          (log.context && log.context.toLowerCase().includes(query)) ||
          (log.stackTrace && log.stackTrace.toLowerCase().includes(query)) ||
          (log.level && log.level.toLowerCase().includes(query))
        )
      })
    }
  },
  mounted() {
    this.loadPlugins()
  },
  methods: {
    async loadPlugins() {
      this.loading = true
      try {
        const response = await this.$apollo.query({
          query: gql`
            query {
              plugins {
                list {
                  id
                  name
                  version
                  description
                  author
                  license
                  homepage
                  keywords
                  permissions
                  isEnabled
                  isInstalled
                  status
                  state
                  installedAt
                  updatedAt
                  config
                }
              }
            }
          `,
          fetchPolicy: 'network-only'
        })
        this.plugins = response.data.plugins.list || []
      } catch (err) {
        this.$store.commit('showNotification', {
          message: 'Failed to load plugins: ' + err.message,
          style: 'error'
        })
      }
      this.loading = false
    },
    async refresh() {
      await this.loadPlugins()
      this.$store.commit('showNotification', {
        message: 'Plugins refreshed',
        style: 'success'
      })
    },
    async togglePlugin(plugin) {
      this.loading = true
      try {
        const mutation = plugin.isEnabled ? 'activate' : 'deactivate'
        const response = await this.$apollo.mutate({
          mutation: gql`
            mutation($id: String!) {
              plugins {
                ${mutation}(id: $id) {
                  responseResult {
                    succeeded
                    errorCode
                    slug
                    message
                  }
                  requiresRestart
                  restartReasons
                }
              }
            }
          `,
          variables: {
            id: plugin.id
          }
        })

        const result = response.data.plugins[mutation]

        if (result.responseResult.succeeded) {
          this.$store.commit('showNotification', {
            message: result.responseResult.message,
            style: 'success'
          })

          if (result.requiresRestart) {
            // Show restart overlay
            this.restartOverlay = true
            this.restartPluginId = plugin.id
            this.restartExpectedState = plugin.isEnabled

            // Wait a moment for the overlay to appear
            await new Promise(resolve => setTimeout(resolve, 500))

            // Start polling for server restart completion
            this.startRestartPolling()
          } else {
            await this.loadPlugins()
          }
        } else {
          throw new Error(result.responseResult.message)
        }
      } catch (err) {
        // Revert toggle on error
        plugin.isEnabled = !plugin.isEnabled
        this.$store.commit('showNotification', {
          message: 'Failed to toggle plugin: ' + err.message,
          style: 'error'
        })
      }
      this.loading = false
    },
    configurePlugin(plugin) {
      this.selectedPlugin = plugin

      // Extract config schema from plugin config
      this.configSchema = {}
      this.configValues = {}

      if (plugin.config && plugin.config.schema) {
        this.configSchema = plugin.config.schema

        // Initialize config values with defaults or current values
        for (const key in this.configSchema) {
          const field = this.configSchema[key]

          // Use current value if exists, otherwise use default
          if (plugin.config && plugin.config[key] !== undefined) {
            this.configValues[key] = plugin.config[key]
          } else if (field.default !== undefined) {
            this.configValues[key] = field.default
          } else {
            // Set type-appropriate default
            switch (field.type) {
              case 'boolean':
                this.configValues[key] = false
                break
              case 'number':
                this.configValues[key] = 0
                break
              default:
                this.configValues[key] = ''
            }
          }
        }
      }

      this.configDialog = true
    },
    async viewLogs(plugin) {
      this.selectedPlugin = plugin
      this.loading = true
      this.logLevelFilter = 'all'
      try {
        const response = await this.$apollo.query({
          query: gql`
            query($pluginId: String!) {
              plugins {
                logs(pluginId: $pluginId) {
                  id
                  level
                  context
                  message
                  stackTrace
                  createdAt
                  resolved
                }
              }
            }
          `,
          variables: {
            pluginId: plugin.id
          },
          fetchPolicy: 'network-only'
        })
        this.pluginLogs = response.data.plugins.logs || []
        this.logsDialog = true
      } catch (err) {
        this.$store.commit('showNotification', {
          message: 'Failed to load logs: ' + err.message,
          style: 'error'
        })
      }
      this.loading = false
    },
    async clearLogs() {
      if (!this.selectedPlugin) return

      this.clearingLogs = true
      try {
        const response = await this.$apollo.mutate({
          mutation: gql`
            mutation($pluginId: String!) {
              plugins {
                clearLogs(pluginId: $pluginId) {
                  responseResult {
                    succeeded
                    errorCode
                    slug
                    message
                  }
                }
              }
            }
          `,
          variables: {
            pluginId: this.selectedPlugin.id
          }
        })

        const result = response.data.plugins.clearLogs

        if (result.responseResult.succeeded) {
          this.$store.commit('showNotification', {
            message: 'Logs cleared successfully',
            style: 'success'
          })
          // Reload logs
          this.pluginLogs = []
        } else {
          throw new Error(result.responseResult.message)
        }
      } catch (err) {
        this.$store.commit('showNotification', {
          message: 'Failed to clear logs: ' + err.message,
          style: 'error'
        })
      }
      this.clearingLogs = false
    },
    async uninstallPlugin(plugin) {
      this.selectedPlugin = plugin
      this.uninstallDialog = true
    },
    async confirmUninstall() {
      if (!this.selectedPlugin) return

      this.uninstalling = true
      try {
        const response = await this.$apollo.mutate({
          mutation: gql`
            mutation($id: String!) {
              plugins {
                uninstall(id: $id) {
                  responseResult {
                    succeeded
                    errorCode
                    slug
                    message
                  }
                }
              }
            }
          `,
          variables: {
            id: this.selectedPlugin.id
          }
        })

        const result = response.data.plugins.uninstall

        if (result.responseResult.succeeded) {
          this.$store.commit('showNotification', {
            message: `Plugin ${this.selectedPlugin.name} uninstalled successfully`,
            style: 'success'
          })
          this.uninstallDialog = false
          this.selectedPlugin = null
          await this.loadPlugins()
        } else {
          throw new Error(result.responseResult.message)
        }
      } catch (err) {
        this.$store.commit('showNotification', {
          message: 'Failed to uninstall plugin: ' + err.message,
          style: 'error'
        })
      }
      this.uninstalling = false
    },
    async saveConfig() {
      this.saving = true
      try {
        // Merge config values with schema to preserve structure
        const newConfig = {
          schema: this.configSchema,
          ...this.configValues
        }

        const response = await this.$apollo.mutate({
          mutation: gql`
            mutation($id: String!, $config: JSON!) {
              plugins {
                updateConfig(id: $id, config: $config) {
                  responseResult {
                    succeeded
                    errorCode
                    slug
                    message
                  }
                }
              }
            }
          `,
          variables: {
            id: this.selectedPlugin.id,
            config: newConfig
          }
        })

        const result = response.data.plugins.updateConfig

        if (result.responseResult.succeeded) {
          this.$store.commit('showNotification', {
            message: 'Configuration saved successfully',
            style: 'success'
          })
          this.configDialog = false
          await this.loadPlugins()
        } else {
          throw new Error(result.responseResult.message)
        }
      } catch (err) {
        this.$store.commit('showNotification', {
          message: 'Failed to save configuration: ' + err.message,
          style: 'error'
        })
      }
      this.saving = false
    },
    getStatusColor(status) {
      switch (status) {
        case 'active': return 'success'
        case 'inactive': return 'grey'
        case 'error': return 'error'
        case 'loading': return 'info'
        default: return 'grey'
      }
    },
    getLogColor(level) {
      switch (level) {
        case 'debug': return 'grey'
        case 'info': return 'blue'
        case 'warn': return 'orange'
        case 'error': return 'red'
        default: return 'grey'
      }
    },
    getLogIcon(level) {
      switch (level) {
        case 'debug': return 'mdi-bug'
        case 'info': return 'mdi-information'
        case 'warn': return 'mdi-alert'
        case 'error': return 'mdi-alert-circle'
        default: return 'mdi-message'
      }
    },
    exportLogs() {
      if (!this.selectedPlugin) return

      const dataStr = JSON.stringify(this.searchedLogs, null, 2)
      const dataBlob = new Blob([dataStr], { type: 'application/json' })
      const url = URL.createObjectURL(dataBlob)
      const link = document.createElement('a')
      link.href = url
      link.download = `${this.selectedPlugin.id}-logs-${new Date().toISOString().split('T')[0]}.json`
      document.body.appendChild(link)
      link.click()
      document.body.removeChild(link)
      URL.revokeObjectURL(url)

      this.$store.commit('showNotification', {
        message: 'Logs exported successfully',
        style: 'success'
      })
    },
    copyToClipboard(text) {
      navigator.clipboard.writeText(text).then(() => {
        this.$store.commit('showNotification', {
          message: 'Copied to clipboard',
          style: 'success'
        })
      }).catch(err => {
        this.$store.commit('showNotification', {
          message: 'Failed to copy: ' + err.message,
          style: 'error'
        })
      })
    },
    /**
     * Open install dialog
     */
    showInstallDialog() {
      this.installDialog = true
      this.uploadFile = null
      this.uploading = false
      this.uploadProgress = 0
      this.installSuccess = false
      this.installError = null
      this.uploadError = null
    },
    /**
     * Close install dialog
     */
    closeInstallDialog() {
      if (this.uploading) return

      this.installDialog = false
      this.uploadFile = null
      this.uploadError = null
      this.installError = null

      // Refresh plugin list if installation succeeded
      if (this.installSuccess) {
        this.installSuccess = false
        this.loadPlugins()
      }
    },
    /**
     * Validate selected file
     */
    validateFile() {
      if (!this.uploadFile) {
        this.uploadError = null
        return
      }

      this.installError = null
      this.uploadError = null

      // Validate file type
      if (!this.uploadFile.name.endsWith('.zip')) {
        this.uploadError = 'Only ZIP files are allowed'
        this.uploadFile = null
        return
      }

      // Validate file size (50MB max)
      const maxSize = 50 * 1024 * 1024
      if (this.uploadFile.size > maxSize) {
        this.uploadError = 'File size exceeds 50 MB limit'
        this.uploadFile = null
        return
      }

      this.$store.commit('showNotification', {
        message: `Ready to install: ${this.uploadFile.name}`,
        style: 'info'
      })
    },
    /**
     * Upload and install plugin
     */
    async uploadPlugin() {
      if (!this.uploadFile) return

      this.uploading = true
      this.uploadProgress = 0
      this.installError = null
      this.uploadError = null
      this.installSuccess = false

      try {
        const formData = new FormData()
        formData.append('plugin', this.uploadFile)

        // Simulate progress (fetch doesn't support upload progress natively)
        const progressInterval = setInterval(() => {
          if (this.uploadProgress < 90) {
            this.uploadProgress += 10
          }
        }, 200)

        const jwtToken = Cookies.get('jwt')
        const headers = {}
        if (jwtToken) {
          headers['Authorization'] = `Bearer ${jwtToken}`
        }

        const response = await fetch('/admin/plugins/upload', {
          method: 'POST',
          headers,
          body: formData
        })

        clearInterval(progressInterval)
        this.uploadProgress = 100

        const result = await response.json()

        if (result.success) {
          this.installSuccess = true
          this.$store.commit('showNotification', {
            message: 'Plugin installed successfully',
            style: 'success'
          })

          // Auto-close after 2 seconds
          setTimeout(() => {
            this.closeInstallDialog()
          }, 2000)
        } else {
          throw new Error(result.message || 'Installation failed')
        }
      } catch (err) {
        this.installError = err.message || 'Unknown error occurred'
        this.$store.commit('showNotification', {
          message: 'Failed to install plugin: ' + err.message,
          style: 'error'
        })
      }

      this.uploading = false
    },
    async startRestartPolling() {
      // Wait for server to start restarting (server has 3s delay + restart time)
      // This prevents polling while server is definitely down
      await new Promise(resolve => setTimeout(resolve, 5000))

      // Poll for server restart completion AND plugin activation
      let attemptCount = 0
      const maxAttempts = 30 // 30 seconds max (after initial 5s wait)

      this.restartCheckInterval = setInterval(async () => {
        attemptCount++

        try {
          // Check if server is back AND if the plugin is in expected state
          const response = await this.$apollo.query({
            query: gql`
              query {
                plugins {
                  list {
                    id
                    isEnabled
                    status
                  }
                }
              }
            `,
            fetchPolicy: 'network-only'
          })

          if (response.data && response.data.plugins && response.data.plugins.list) {
            // Find the plugin we toggled
            const plugin = response.data.plugins.list.find(p => p.id === this.restartPluginId)

            // Check if plugin is in expected state
            if (plugin && plugin.isEnabled === this.restartExpectedState) {
              // Plugin is in the correct state! Clear interval and reload page
              clearInterval(this.restartCheckInterval)
              this.restartCheckInterval = null

              // Wait a bit more to ensure full activation
              await new Promise(resolve => setTimeout(resolve, 1000))

              // Reload the page
              window.location.reload()
            }
          }
        } catch (err) {
          // Server still down or error, continue polling silently
          if (attemptCount >= maxAttempts) {
            // Max attempts reached, give up
            clearInterval(this.restartCheckInterval)
            this.restartCheckInterval = null
            this.restartOverlay = false

            this.$store.commit('showNotification', {
              message: 'Server restart timed out. Please refresh the page manually.',
              style: 'error'
            })
          }
        }
      }, 1000) // Poll every second
    }
  },
  beforeDestroy() {
    // Cleanup polling interval if component is destroyed
    if (this.restartCheckInterval) {
      clearInterval(this.restartCheckInterval)
      this.restartCheckInterval = null
    }
  }
}
</script>

<style lang='scss'>
.log-table {
  font-family: 'Roboto Mono', 'Courier New', monospace;

  .log-message {
    font-family: 'Roboto Mono', 'Courier New', monospace;
    font-size: 13px;
    line-height: 1.6;
    white-space: pre-wrap;
    word-break: break-word;
  }

  .stack-trace-container {
    position: relative;

    .stack-trace {
      font-family: 'Roboto Mono', 'Courier New', monospace;
      font-size: 11px;
      background: #f5f5f5;
      padding: 12px;
      border-radius: 4px;
      overflow-x: auto;
      margin: 0;
      color: #c62828;
      line-height: 1.5;
    }
  }

  code {
    background: #f5f5f5;
    padding: 2px 6px;
    border-radius: 3px;
    font-size: 12px;
  }
}

.v-data-table {
  ::v-deep tbody tr {
    &:hover {
      background-color: #f5f5f5 !important;
    }
  }

  ::v-deep td {
    padding: 12px 16px !important;
  }
}
</style>
