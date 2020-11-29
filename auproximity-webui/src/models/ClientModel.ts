import { RoomGroup } from '@/models/BackendModel'

export default interface ClientModel {
  uuid: string;
  name: string;
  pose: Pose;
  group: RoomGroup;
}

export interface Pose {
  x: number;
  y: number;
}

export interface RemoteStreamModel {
  uuid: string;
  source: MediaStreamAudioSourceNode;
  gainNode: GainNode;
  volumeNode: GainNode;
  remoteStream: MediaStream;
}

export interface MyMicModel {
  volumeNode: GainNode | undefined;
  destStream: MediaStreamAudioDestinationNode | undefined;
}
