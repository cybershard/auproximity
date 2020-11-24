<template>
  <v-card class="pa-5">
    <div class="text-center">
      <h2>{{ title }}</h2>
      <h4 v-if="$store.state.joinedRoom">Current Map: {{ this.colliderMap }}</h4>
    </div>
    <v-list v-if="$store.state.joinedRoom">
      <ClientListItem :client="me" :streams="remoteStreams" :isme="true"/>
      <ClientListItem v-for="(client, i) in clients" :key="i" :client="client" :streams="remoteStreams" :isme="false" />
    </v-list>
    <div>
      <span v-for="(value, i) in remoteStreams" :key="i">
        <audio
          v-audio="value"
          class="d-none"
        ></audio>
      </span>
    </div>
    <v-snackbar v-model="errorOccurred">
      {{ error }}
    </v-snackbar>
  </v-card>
</template>

<script lang="ts">
import { Component, Vue } from 'vue-property-decorator'
import { Socket } from 'vue-socket.io-extended'
import ClientSocketEvents from '@/models/ClientSocketEvents'
import Peer from 'peerjs'
import { SERVER_HOSTNAME, SERVER_PORT, SERVER_SECURE } from '@/consts'
import ClientModel, { Pose, RemoteStreamModel } from '@/models/ClientModel'
import { RoomGroup } from '@/models/BackendModel'
import { colliderMaps } from '@/models/ColliderMaps'
import intersect from 'path-intersection'
import ClientListItem from '@/components/ClientListItem.vue'

@Component({
  components: { ClientListItem },
  directives: {
    audio (el: HTMLElement, { value }) {
      const elem: HTMLAudioElement = el as HTMLAudioElement
      // bugfix for chrome https://bugs.chromium.org/p/chromium/issues/detail?id=121673
      // the audiocontext is driven by the output, rather than the input
      elem.srcObject = value.remoteStream
      elem.muted = true
      elem.onloadedmetadata = () => elem.play()
    }
  }
})
export default class ServerDisplayer extends Vue {
  colliderMap: 'Skeld' | 'Mira HQ' | 'Polus' = 'Skeld';

  LERP_VALUE = 3;

  peer!: Peer;
  remoteStreams: RemoteStreamModel[] = [];

  error = '';
  errorOccurred = false;

  @Socket(ClientSocketEvents.SetUuid)
  onSetUuid (uuid: string) {
    this.peer = new Peer(uuid, {
      host: SERVER_HOSTNAME,
      port: SERVER_PORT,
      secure: SERVER_SECURE,
      path: '/peerjs'
    })
    this.peer.on('open', id => console.log('My peer ID is: ' + id))
    this.peer.on('error', error => console.log('PeerJS Error: ' + error))
    this.peer.on('call', async (call) => {
      const stream = await navigator.mediaDevices.getUserMedia({ video: false, audio: true })
      if (this.$store.state.clients.find(
        (client: ClientModel) => client.uuid === call.peer)) {
        await this.connectCall(call)
        call.answer(stream) // Answer the call with an A/V stream.
      }
    })
  }

  @Socket(ClientSocketEvents.Disconnect)
  onDisconnect () {
    this.remoteStreams.forEach(s => s.ctx.close())
    this.remoteStreams = []
    if (this.peer) this.peer.destroy()
  }

  @Socket(ClientSocketEvents.SetAllClients)
  async onAddClient (payload: { uuid: string; name: string }[]) {
    if (!this.peer) {
      this.peer = new Peer(this.$store.state.uuid, {
        host: SERVER_HOSTNAME,
        port: SERVER_PORT,
        secure: SERVER_SECURE,
        path: '/peerjs'
      })
    }

    this.remoteStreams.forEach(s => s.ctx.close())
    this.remoteStreams = []
    const stream = await navigator.mediaDevices.getUserMedia({ video: false, audio: true })
    for (const p of payload) {
      const call = this.peer.call(p.uuid, stream)
      await this.connectCall(call)
    }
  }

  @Socket(ClientSocketEvents.RemoveClient)
  onRemoveClient (uuid: string) {
    this.remoteStreams = this.remoteStreams.filter(remote => {
      if (remote.uuid === uuid) {
        remote.ctx.close()
        return false
      }
      return true
    })
  }

  async connectCall (call: Peer.MediaConnection) {
    call.on('stream', remoteStream => {
      const ctx = new AudioContext()
      const source = ctx.createMediaStreamSource(new MediaStream([remoteStream.getAudioTracks()[0]]))
      const gainNode = ctx.createGain()
      gainNode.gain.value = 1
      const volumeNode = ctx.createGain()
      volumeNode.gain.value = 1
      source.connect(gainNode)
      gainNode.connect(volumeNode)
      volumeNode.connect(ctx.destination)
      this.remoteStreams.push({ uuid: call.peer, ctx, source, gainNode, volumeNode, remoteStream })
    })
  }

  @Socket(ClientSocketEvents.SetMap)
  onSetMap (payload: { map: number }) {
    // eslint-disable-next-line @typescript-eslint/ban-ts-ignore
    // @ts-ignore
    this.colliderMap = ['Skeld', 'Mira HQ', 'Polus'][payload.map] || 'Skeld'
  }

  @Socket(ClientSocketEvents.SetGroup)
  onSetGroup (payload: {uuid: string; group: RoomGroup }) {
    if (RoomGroup.Spectator) {
      if (payload.uuid === this.$store.state.me.uuid) {
        this.remoteStreams.forEach(s => {
          s.gainNode.gain.value = 1
        })
      } else if (this.$store.state.me.group === RoomGroup.Main) {
        const stream = this.remoteStreams.find(s => s.uuid === payload.uuid)
        if (!stream) return
        stream.gainNode.gain.value = 0
      } else if (this.$store.state.me.group === RoomGroup.Spectator) {
        const stream = this.remoteStreams.find(s => s.uuid === payload.uuid)
        if (!stream) return
        stream.gainNode.gain.value = 1
      }
    }
  }

  @Socket(ClientSocketEvents.SetPose)
  onSetPose (payload: { uuid: string; pose: Pose }) {
    // if i am ghost
    //    i don't care as proper gain has been set in onSetGroup
    // if my group is main
    //    if uuid <-> remoteClient is main
    //      recalc volume with colliders
    //    if uuid <-> remoteClient is ghost
    //      skip and set 0 volume again
    if (this.$store.state.me.group === RoomGroup.Spectator) return

    if (this.$store.state.me.uuid === payload.uuid) {
      // change volume of everyone relative to our new position
      this.remoteStreams.forEach(s => {
        this.recalcVolumeForRemoteStream(s)
      })
    } else {
      const remoteStream = this.remoteStreams.find(s => s.uuid === payload.uuid)
      if (!remoteStream) return
      this.recalcVolumeForRemoteStream(remoteStream)
    }
  }

  @Socket(ClientSocketEvents.Error)
  onError (payload: { err: string }) {
    this.error = payload.err
    this.errorOccurred = true
    this.remoteStreams.forEach(s => s.ctx.close())
    this.remoteStreams = []
    if (this.peer) this.peer.destroy()
  }

  recalcVolumeForRemoteStream (stream: { uuid: string; gainNode: GainNode }) {
    const client: ClientModel = this.$store.state.clients.find((c: ClientModel) => c.uuid === stream.uuid)
    if (!client) return
    // Only change if they are in RoomGroup.Main
    if (client.group === RoomGroup.Main) {
      if (this.poseCollide(this.$store.state.me.pose, client.pose)) {
        stream.gainNode.gain.value = 0
      } else {
        stream.gainNode.gain.value = this.lerp(this.hypotPose(this.$store.state.me.pose, client.pose))
      }
    } else if (client.group === RoomGroup.Spectator) {
      // If they are spectator
      stream.gainNode.gain.value = 0
    }
  }

  poseCollide (p1: Pose, p2: Pose) {
    for (const collider of colliderMaps[this.colliderMap]) {
      const intersections = intersect(collider,
        `M ${p1.x + 40} ${40 - p1.y} L ${p2.x + 40} ${40 - p2.y}`)
      if (intersections.length > 0) return true
    }
    return false
  }

  hypotPose (p1: Pose, p2: Pose) {
    console.log('Hypot: ', Math.hypot(p1.x - p2.x, p1.y - p2.y))
    return Math.hypot(p1.x - p2.x, p1.y - p2.y)
  }

  lerp (distance: number) {
    const trueVolume = 1 - (distance / this.LERP_VALUE)
    // clamp above 0, and then below 1
    console.log('truevol:', trueVolume)
    return Math.min(Math.max(trueVolume, 0), 1)
  }

  get title () {
    if (this.$store.state.joinedRoom) {
      return `Connected to game: ${this.$store.state.backendModel.gameCode}`
    } else {
      return 'Not connected'
    }
  }

  get clients () {
    return this.$store.state.clients
  }

  get me () {
    return this.$store.state.me
  }
}
</script>
<style scoped lang="stylus">
</style>
