<template>
  <v-list-group>
    <template v-slot:activator>
      <v-list-item-icon>
        <i class="fas fa-user"></i>
      </v-list-item-icon>
      <v-list-item-content>
        <v-list-item-title>
          <span class="float-left">
            {{ client.name }}
          </span>
          <span class="float-right" v-if="stream !== undefined">
            <span class="px-3">Connected</span><i class="fas fa-volume-up"></i>
          </span>
          <span class="float-right" v-else>
            <span class="px-3">Disconnected</span><i class="fas fa-volume-mute"></i>
          </span>
        </v-list-item-title>
      </v-list-item-content>
    </template>
    <v-slider
      v-if="stream"
      thumb-label
      v-model="streamVolume"
      track-color="grey"
      always-dirty
      min="0"
      max="100"
      class="px-3"
    >
      <template v-slot:prepend>
        <v-icon>fa-volume-mute</v-icon>
      </template>

      <template v-slot:append>
        <v-icon>fa-volume-up</v-icon>
      </template>
    </v-slider>
  </v-list-group>
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

  get stream () {
    return this.streams.find(s => s.uuid === this.client.uuid)
  }

  get streamVolume () {
    if (this.stream) {
      return this.stream.volumeNode.gain.value * 100
    }
    return undefined
  }

  set streamVolume (val) {
    if (this.stream) {
      this.stream.volumeNode.gain.value = val ? val / 100 : 0
    }
  }
}
</script>
<style scoped lang="stylus">
</style>
