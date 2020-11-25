<template>
  <v-list-group>
    <template v-slot:activator>
      <v-list-item-icon>
        <i class="fas fa-user me"></i>
      </v-list-item-icon>
      <v-list-item-content>
        <v-list-item-title>
          <span class="float-left">
            {{ client.name }}
          </span>
          <span class="float-right" v-if="mic.volumeNode !== undefined">
            <span class="px-3">Connected</span><i class="fas fa-volume-up"></i>
          </span>
          <span class="float-right" v-else>
            <span class="px-3">Disconnected</span><i class="fas fa-volume-mute"></i>
          </span>
        </v-list-item-title>
      </v-list-item-content>
    </template>
    <v-slider
      v-if="mic.volumeNode !== undefined"
      thumb-label
      v-model="streamVolume"
      track-color="grey"
      always-dirty
      min="0"
      max="100"
      class="px-3"
    >
      <template v-slot:prepend>
        <v-icon @click="decrementvol">fa-microphone-slash</v-icon>
      </template>

      <template v-slot:append>
        <v-icon @click="incrementvol">fa-microphone</v-icon>
      </template>
    </v-slider>
  </v-list-group>
</template>

<script lang="ts">
import { Component, Vue, Prop } from 'vue-property-decorator'
import ClientModel, { MyMicModel } from '@/models/ClientModel'

@Component({})
export default class MyClientListItem extends Vue {
  @Prop()
  client!: ClientModel;

  @Prop()
  mic!: MyMicModel;

  decrementvol () {
    if (this.streamVolume) this.streamVolume = Math.max(0, this.streamVolume - 5)
  }

  incrementvol () {
    if (this.streamVolume) this.streamVolume = Math.min(100, this.streamVolume + 5)
  }

  get streamVolume () {
    if (typeof this.mic.volumeNode !== 'undefined') {
      return this.mic.volumeNode.gain.value * 100
    }
    return undefined
  }

  set streamVolume (val) {
    if (typeof this.mic.volumeNode !== 'undefined') {
      this.mic.volumeNode.gain.value = val ? val / 100 : 0
    }
  }
}
</script>
<style scoped lang="stylus">
.fa-user.me {
  color: cyan;
}
</style>
