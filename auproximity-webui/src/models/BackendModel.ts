export interface BackendModel {
  gameCode: string;
  backendType: BackendType;
}
export interface PublicLobbyBackendModel extends BackendModel {
  backendType: BackendType.PublicLobby;
  region: PublicLobbyRegion;
}
export interface ImpostorBackendModel extends BackendModel {
  backendType: BackendType.Impostor;
  ip: string;
}
export enum BackendType {
  NoOp,
  PublicLobby,
  Impostor
}
export enum PublicLobbyRegion {
  NorthAmerica,
  Europe,
  Asia
}

// Room groups
export enum RoomGroup {
  Main,
  Spectator
}
