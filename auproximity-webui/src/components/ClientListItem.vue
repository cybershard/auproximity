<template>
  <v-list-group>
    <template v-slot:activator>
      <v-list-item-icon v-if="isme">
        <i class="fas fa-user me"></i>
      </v-list-item-icon>
      <v-list-item-icon v-else>
        <i class="fas fa-user"></i>
      </v-list-item-icon>
      <v-list-item-content>
        <v-list-item-title>
          <span class="float-left">
            {{ client.name }}
          </span>
          <span class="float-right" v-if="streams.some(s => s.uuid === client.uuid) || isme">
            <span class="px-3">Connected</span><i class="fas fa-volume-up"></i>
          </span>
          <span class="float-right" v-else>
            <span class="px-3">Disconnected</span><i class="fas fa-volume-mute"></i>
          </span>
        </v-list-item-title>
      </v-list-item-content>
    </template>
    <v-slider
      thumb-label
      v-model="streamVolume"
      track-color="grey"
      always-dirty
      min="0"
      max="100"
      class="px-3"
    >
      <template v-slot:prepend>
        <v-icon @click="decrementvol" v-if="isme">fa-microphone-slash</v-icon>
        <v-icon @click="decrementvol" v-else>fa-volume-mute</v-icon>
      </template>

      <template v-slot:append>
        <v-icon @click="decrementvol" v-if="isme">fa-microphone</v-icon>
        <v-icon @click="decrementvol" v-else>fa-volume-up</v-icon>
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

  @Prop()
  isme?: boolean;

  decrementvol () {
    if (this.streamVolume) this.streamVolume = Math.max(0, this.streamVolume - 5)
  }

  incrementvol () {
    if (this.streamVolume) this.streamVolume = Math.min(100, this.streamVolume + 5)
  }

  get streamVolume () {
    if (this.isme) {
      if (this.$store.state.micVolumeNode) {
        return this.$store.state.micVolumeNode.gain.value * 100
      }
    } else {
      if (this.stream) {
        return this.stream.volumeNode.gain.value * 100
      }
    }

    return null
  }

  set streamVolume (val) {
    if (this.isme) {
      if (this.$store.state.micVolumeNode) {
        this.$store.state.micVolumeNode.gain.value = val ? val / 100 : 0
      }
    } else {
      if (this.stream) {
        this.stream.volumeNode.gain.value = val ? val / 100 : 0
      }
    }
  }

  get stream () {
    return this.streams.find(s => s.uuid === this.client.uuid)
  }
}
</script>
<style scoped lang="stylus">
.fa-user.me {
  color: blue;
}
</style>
