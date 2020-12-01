const consts: {
  SERVER_URL: string;
  PEER_CONFIG: {
    host: string;
    secure: boolean;
    path: '/peerjs';
    port?: number;
    debug: 0 | 1 | 2 | 3;
  };
} = {
  SERVER_URL: window.location.origin,
  PEER_CONFIG: {
    host: window.location.hostname,
    secure: true,
    path: '/peerjs',
    debug: 3
  }
}

if (window.location.hostname === 'localhost') {
  // Assume we are in dev environment
  consts.SERVER_URL = 'http://localhost:8079'
  consts.PEER_CONFIG.secure = false
  consts.PEER_CONFIG.port = 8079
}

export default consts
