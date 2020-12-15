<template>
  <v-card>
    <div class="text-center py-5">
      <h3>Join Discord Server</h3>
    </div>
    <div class="pa-4 text-center">
      <a class="discordbutton" :href="discordLink" target="_blank">
        <img src="@/assets/discordlogo.svg">
      </a>
    </div>
  </v-card>
</template>

<script lang="ts">
import { Component, Prop, Vue } from 'vue-property-decorator'

@Component({})
export default class DiscordServer extends Vue {
  @Prop()
  discordLink!: string;
}
</script>
<style scoped lang="stylus">
.discordbutton
  height 0
  & > img
    height 70px
    border white 1px solid
    border-radius 15px
    transition background-color 0.2s
  & > img:hover
    background-color #7289DA
</style>
