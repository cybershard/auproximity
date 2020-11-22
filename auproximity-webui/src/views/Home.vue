<template>
  <v-container>
    <v-row>
      <v-col cols="12" md="6">
        <ServerConnector @joinRoom="joinRoom($event)"/>
      </v-col>
      <v-col cols="12" md="6">
        <ServerDisplayer />
      </v-col>
    </v-row>
    <v-row>
      <v-col cols="12" offset-md="3" md="6">
        <Tutorial />
      </v-col>
    </v-row>
  </v-container>
</template>

<script lang="ts">
import { Component, Vue } from 'vue-property-decorator'
import { BackendModel } from '@/models/BackendModel'
import ClientSocketEvents from '@/models/ClientSocketEvents'
import ServerConnector from '@/components/ServerConnector.vue'
import ServerDisplayer from '@/components/ServerDisplayer.vue'
import Tutorial from '@/components/Tutorial.vue'

@Component({
  components: {
    Tutorial,
    ServerConnector,
    ServerDisplayer
  }
})
export default class Home extends Vue {
  joinRoom (event: { name: string; backendModel: BackendModel }) {
    const payload = {
      name: event.name,
      backendModel: event.backendModel
    }
    this.$store.commit('setJoinedRoom', true)
    this.$store.commit('setNameAndBackendModel', payload)
    this.$socket.client.emit(ClientSocketEvents.JoinRoom, payload)
  }
}
</script>
