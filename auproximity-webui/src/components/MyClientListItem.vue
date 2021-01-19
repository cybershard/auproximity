<template>
  <v-list-group>
    <template v-slot:activator>
      <v-list-item-icon :color='client.color > -1 ? Colors[client.color] : undefined'>
        <i class="far fa-user me"></i>
      </v-list-item-icon>
      <v-list-item-content>
        <v-list-item-title>
          <span class="float-left">
            <i v-if="mic.levels > 10" class="fas fa-volume-up"></i>
            <i v-else class="fas fa-volume-off"></i>
            <span class="pl-3">{{ client.name }}</span>
            <span v-if="$store.state.ishost">
              (HOST)
            </span>
          </span>
          <span class="float-right" v-if="mic.volumeNode !== undefined">
            <span class="px-3">Connected</span>
          </span>
          <span class="float-right" v-else>
            <span class="px-3">Disconnected</span>
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
        <v-icon>fa-microphone-slash</v-icon>
      </template>

      <template v-slot:append>
        <v-icon>fa-microphone</v-icon>
      </template>
    </v-slider>
  </v-list-group>
</template>

<script lang="ts">
import { Component, Vue, Prop } from 'vue-property-decorator'
import ClientModel, { MyMicModel, ColorID } from '@/models/ClientModel'

@Component({})
export default class MyClientListItem extends Vue {
  @Prop()
  client!: ClientModel;

  @Prop()
  mic!: MyMicModel;

  Colors = {
    [ColorID.Red]: '#c61111',
    [ColorID.Blue]: '#132ed2',
    [ColorID.DarkGreen]: '#11802d',
    [ColorID.Pink]: '#ee54bb',
    [ColorID.Orange]: '#f07d0d',
    [ColorID.Yellow]: '#f6f657',
    [ColorID.Black]: '#3f474e',
    [ColorID.White]: '#d7e1f1',
    [ColorID.Purple]: '#6b2fbc',
    [ColorID.Brown]: '#71491e',
    [ColorID.Cyan]: '#38ffdd',
    [ColorID.Lime]: '#50f039'
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

<style scoped>
  .mic-over-10 {
    border: 5px solid white;
  }
</style>
