const PRODUCTION_HOSTNAME = 'auproxy.herokuapp.com'
const DEVELOPMENT_HOSTNAME = 'localhost'
const PRODUCTION_PORT = 443
const DEVELOPMENT_PORT = 8079 // this is the port of the backend server on the dev environment

export const SERVER_HOSTNAME = process.env.NODE_ENV === 'production' ? PRODUCTION_HOSTNAME : DEVELOPMENT_HOSTNAME
export const SERVER_PORT = process.env.NODE_ENV === 'production' ? PRODUCTION_PORT : DEVELOPMENT_PORT
export const SERVER_SECURE = process.env.NODE_ENV === 'production'

export const SOCKETIO_URL = `${process.env.NODE_ENV === 'production' ? 'https' : 'http'}://${SERVER_HOSTNAME}:${SERVER_PORT}`
