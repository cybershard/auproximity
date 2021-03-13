import { Vector2 } from '@skeldjs/util'

export enum PlayerFlag {
  None = 0,
  IsImpostor = 1,
  IsDead = 2,
  OnCams = 4,
  InVent = 8
}

export interface ClientModel {
  uuid: string;
  name: string;
  position: Vector2;
  color: ColorID;
  flags: PlayerFlag;
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
