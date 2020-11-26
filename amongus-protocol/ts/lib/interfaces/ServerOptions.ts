export interface ServerOptions {
    /**
     * Whether or not to display debug messages to the console.
     */
    debug?: boolean;
    
    /**
     * Whether or not to display server log messages to the console.
     */
    logs?: boolean;

    /**
     * How long to wait for reliable packet acknowledgment before trying again.
     */
    ackInterval?: number;

    /**
     * The client versions that the server accepts.
     */
    versions?: string[];

    /**
     * The number of seconds to wait for a disconnect reply before closing it automatically.
     */
    disconnectTimeout?: number;

    /**
     * How often to ping a client once connected.
     */
    pingInterval?: number;
}