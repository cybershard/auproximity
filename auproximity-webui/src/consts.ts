const consts: {
  SERVER_URL: string;
  PEER_CONFIG: {
    host: string;
    secure: boolean;
    path: '/peerjs';
    port?: number;
    debug: 0 | 1 | 2 | 3;
  };
  DISCORD_INVITE_URL: string;
  GITHUB_URL: string;
} = {
  SERVER_URL: window.location.origin,
  PEER_CONFIG: {
    host: window.location.hostname,
    secure: true,
    path: '/peerjs',
    debug: 1
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
