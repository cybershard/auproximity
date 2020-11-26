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
     <p>Note: This software is meant to be used for personal use on public Among Us lobbies.
       If you want to have a custom solution like a private server backend or BepInEx client mod, direct message
       <span class="highlight">Cybershard#3935</span> on Discord.
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
    'Choose the proper map that you are in: Skeld, Mira HQ, Polus.'
  ]
}
</script>
<style scoped lang="stylus">
.highlight
  font-weight bold
  font-size large
</style>
