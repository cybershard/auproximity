<template>
  <v-card>
    <div class="text-center py-5">
      <h3>Star on Github</h3>
    </div>
    <div class="pa-2 text-center">
      <a class="githubbutton" :href="githubLink" target="_blank">
        <img src="@/assets/githublogo.png">
      </a>
    </div>
  </v-card>
</template>

<script lang="ts">
import { Component, Prop, Vue } from 'vue-property-decorator'

@Component({})
export default class GithubStar extends Vue {
  @Prop()
  githubLink!: string;
}
</script>
<style scoped lang="stylus">
.githubbutton
  height 0
  & > img
    height 90px
    padding 10px
    border white 1px solid
    border-radius 15px
    transition background-color 0.2s
  & > img:hover
    background-color darkgoldenrod
</style>
