<template>
  <v-list-item>
    <v-list-item-icon>
      <i class="fas fa-user"></i>
    </v-list-item-icon>
    <v-list-item-content>
      <v-list-item-title>
        <span class="float-left">
          {{ client.name }}
        </span>
        <span class="float-right" v-if="streams.some(s => s.uuid === client.uuid)">
          <span class="px-3">Connected</span><i class="fas fa-volume-up"></i>
        </span>
        <span class="float-right" v-else>
          <span class="px-3">Disconnected</span><i class="fas fa-volume-mute"></i>
        </span>
      </v-list-item-title>
    </v-list-item-content>
  </v-list-item>
</template>

<script lang="ts">
import { Component, Vue, Prop } from 'vue-property-decorator'
import ClientModel, { RemoteStreamModel } from '@/models/ClientModel'

@Component({})
export default class ClientListItem extends Vue {
  @Prop()
  client!: ClientModel;

  @Prop()
  streams!: RemoteStreamModel[];
}
</script>
<style scoped lang="stylus">
</style>
