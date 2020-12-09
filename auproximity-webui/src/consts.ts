import { PeerJSOption } from 'peerjs'

const consts: {
  SERVER_URL: string;
  PEER_CONFIG: PeerJSOption;
  DISCORD_INVITE_URL: string;
  GITHUB_URL: string;
} = {
  SERVER_URL: window.location.origin,
  PEER_CONFIG: {
    host: window.location.hostname,
    secure: true,
    port: 433,
    path: '/peerjs',
    debug: 1,
    config: {
      iceServers: [
        {
          urls: 'stun:stun.l.google.com:19302'
        },
        {
          urls: 'turn:68.183.101.44:3478',
          username: 'auproximity',
          credential: 'nearby'
        }
      ]
    }
  },
  DISCORD_INVITE_URL: 'https://discord.gg/gvQzM4GYbv',
  GITHUB_URL: 'https://github.com/cybershard/auproximity'
}

if (window.location.hostname === 'localhost') {
  // Assume we are in dev environment
  consts.SERVER_URL = 'http://localhost:8079'
  consts.PEER_CONFIG.secure = false
  consts.PEER_CONFIG.port = 8079
}

export default consts
