const consts = {
  SERVER_URL: window.location.origin,
  PEER_CONFIG: {
    host: window.location.hostname,
    secure: true,
    path: '/peerjs'
  }
}

if (window.location.hostname === 'localhost') {
  // Assume we are in dev environment
  consts.SERVER_URL = 'http://localhost:8079'
  consts.PEER_CONFIG.secure = false
  consts.PEER_CONFIG['port'] = 8079
}

export default consts
