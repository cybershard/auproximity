<template>
  <v-dialog
    v-model="shareDialog"
    max-width="600px"
  >
    <v-card>
      <v-card-title>
        <span>Join room {{gameCode}}</span>
      </v-card-title>
      <v-card-text>
        <v-form @submit.prevent="joinRoom">
          <v-text-field
            v-model="name"
            label="Name"
            :rules="[rules.required]"
            outlined
          ></v-text-field>
          <v-btn
            :disabled="!name"
            color="success"
            class="mt-n2"
            type="submit"
          >
            Join
          </v-btn>
        </v-form>
      </v-card-text>
    </v-card>
  </v-dialog>
</template>

<script lang="ts">
import { Component, Prop, Vue } from 'vue-property-decorator'

@Component({})
export default class JoinModal extends Vue {
  @Prop()
  gameCode!: string;

  name = '';
  shareDialog = !!this.$route.params.gamecode;

  rules = {
    required (value: string) {
      return !!value || 'Required.'
    }
  }

  joinRoom () {
    this.shareDialog = false
    this.$emit('joinroom', this.name)
  }
}
</script>
<style scoped lang="stylus">
</style>
