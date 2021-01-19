import { RoomGroup } from './BackendModel'
import { PlayerFlags } from './PlayerFlags'

export default interface ClientModel {
  uuid: string;
  name: string;
  pose: Pose;
  group: RoomGroup;
  color: ColorID;
  flags: PlayerFlags;
}

export interface Pose {
  x: number;
  y: number;
}

export interface RemoteStreamModel {
  uuid: string;
  source: MediaStreamAudioSourceNode;
  gainNode: GainNode;
  globalVolumeNode: GainNode;
  volumeNode: GainNode;
  pannerNode: PannerNode;
  remoteStream: MediaStream;
  levels: number;
}

export interface MyMicModel {
  volumeNode: GainNode | undefined;
  destStream: MediaStreamAudioDestinationNode | undefined;
  levels: number;
}

export enum ColorID {
  Red = 0,
  Blue = 1,
  DarkGreen = 2,
  Pink = 3,
  Orange = 4,
  Yellow = 5,
  Black = 6,
  White = 7,
  Purple = 8,
  Brown = 9,
  Cyan = 10,
  Lime = 11
}
