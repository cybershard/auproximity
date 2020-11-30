import Vue from 'vue'
import App from './App.vue'
import router from './router'
import store from './store'
import vuetify from './plugins/vuetify'
import VueSocketIOExt from 'vue-socket.io-extended'
import { io } from 'socket.io-client'
import '@fortawesome/fontawesome-free/css/all.min.css'
import consts from '@/consts'

Vue.config.devtools = true
Vue.config.productionTip = false

Vue.use(VueSocketIOExt, io(consts.SERVER_URL), { store })

new Vue({
  router,
  store,
  vuetify,
  render: h => h(App)
}).$mount('#app')
