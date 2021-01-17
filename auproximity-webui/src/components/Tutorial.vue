<template>
 <v-card>
   <div class="text-center py-5">
     <h2>Tutorial</h2>
   </div>
   <div class="pa-4">
     <ul>
       <li v-for="(item, i) in items" :key="i">{{ item }}</li>
     </ul>
   </div>
   <div class="pa-3 text-center">
     <p>Note: This software is meant to be used for Official Server Among Us Lobbies.
       If you want to have a solution like a custom server plugin or BepInEx client mod, direct message
       <span class="highlight">Cybershard#0001</span> on Discord.
     </p>
   </div>
 </v-card>
</template>

<script lang="ts">
import { Component, Vue } from 'vue-property-decorator'

@Component({})
export default class Tutorial extends Vue {
  items = [
    'Enter your name and game code exactly as it appears in Among Us',
    'Choose the backend. This will be "Official Among Us Servers"',
    'Enter the region that you are playing in.',
    'Press the "Join" button, and share the URL with your friends to invite them.',
    'Remember to allow your microphone, and get everyone to join the proximity before the game starts.',
    'If it doesn\'t work for you on the first try, refresh the page and/or try a different browser like Firefox or Chrome.'
  ]
}
</script>
<style scoped lang="stylus">
.highlight
  font-weight bold
  font-size large
</style>
