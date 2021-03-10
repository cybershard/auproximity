<template>
  <v-card class="pa-5">
    <div class="quick-control text-center" >
      <v-btn
        icon
        fab
        x-large
        dark
        @click="toggleMute()"
        :color="$store.state.muted ? 'red' : 'white'"
        class='mx-2'
      >
        <v-icon>fa-microphone</v-icon>
      </v-btn>
      <v-btn
        icon
        fab
        x-large
        dark
        @click="toggleDeaf()"
        :color="$store.state.deafened ? 'red' : 'white'"
        class='mx-2'
      >
        <v-icon>fa-headphones</v-icon>
      </v-btn>
    </div>
    <br>
    <div class="text-center">
      <h2>{{ title }}</h2>
      <h4 v-if="$store.state.joinedRoom">Current Map: {{ ["The Skeld", "Mira HQ", "Polus", "The Skeld", "Airship"][this.settings.map] }}</h4>
    </div>
    <v-list v-if="$store.state.joinedRoom">
      <MyClientListItem :client="$store.state.me" :mic="mymic" />
      <ClientListItem v-for="client in clients" :key="client.uuid" :client="client" :streams="remoteStreams" />
    </v-list>
    <div>
      <span v-for="(value, i) in remoteStreams" :key="i">
        <audio
          v-audio="value"
          class="d-none"
        ></audio>
      </span>
    </div>
    <v-snackbar v-model="showSnackbar">
      {{ snackbarMessage }}
    </v-snackbar>
  </v-card>
</template>

<script lang="ts">
import { Component, Vue } from 'vue-property-decorator'
import { Socket } from 'vue-socket.io-extended'
import { MapID } from '@skeldjs/constant'
import Peer from 'peerjs'
import intersect from 'path-intersection'

import consts from '@/consts'
import { ClientSocketEvents } from '@/models/ClientSocketEvents'
import ClientModel, { Pose, RemoteStreamModel } from '@/models/ClientModel'
import { BackendType, RoomGroup } from '@/models/BackendModel'
import { colliderMaps } from '@/lib/ColliderMaps'
import ClientListItem from '@/components/ClientListItem.vue'
import MyClientListItem from '@/components/MyClientListItem.vue'
import { GameSettings } from '@/models/RoomModel'
import { PlayerFlags } from '@/models/PlayerFlags'
import { getClosestCamera } from '@/lib/CameraPositions'

const AudioContext = window.AudioContext || // Default
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  (window as any).webkitAudioContext // Safari and old versions of Chrome

@Component({
  components: { MyClientListItem, ClientListItem },
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
  showSnackbar = false;
  snackbarMessage = '';

  peer?: Peer;
  remotectx?: AudioContext;
  remoteStreams: RemoteStreamModel[] = [];

  settings: GameSettings = {
    crewmateVision: 1,
    map: MapID.TheSkeld
  };

  /**
   * Starts a PeerJS connection, handles answering calls and auto-reconnects to PeerJS and remote peer MediaStreams on error
   */
  createPeer (uuid: string) {
    if (this.peer) {
      this.peer.destroy()
    }
    this.peer = new Peer(uuid, consts.PEER_CONFIG)
    this.peer.on('open', id => console.log('My peer ID is: ' + id))
    this.peer.on('error', async error => {
      console.log('PeerJS Error: ' + error)

      // If the socket is still connected, an internal PeerJS error has occurred, and try to reconnect.
      // If the socket is disconnected, we probably just lost internet connectivity.
      if (this.$socket.connected) {
        this.createPeer(this.$store.state.me.uuid)
        await this.setupMyStream() // Shouldn't be needed, as PeerJS is independent from local mic, but just in case

        // Reconnect to $store.state.clients
        await this.closeRemoteAudioConnection()
        if (typeof this.peer !== 'undefined') {
          for (const c of this.$store.state.clients) {
            const call = this.peer.call(c.uuid, this.$store.state.mic.destStream.stream)
            await this.connectCall(call)
            this.onSetGroup({ uuid: c.uuid, group: c.group })
          }
        }
      }
    })
    this.peer.on('call', async (call) => {
      if (this.$store.state.clients.find((c: ClientModel) => c.uuid === call.peer)) {
        // If the user has not given permission for audio, this will be undefined, and we won't answer the call.
        if (this.$store.state.mic.destStream) {
          call.answer(this.$store.state.mic.destStream.stream)
        }
        await this.connectCall(call)
      }
    })
  }

  /**
   * Sets up local mic with a gain node to stream audio to other users
   */
  async setupMyStream () {
    if (!this.$store.state.mic.volumeNode) {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      const ctx = new AudioContext()
      const src = ctx.createMediaStreamSource(stream)
      const analyzerNode = ctx.createAnalyser()
      const scriptNode = ctx.createScriptProcessor(2048, 1, 1)

      this.$store.state.globalGainNode = ctx.createGain()
      this.$store.state.globalGainNode.gain.value = this.$store.state.muted ? 0 : 1

      const gainNode = ctx.createGain()
      const dest = ctx.createMediaStreamDestination()
      analyzerNode.smoothingTimeConstant = 0.3
      analyzerNode.fftSize = 1024

      src.connect(this.$store.state.globalGainNode)

      this.$store.state.globalGainNode.connect(analyzerNode)
      analyzerNode.connect(scriptNode)

      this.$store.state.globalGainNode.connect(gainNode)
      gainNode.connect(dest)

      gainNode.gain.value = 1

      this.$store.state.mic.volumeNode = gainNode
      this.$store.state.mic.destStream = dest

      scriptNode.addEventListener('audioprocess', () => {
        const array = new Uint8Array(analyzerNode.frequencyBinCount)
        analyzerNode.getByteFrequencyData(array)

        const values = array.reduce((prev, cur) => prev + cur, 0)

        this.$store.state.mic.levels = values / array.length
      })
    }
  }

  /**
   * When receiving a call, this function will setup the MediaStream, with a default volume of 100%
   */
  connectCall (call: Peer.MediaConnection) {
    return new Promise<void>(resolve => {
      call.on('stream', remoteStream => {
        console.log('recieved remotestream: ', remoteStream)
        if (!this.remotectx) {
          this.remotectx = new AudioContext()
        }
        const source = this.remotectx.createMediaStreamSource(new MediaStream([remoteStream.getAudioTracks()[0]]))
        const analyzerNode = this.remotectx.createAnalyser()
        const scriptNode = this.remotectx.createScriptProcessor(2048, 1, 1)

        const globalVolumeNode = this.remotectx.createGain()
        const gainNode = this.remotectx.createGain()
        const volumeNode = this.remotectx.createGain()
        const pannerNode = this.remotectx.createPanner()

        source.connect(analyzerNode)
        analyzerNode.connect(scriptNode)

        source.connect(globalVolumeNode)
        globalVolumeNode.connect(gainNode)
        gainNode.connect(volumeNode)
        volumeNode.connect(pannerNode)
        pannerNode.connect(this.remotectx.destination)

        gainNode.gain.value = 1
        globalVolumeNode.gain.value = 1
        volumeNode.gain.value = 1
        pannerNode.maxDistance = 1
        pannerNode.rolloffFactor = 0 // Prevents the pannerNode from adjusting the volume (this is being done manually in the gainNode)

        const stream = { uuid: call.peer, source, globalVolumeNode, gainNode, volumeNode, pannerNode, remoteStream, levels: 0 }

        this.remoteStreams.push(stream)

        scriptNode.addEventListener('audioprocess', () => {
          const array = new Uint8Array(analyzerNode.frequencyBinCount)
          analyzerNode.getByteFrequencyData(array)

          const values = array.reduce((prev, cur) => prev + cur, 0)

          stream.levels = values / array.length
        })

        resolve()
      })
    })
  }

  /**
   * Closes just the audio context that is receiving remote audio. Does not touch the PeerJS connection, or the local mic.
   */
  async closeRemoteAudioConnection () {
    this.remoteStreams.forEach(s => {
      s.source.disconnect()
      s.gainNode.disconnect()
      s.globalVolumeNode.disconnect()
      s.volumeNode.disconnect()
      s.pannerNode.disconnect()
    })
    await this.remotectx?.close()
    this.remoteStreams = []
    this.remotectx = undefined
  }

  @Socket(ClientSocketEvents.SetUuid)
  onSetUuid (uuid: string) {
    this.createPeer(uuid)
  }

  @Socket(ClientSocketEvents.Disconnect)
  async onDisconnect () {
    await this.closeRemoteAudioConnection()
    await this.peer?.destroy()
    this.peer = undefined

    this.$store.state.joinedRoom = false
    this.$store.state.backendModel.gameCode = ''
    this.$store.state.backendModel.backendType = BackendType.NoOp
    this.$store.state.me = {
      uuid: '',
      name: '',
      pose: {
        x: 0,
        y: 0
      },
      group: RoomGroup.Spectator,
      color: -1,
      flags: PlayerFlags.None
    }
    this.$store.state.clients = []
    this.$store.state.options = {
      falloff: 4.5,
      falloffVision: false,
      colliders: true,
      paSystems: true
    }
    this.$store.state.clientOptions = {
      omniscientGhosts: false
    }
    this.$store.state.host = ''
  }

  @Socket(ClientSocketEvents.Error)
  onError (payload: { err: string; fatal: boolean }) {
    this.showSnackbar = true
    this.snackbarMessage = payload.err
    if (payload.fatal) this.onDisconnect()
  }

  @Socket(ClientSocketEvents.SetAllClients)
  async onSetAllClients (payload: { uuid: string; name: string }[]) {
    if (typeof this.peer === 'undefined') {
      this.createPeer(this.$store.state.me.uuid)
    }
    await this.setupMyStream()
    await this.closeRemoteAudioConnection()
    await Promise.all(payload.map(p => {
      // eslint-disable-next-line
      const call = this.peer!.call(p.uuid, this.$store.state.mic.destStream.stream)
      return this.connectCall(call)
    }))
  }

  @Socket(ClientSocketEvents.RemoveClient)
  async onRemoveClient (payload: { uuid: string; ban: boolean }) {
    if (payload.uuid === this.$store.state.me.uuid) {
      this.showSnackbar = true
      this.snackbarMessage = payload.ban ? 'You were banned from ' + this.$store.state.backendModel.gameCode : 'You were kicked from ' + this.$store.state.backendModel.gameCode
      await this.onDisconnect()
      this.remoteStreams = []
      return
    }

    this.remoteStreams = this.remoteStreams.filter(remote => {
      if (remote.uuid === payload.uuid) {
        remote.source.disconnect()
        remote.gainNode.disconnect()
        remote.volumeNode.disconnect()
        remote.pannerNode.disconnect()
        return false
      }
      return true
    })
    this.$store.state.clients = this.$store.state.clients.filter((client: ClientModel) => {
      return client.uuid !== payload.uuid
    })
  }

  @Socket(ClientSocketEvents.SetGroup)
  onSetGroup (payload: {uuid: string; group: RoomGroup }) {
    if (payload.group === RoomGroup.Spectator) {
      if (payload.uuid === this.$store.state.me.uuid) {
        this.remoteStreams.forEach(s => {
          if (this.$store.state.clientOptions.omniscientGhosts) {
            s.gainNode.gain.value = 1
            s.pannerNode.setPosition(0, 0, 0)
          }
        })
      } else if (this.$store.state.me.group === RoomGroup.Main) {
        const stream = this.remoteStreams.find(s => s.uuid === payload.uuid)
        if (!stream) return
        stream.gainNode.gain.value = 0
      } else if (this.$store.state.me.group === RoomGroup.Spectator) {
        const stream = this.remoteStreams.find(s => s.uuid === payload.uuid)
        if (!stream) return
        stream.gainNode.gain.value = 1
        stream.pannerNode.setPosition(0, 0, 0)
      } else if (this.$store.state.me.group === RoomGroup.Muted) {
        const stream = this.remoteStreams.find(s => s.uuid === payload.uuid)
        if (!stream) return
        stream.gainNode.gain.value = 0
      }
    } else if (payload.group === RoomGroup.Muted) {
      if (payload.uuid === this.$store.state.me.uuid) {
        this.remoteStreams.forEach(s => {
          s.gainNode.gain.value = 0
        })
      } else if (this.$store.state.me.group === RoomGroup.Main) {
        const stream = this.remoteStreams.find(s => s.uuid === payload.uuid)
        if (!stream) return
        stream.gainNode.gain.value = 0
      } else if (this.$store.state.me.group === RoomGroup.Spectator) {
        const stream = this.remoteStreams.find(s => s.uuid === payload.uuid)
        if (!stream) return
        stream.gainNode.gain.value = 1
        stream.pannerNode.setPosition(0, 0, 0)
      } else if (this.$store.state.me.group === RoomGroup.Muted) {
        const stream = this.remoteStreams.find(s => s.uuid === payload.uuid)
        if (!stream) return
        stream.gainNode.gain.value = 0
      }
    }
  }

  @Socket(ClientSocketEvents.SetPose)
  onSetPose (payload: { uuid: string; pose: Pose }) {
    if (this.$store.state.me.group === RoomGroup.Main || this.$store.state.me.group === RoomGroup.Spectator) {
      if (payload.pose.x === 0 && payload.pose.y === 0) {
        this.remoteStreams.forEach(s => {
          const client: ClientModel = this.$store.state.clients.find((c: ClientModel) => c.uuid === s.uuid)
          if (client && client.group === RoomGroup.Main) {
            s.gainNode.gain.value = 1
            s.pannerNode.setPosition(0, 0, 0)
          }
        })
      } else {
        if (this.$store.state.me.uuid === payload.uuid) {
          // change volume of everyone relative to our new position
          this.remoteStreams.forEach(s => {
            this.recalcVolumeForRemoteStream(s)
          })
        } else {
          const stream = this.remoteStreams.find(s => s.uuid === payload.uuid)
          if (!stream) return
          this.recalcVolumeForRemoteStream(stream)
        }
      }
    }
  }

  @Socket(ClientSocketEvents.SetSettings)
  onSetSettings (payload: { settings: GameSettings }) {
    this.settings = payload.settings
  }

  recalcVolumeForRemoteStream (stream: { uuid: string; gainNode: GainNode; pannerNode: PannerNode }) {
    const client: ClientModel = this.$store.state.clients.find((c: ClientModel) => c.uuid === stream.uuid)
    if (!client) return
    if (this.$store.state.me.group === RoomGroup.Spectator && this.$store.state.clientOptions.omniscientGhosts) {
      stream.gainNode.gain.value = 1
      stream.pannerNode.setPosition(0, 0, 0)
    } else if (client.group !== RoomGroup.Spectator || this.$store.state.me.group === RoomGroup.Spectator) {
      const p2 = client.pose
      const p1 = (this.$store.state.me.flags & PlayerFlags.PA)
        ? getClosestCamera(p2, this.settings.map) || this.$store.state.me.pose
        : this.$store.state.me.pose

      this.setGainAndPan(client, stream, p1, p2)
    } else {
      stream.gainNode.gain.value = 0
    }
  }

  setGainAndPan (client: ClientModel, stream: { uuid: string; gainNode: GainNode; pannerNode: PannerNode }, p1: { x: number; y: number }, p2: { x: number; y: number }) {
    if (this.poseCollide(p1, p2) && this.$store.state.options.colliders) {
      stream.gainNode.gain.value = 0
      stream.pannerNode.setPosition(0, 0, 0)
    } else {
      stream.gainNode.gain.value = this.lerp(this.hypotPose(p1, p2))
      stream.pannerNode.setPosition(p2.x - p1.x, p2.y - p1.y, 1)
    }
  }

  poseCollide (p1: Pose, p2: Pose) {
    for (const collider of colliderMaps[this.settings.map]) {
      const intersections = intersect(collider,
        `M ${p1.x + 40} ${40 - p1.y} L ${p2.x + 40} ${40 - p2.y}`)
      if (intersections.length > 0) return true
    }
    return false
  }

  hypotPose (p1: Pose, p2: Pose) {
    return Math.hypot(p1.x - p2.x, p1.y - p2.y)
  }

  lerp (distance: number) {
    const trueVolume = 1 - (distance / this.LERP_VALUE)
    // clamp above 0, and then below 1
    return Math.min(Math.max(trueVolume, 0), 1)
  }

  toggleMute () {
    this.$store.state.muted = !this.$store.state.muted
    if (!this.$store.state.globalGainNode) {
      return
    }

    this.$store.state.globalGainNode.gain.value = this.$store.state.muted ? 0 : 1
  }

  toggleDeaf () {
    this.$store.state.deafened = !this.$store.state.deafened
    if (!this.$store.state.globalGainNode) {
      return
    }

    this.remoteStreams.forEach(stream => {
      stream.globalVolumeNode.gain.value = this.$store.state.deafened ? 0 : 1
    })
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

  get mymic () {
    return this.$store.state.mic
  }

  get LERP_VALUE () {
    return this.$store.state.options.falloffVision ? (2 + this.settings.crewmateVision) : this.$store.state.options.falloff
  }
}
</script>
<style scoped lang="stylus">
</style>
