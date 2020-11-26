import { DebugOptions } from "../constants/DebugOptions";

export interface ClientOptions {
    /**
     * Whether or not to display debug messages to console.
     */
    debug?: DebugOptions;
    
    /**
     * How long to wait for reliable packet acknowledgment before trying again.
     */
    ackInterval?: number;
}