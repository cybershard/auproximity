export interface BufferWriterOptions {
    /**
     * The initial size of the writer.
     */
    initial?: number;

    /**
     * Whether or not the writer can expand to fit its contents.
     */
    dynamic?: boolean;

    /**
     * The maximum size of the writer.
     */
    maxSize?: number;
}