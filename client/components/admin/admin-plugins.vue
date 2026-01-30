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
                  v-list-item(@click='viewErrors(item)', :disabled='!hasErrors(item)')
                    v-list-item-icon: v-icon mdi-alert-circle
                    v-list-item-title View Errors
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

    //- Errors Dialog
    v-dialog(v-model='errorsDialog', max-width='1000')
      v-card(v-if='selectedPlugin')
        v-toolbar(color='error', dark, dense, flat)
          v-toolbar-title Errors for {{ selectedPlugin.name }}
          v-spacer
          v-btn(icon, @click='errorsDialog = false')
            v-icon mdi-close
        v-card-text.pt-4
          v-alert(type='info', v-if='pluginErrors.length === 0') No errors recorded
          v-timeline(dense, v-else)
            v-timeline-item(
              v-for='error in pluginErrors'
              :key='error.id'
              small
              color='error'
            )
              template(v-slot:opposite)
                span.caption {{ error.createdAt | moment('from') }}
              v-card(flat)
                v-card-title.caption {{ error.errorType }}
                v-card-text
                  .body-2 {{ error.errorMessage }}
                  pre.caption.mt-2(v-if='error.stackTrace') {{ error.stackTrace }}
        v-card-actions
          v-spacer
          v-btn(text, @click='errorsDialog = false') Close

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
</template>

<script>
import gql from 'graphql-tag'

export default {
  data() {
    return {
      loading: false,
      saving: false,
      uninstalling: false,
      plugins: [],
      configDialog: false,
      errorsDialog: false,
      uninstallDialog: false,
      selectedPlugin: null,
      pluginErrors: [],
      configSchema: {},
      configValues: {},
      headers: [
        { text: 'Plugin', value: 'name', sortable: true, width: '250px' },
        { text: 'Description', value: 'description', sortable: false },
        { text: 'Status', value: 'status', sortable: true, width: '120px', align: 'center' },
        { text: 'Enabled', value: 'isEnabled', sortable: true, width: '100px', align: 'center' },
        { text: 'Actions', value: 'actions', sortable: false, width: '80px', align: 'center' }
      ]
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
            message: plugin.isEnabled
              ? `Plugin ${plugin.name} activated successfully`
              : `Plugin ${plugin.name} deactivated successfully`,
            style: 'success'
          })

          if (result.requiresRestart) {
            this.$store.commit('showNotification', {
              message: 'Server restart required for changes to take effect',
              style: 'warning'
            })
          }

          await this.loadPlugins()
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
    async viewErrors(plugin) {
      this.selectedPlugin = plugin
      this.loading = true
      try {
        const response = await this.$apollo.query({
          query: gql`
            query($pluginId: String!) {
              plugins {
                errors(pluginId: $pluginId) {
                  id
                  errorType
                  errorMessage
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
        this.pluginErrors = response.data.plugins.errors || []
        this.errorsDialog = true
      } catch (err) {
        this.$store.commit('showNotification', {
          message: 'Failed to load errors: ' + err.message,
          style: 'error'
        })
      }
      this.loading = false
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
    hasErrors(plugin) {
      return plugin.status === 'error' || (plugin.state && plugin.state.status === 'error')
    }
  }
}
</script>

<style lang='scss'>
</style>
