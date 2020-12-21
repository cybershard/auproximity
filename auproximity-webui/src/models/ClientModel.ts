import { RoomGroup } from '@/models/BackendModel'

export default interface ClientModel {
  uuid: string;
  name: string;
  pose: Pose;
  group: RoomGroup;
  color: ColorID;
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
  pannerNode: PannerNode;
  remoteStream: MediaStream;
}

export interface MyMicModel {
  volumeNode: GainNode | undefined;
  destStream: MediaStreamAudioDestinationNode | undefined;
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
