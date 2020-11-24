import Vue from 'vue'
import Vuex from 'vuex'
import ClientSocketEvents from '@/models/ClientSocketEvents'
import ClientModel, { Pose } from '@/models/ClientModel'
import { BackendModel, BackendType, RoomGroup } from '@/models/BackendModel'

Vue.use(Vuex)

const state: State = {
  joinedRoom: false,
  backendModel: {
    gameCode: '',
    backendType: BackendType.NoOp
  },
  micVolumeNode: null,
  message: '',
  showPopup: false,
  me: {
    uuid: '',
    name: '',
    pose: {
      x: 0,
      y: 0
    },
    group: RoomGroup.Spectator
  },
  clients: []
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
    [`socket_${ClientSocketEvents.Error}`] ({ dispatch }) {
      dispatch('destroyConnection')
    },
    [`socket_${ClientSocketEvents.Disconnect}`] ({ dispatch }) {
      dispatch('destroyConnection')
    },
    [`socket_${ClientSocketEvents.SetUuid}`] ({ commit }, uuid: string) {
      commit('setUuid', uuid)
    },
    [`socket_${ClientSocketEvents.AddClient}`] ({ commit }, payload: { uuid: string; name: string }) {
      const client: ClientModel = {
        uuid: payload.uuid,
        name: payload.name,
        pose: { x: 0, y: 0 },
        group: RoomGroup.Main
      }
      commit('addClient', client)
    },
    [`socket_${ClientSocketEvents.SetAllClients}`] ({ commit }, payload: { uuid: string; name: string }[]) {
      const clients: ClientModel[] = payload.map(c => ({
        uuid: c.uuid,
        name: c.name,
        pose: { x: 0, y: 0 },
        group: RoomGroup.Main
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
    [`socket_${ClientSocketEvents.SetGroup}`] ({ commit, state }, payload: { uuid: string; group: RoomGroup }) {
      if (payload.uuid === state.me.uuid) {
        commit('setGroup', payload.group)
      } else {
        commit('setGroupOf', { uuid: payload.uuid, group: payload.group })
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
  micVolumeNode: GainNode|null;
  message: string;
  showPopup: boolean;
  me: ClientModel;
  clients: ClientModel[];
}
