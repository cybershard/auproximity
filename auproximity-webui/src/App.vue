<template>
  <v-app>
    <v-app-bar app>
      <div class="d-flex align-center">
        <v-img
          alt="Logo"
          class="shrink mr-2"
          contain
          src="@/assets/au1.png"
          transition="scale-transition"
          width="80"
        />

        <h2 class="px-3 hidden-xs-only">Among Us Proximity Voice</h2>
      </div>
    </v-app-bar>

    <v-main>
      <router-view></router-view>
    </v-main>
  </v-app>
</template>

<script lang="ts">
import { Component, Vue } from 'vue-property-decorator'

@Component
export default class App extends Vue {}
</script>
