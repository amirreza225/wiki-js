
import Vue from 'vue'
import VueRouter from 'vue-router'
import VueClipboards from 'vue-clipboards'
import { ApolloClient } from 'apollo-client'
import { BatchHttpLink } from 'apollo-link-batch-http'
import { ApolloLink, split } from 'apollo-link'
import { WebSocketLink } from 'apollo-link-ws'
import { ErrorLink } from 'apollo-link-error'
import { InMemoryCache } from 'apollo-cache-inmemory'
import { getMainDefinition } from 'apollo-utilities'
import VueApollo from 'vue-apollo'
import Vuetify from 'vuetify/lib'
import Velocity from 'velocity-animate'
import Vuescroll from 'vuescroll/dist/vuescroll-native'
import Hammer from 'hammerjs'
import moment from 'moment-timezone'
import VueMoment from 'vue-moment'
import store from './store'
import Cookies from 'js-cookie'

// ====================================
// Load Modules
// ====================================

import boot from './modules/boot'
import localization from './modules/localization'

// ====================================
// Load Helpers
// ====================================

import helpers from './helpers'

// Register commonly-used Vuetify components globally for plugins
// This is needed because vuetify-loader uses tree-shaking, so components
// are not automatically global. Plugins need these registered globally.
import {
  VApp,
  VAppBar,
  VAvatar,
  VBadge,
  VBtn,
  VCard,
  VCardActions,
  VCardText,
  VCardTitle,
  VChip,
  VDialog,
  VDivider,
  VIcon,
  VList,
  VListItem,
  VListItemAction,
  VListItemAvatar,
  VListItemContent,
  VListItemGroup,
  VListItemIcon,
  VListItemSubtitle,
  VListItemTitle,
  VMenu,
  VProgressCircular,
  VProgressLinear,
  VSnackbar,
  VTextField,
  VToolbar,
  VToolbarTitle,
  VTooltip
} from 'vuetify/lib'

// ====================================
// Initialize Global Vars
// ====================================

window.WIKI = null
window.boot = boot
window.Hammer = Hammer

moment.locale(siteConfig.lang)

store.commit('user/REFRESH_AUTH')

// ====================================
// Initialize Apollo Client (GraphQL)
// ====================================

const graphQLEndpoint = window.location.protocol + '//' + window.location.host + '/graphql'
const graphQLWSEndpoint = ((window.location.protocol === 'https:') ? 'wss:' : 'ws:') + '//' + window.location.host + '/graphql-subscriptions'

const graphQLLink = ApolloLink.from([
  new ErrorLink(({ graphQLErrors, networkError }) => {
    if (graphQLErrors) {
      let isAuthError = false
      graphQLErrors.map(({ message, locations, path }) => {
        if (message === `Forbidden`) {
          isAuthError = true
        }
        console.error(`[GraphQL error]: Message: ${message}, Location: ${locations}, Path: ${path}`)
      })
      store.commit('showNotification', {
        style: 'red',
        message: isAuthError ? `You are not authorized to access this resource.` : `An unexpected error occurred.`,
        icon: 'alert'
      })
    }
    if (networkError) {
      console.error(networkError)
      store.commit('showNotification', {
        style: 'red',
        message: `Network Error: ${networkError.message}`,
        icon: 'alert'
      })
    }
  }),
  new BatchHttpLink({
    includeExtensions: true,
    uri: graphQLEndpoint,
    credentials: 'include',
    fetch: async (uri, options) => {
      // Strip __typename fields from variables
      let body = JSON.parse(options.body)
      body = body.map(bd => {
        return ({
          ...bd,
          variables: JSON.parse(JSON.stringify(bd.variables), (key, value) => { return key === '__typename' ? undefined : value })
        })
      })
      options.body = JSON.stringify(body)

      // Inject authentication token
      const jwtToken = Cookies.get('jwt')
      if (jwtToken) {
        options.headers.Authorization = `Bearer ${jwtToken}`
      }

      const resp = await fetch(uri, options)

      // Handle renewed JWT
      const newJWT = resp.headers.get('new-jwt')
      if (newJWT) {
        Cookies.set('jwt', newJWT, { expires: 365, secure: window.location.protocol === 'https:' })
      }
      return resp
    }
  })
])

const graphQLWSLink = new WebSocketLink({
  uri: graphQLWSEndpoint,
  options: {
    reconnect: true,
    lazy: true
  }
})

window.graphQL = new ApolloClient({
  link: split(({ query }) => {
    const { kind, operation } = getMainDefinition(query)
    return kind === 'OperationDefinition' && operation === 'subscription'
  }, graphQLWSLink, graphQLLink),
  cache: new InMemoryCache(),
  connectToDevTools: (process.env.node_env === 'development')
})

// ====================================
// Initialize Vue Modules
// ====================================

Vue.config.productionTip = false

Vue.use(VueRouter)
Vue.use(VueApollo)
Vue.use(VueClipboards)
Vue.use(localization.VueI18Next)
Vue.use(helpers)
Vue.use(Vuetify)
Vue.use(VueMoment, { moment })
Vue.use(Vuescroll)

Vue.prototype.Velocity = Velocity

// Expose Vuetify globally for plugin externals
if (typeof window !== 'undefined') {
  window.Vuetify = Vuetify
}

// Register components globally
Vue.component('VApp', VApp)
Vue.component('VAppBar', VAppBar)
Vue.component('VAvatar', VAvatar)
Vue.component('VBadge', VBadge)
Vue.component('VBtn', VBtn)
Vue.component('VCard', VCard)
Vue.component('VCardActions', VCardActions)
Vue.component('VCardText', VCardText)
Vue.component('VCardTitle', VCardTitle)
Vue.component('VChip', VChip)
Vue.component('VDialog', VDialog)
Vue.component('VDivider', VDivider)
Vue.component('VIcon', VIcon)
Vue.component('VList', VList)
Vue.component('VListItem', VListItem)
Vue.component('VListItemAction', VListItemAction)
Vue.component('VListItemAvatar', VListItemAvatar)
Vue.component('VListItemContent', VListItemContent)
Vue.component('VListItemGroup', VListItemGroup)
Vue.component('VListItemIcon', VListItemIcon)
Vue.component('VListItemSubtitle', VListItemSubtitle)
Vue.component('VListItemTitle', VListItemTitle)
Vue.component('VMenu', VMenu)
Vue.component('VProgressCircular', VProgressCircular)
Vue.component('VProgressLinear', VProgressLinear)
Vue.component('VSnackbar', VSnackbar)
Vue.component('VTextField', VTextField)
Vue.component('VToolbar', VToolbar)
Vue.component('VToolbarTitle', VToolbarTitle)
Vue.component('VTooltip', VTooltip)

// ====================================
// Register Vue Components
// ====================================

Vue.component('Admin', () => import(/* webpackChunkName: "admin" */ './components/admin.vue'))
Vue.component('Comments', () => import(/* webpackChunkName: "comments" */ './components/comments.vue'))
Vue.component('Editor', () => import(/* webpackPrefetch: -100, webpackChunkName: "editor" */ './components/editor.vue'))
Vue.component('History', () => import(/* webpackChunkName: "history" */ './components/history.vue'))
Vue.component('Loader', () => import(/* webpackPrefetch: true, webpackChunkName: "ui-extra" */ './components/common/loader.vue'))
Vue.component('Login', () => import(/* webpackPrefetch: true, webpackChunkName: "login" */ './components/login.vue'))
Vue.component('NavHeader', () => import(/* webpackMode: "eager" */ './components/common/nav-header.vue'))
Vue.component('NewPage', () => import(/* webpackChunkName: "new-page" */ './components/new-page.vue'))
Vue.component('Notify', () => import(/* webpackMode: "eager" */ './components/common/notify.vue'))
Vue.component('NotFound', () => import(/* webpackChunkName: "not-found" */ './components/not-found.vue'))
Vue.component('PageSelector', () => import(/* webpackPrefetch: true, webpackChunkName: "ui-extra" */ './components/common/page-selector.vue'))
Vue.component('PageSource', () => import(/* webpackChunkName: "source" */ './components/source.vue'))
Vue.component('Profile', () => import(/* webpackChunkName: "profile" */ './components/profile.vue'))
Vue.component('Register', () => import(/* webpackChunkName: "register" */ './components/register.vue'))
Vue.component('SearchResults', () => import(/* webpackPrefetch: true, webpackChunkName: "ui-extra" */ './components/common/search-results.vue'))
Vue.component('SocialSharing', () => import(/* webpackPrefetch: true, webpackChunkName: "ui-extra" */ './components/common/social-sharing.vue'))
Vue.component('Tags', () => import(/* webpackChunkName: "tags" */ './components/tags.vue'))
Vue.component('Unauthorized', () => import(/* webpackChunkName: "unauthorized" */ './components/unauthorized.vue'))
Vue.component('VCardChin', () => import(/* webpackPrefetch: true, webpackChunkName: "ui-extra" */ './components/common/v-card-chin.vue'))
Vue.component('VCardInfo', () => import(/* webpackPrefetch: true, webpackChunkName: "ui-extra" */ './components/common/v-card-info.vue'))
Vue.component('Welcome', () => import(/* webpackChunkName: "welcome" */ './components/welcome.vue'))

Vue.component('NavFooter', () => import(/* webpackChunkName: "theme" */ './themes/' + siteConfig.theme + '/components/nav-footer.vue'))
Vue.component('Page', () => import(/* webpackChunkName: "theme" */ './themes/' + siteConfig.theme + '/components/page.vue'))

let bootstrap = () => {
  // ====================================
  // Notifications
  // ====================================

  window.addEventListener('beforeunload', () => {
    store.dispatch('startLoading')
  })

  const apolloProvider = new VueApollo({
    defaultClient: window.graphQL
  })

  // ====================================
  // Bootstrap Vue
  // ====================================

  const i18n = localization.init()

  let darkModeEnabled = siteConfig.darkMode
  if ((store.get('user/appearance') || '').length > 0) {
    darkModeEnabled = (store.get('user/appearance') === 'dark')
  }

  window.WIKI = new Vue({
    el: '#root',
    components: {},
    mixins: [helpers],
    apolloProvider,
    store,
    i18n,
    vuetify: new Vuetify({
      rtl: siteConfig.rtl,
      theme: {
        dark: darkModeEnabled
      }
    }),
    async mounted () {
      this.$moment.locale(siteConfig.lang)
      if ((store.get('user/dateFormat') || '').length > 0) {
        this.$moment.updateLocale(this.$moment.locale(), {
          longDateFormat: {
            'L': store.get('user/dateFormat')
          }
        })
      }
      if ((store.get('user/timezone') || '').length > 0) {
        this.$moment.tz.setDefault(store.get('user/timezone'))
      }

      // Initialize plugins
      try {
        const { default: ClientPluginLoader } = await import(/* webpackChunkName: "plugin-loader" */ './plugins/loader')
        const pluginLoader = new ClientPluginLoader()
        await pluginLoader.initializePlugins({
          Vue,
          $vuetify: this.$vuetify,
          $store: this.$store,
          $router: this.$router,
          $apollo: this.$apollo
        })
        // Store plugin loader globally for access by other components
        this.$pluginLoader = pluginLoader
        window.WIKI.pluginLoader = pluginLoader
      } catch (err) {
        console.error('[App] Failed to initialize plugins:', err)
      }
    }
  })

  // ----------------------------------
  // Dispatch boot ready
  // ----------------------------------

  window.boot.notify('vue')
}

window.boot.onDOMReady(bootstrap)
