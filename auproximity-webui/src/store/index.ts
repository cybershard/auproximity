import { BackendModel, BackendType, RoomGroup } from '@/models/BackendModel'
import ClientModel, { ColorID, MyMicModel, Pose } from '@/models/ClientModel'

import { ClientSocketEvents } from '@/models/ClientSocketEvents'
import { PlayerFlags } from '@/models/PlayerFlags'
import { HostOptions, ClientOptions } from '@/models/RoomModel'
import Vue from 'vue'
import Vuex from 'vuex'

Vue.config.devtools = true
Vue.use(Vuex)

const state: State = {
  joinedRoom: false,
  backendModel: {
    gameCode: '',
    backendType: BackendType.NoOp
  },
  mic: {
    volumeNode: undefined,
    destStream: undefined,
    levels: 0
  },
  globalGainNode: undefined,
  muted: false,
  deafened: false,
  me: {
    uuid: '',
    name: '',
    pose: {
      x: 0,
      y: 0
    },
    group: RoomGroup.Spectator,
    color: -1,
    flags: PlayerFlags.None
  },
  clients: [],
  options: {
    falloff: 4.5,
    falloffVision: false,
    colliders: true,
    paSystems: true
  },
  clientOptions: {
    omniscientGhosts: false
  },
  host: ''
}
export default new Vuex.Store({
  state,
  mutations: {
    setUuid (state: State, payload: string) {
      state.me.uuid = payload
    },
    addClient (state: State, client: ClientModel) {
      state.clients.push(client)
    },
    setAllClients (state: State, clients: ClientModel[]) {
      state.clients = clients
    },
    removeClient (state: State, uuid: string) {
      state.clients = state.clients.filter(c => c.uuid !== uuid)
    },
    setPose (state: State, payload: Pose) {
      state.me.pose = payload
    },
    setPoseOf (state: State, payload: { uuid: string; pose: Pose }) {
      const index = state.clients.findIndex(c => c.uuid === payload.uuid)

      if (index !== -1) {
        state.clients[index].pose = payload.pose
      }
    },
    setColor (state: State, color: ColorID) {
      state.me.color = color
    },
    setColorOf (state: State, payload: { uuid: string; color: ColorID }) {
      const index = state.clients.findIndex(c => c.uuid === payload.uuid)

      if (index !== -1) {
        state.clients[index].color = payload.color
      }
    },
    setFlags (state: State, flags: PlayerFlags) {
      state.me.flags |= flags
    },
    setFlagsOf (state: State, payload: { uuid: string; flags: PlayerFlags }) {
      const index = state.clients.findIndex(c => c.uuid === payload.uuid)

      if (index !== -1) {
        state.clients[index].flags |= payload.flags
      }
    },
    unsetFlags (state: State, flags: PlayerFlags) {
      state.me.flags &= ~flags
    },
    unsetFlagsOf (state: State, payload: { uuid: string; flags: PlayerFlags }) {
      const index = state.clients.findIndex(c => c.uuid === payload.uuid)

      if (index !== -1) {
        state.clients[index].flags &= ~payload.flags
      }
    },
    setGroup (state: State, payload: RoomGroup) {
      state.me.group = payload
    },
    setGroupOf (state: State, payload: { uuid: string; group: RoomGroup }) {
      const index = state.clients.findIndex(c => c.uuid === payload.uuid)
      if (index !== -1) {
        state.clients[index].group = payload.group
      }
    },
    setJoinedRoom (state: State, payload: boolean) {
      state.joinedRoom = payload
    },
    setNameAndBackendModel (state: State, payload: { name: string; backendModel: BackendModel }) {
      state.me.name = payload.name
      state.backendModel = payload.backendModel
    },
    setHost (state: State, payload: { hostname: string }) {
      state.host = payload.hostname
    },
    setOptions (state: State, payload: { options: HostOptions }) {
      state.options = payload.options
    }
  },
  actions: {
    destroyConnection ({ commit }) {
      commit('setUuid', '')
      commit('setJoinedRoom', false)
      commit('setNameAndBackendModel', {
        name: '',
        backendModel: {
          gameCode: '',
          backendType: BackendType.NoOp
        }
      })
    },
    [`socket_${ClientSocketEvents.Error}`] ({ dispatch }, payload: { fatal: boolean }) {
      if (payload.fatal) dispatch('destroyConnection')
    },
    [`socket_${ClientSocketEvents.Disconnect}`] ({ dispatch }) {
      dispatch('destroyConnection')
    },
    [`socket_${ClientSocketEvents.SetUuid}`] ({ commit }, uuid: string) {
      commit('setUuid', uuid)
    },
    [`socket_${ClientSocketEvents.AddClient}`] ({ commit }, payload: ClientModel) {
      const client: ClientModel = {
        uuid: payload.uuid,
        name: payload.name,
        pose: payload.pose,
        group: payload.group,
        color: payload.color,
        flags: payload.flags
      }
      commit('addClient', client)
    },
    [`socket_${ClientSocketEvents.SetAllClients}`] ({ commit }, payload: ClientModel[]) {
      const clients: ClientModel[] = payload.map(c => ({
        uuid: c.uuid,
        name: c.name,
        pose: c.pose,
        group: c.group,
        color: c.color,
        flags: c.flags
      }))
      commit('setAllClients', clients)
    },
    [`socket_${ClientSocketEvents.RemoveClient}`] ({ commit }, uuid: string) {
      commit('removeClient', uuid)
    },
    [`socket_${ClientSocketEvents.SetPose}`] ({ commit, state }, payload: { uuid: string; pose: Pose }) {
      if (payload.uuid === state.me.uuid) {
        commit('setPose', payload.pose)
      } else {
        commit('setPoseOf', { uuid: payload.uuid, pose: payload.pose })
      }
    },
    [`socket_${ClientSocketEvents.SetColorOf}`] ({ commit, state }, payload: { uuid: string; color: ColorID }) {
      if (payload.uuid === state.me.uuid) {
        commit('setColor', payload.color)
      } else {
        commit('setColorOf', { uuid: payload.uuid, color: payload.color })
      }
    },
    [`socket_${ClientSocketEvents.SetGroup}`] ({ commit, state }, payload: { uuid: string; group: RoomGroup }) {
      if (payload.uuid === state.me.uuid) {
        commit('setGroup', payload.group)
      } else {
        commit('setGroupOf', { uuid: payload.uuid, group: payload.group })
      }
    },
    [`socket_${ClientSocketEvents.SetHost}`] ({ commit }, payload: { hostname: string }) {
      commit('setHost', { hostname: payload.hostname })
    },
    [`socket_${ClientSocketEvents.SetFlagsOf}`] ({ commit, state }, payload: { uuid: string; flags: PlayerFlags }) {
      if (payload.uuid === state.me.uuid) {
        commit('setFlags', payload.flags)
      } else {
        commit('setFlagsOf', { uuid: payload.uuid, flags: payload.flags })
      }
    },
    [`socket_${ClientSocketEvents.UnsetFlagsOf}`] ({ commit, state }, payload: { uuid: string; flags: PlayerFlags }) {
      if (payload.uuid === state.me.uuid) {
        commit('unsetFlags', payload.flags)
      } else {
        commit('unsetFlagsOf', { uuid: payload.uuid, flags: payload.flags })
      }
    }
  },
  modules: {
  }
})
export interface State {
  joinedRoom: boolean;
  backendModel: {
    gameCode: string;
    backendType: BackendType;
  };
  mic: MyMicModel;
  globalGainNode: GainNode|undefined;
  muted: boolean;
  deafened: boolean;
  me: ClientModel;
  clients: ClientModel[];
  options: HostOptions;
  clientOptions: ClientOptions;
  host: string;
}
