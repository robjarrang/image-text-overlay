declare module 'gif-encoder-2' {
  class GIFEncoder {
    constructor(width: number, height: number, algorithm?: string, useOptimizer?: boolean, totalFrames?: number);
    
    setDelay(delay: number): void;
    setRepeat(repeat: number): void;
    setQuality(quality: number): void;
    setTransparent(color: number | string): void;
    setDispose(dispose: number): void;
    
    start(): void;
    finish(): void;
    
    addFrame(ctx: CanvasRenderingContext2D | ImageData | Uint8ClampedArray): void;
    
    out: {
      getData(): Uint8Array;
    };
  }
  
  export = GIFEncoder;
}

declare module 'gifuct-js' {
  interface GIFFrame {
    dims: {
      width: number;
      height: number;
      top: number;
      left: number;
    };
    patch: Uint8ClampedArray;
    delay: number;
    disposalType: number;
    transparentIndex?: number;
  }
  
  interface ParsedGIF {
    lsd: {
      width: number;
      height: number;
      backgroundColorIndex: number;
    };
    gct?: number[][];
    frames: any[];
  }
  
  export function parseGIF(arrayBuffer: ArrayBuffer): ParsedGIF;
  export function decompressFrames(gif: ParsedGIF, buildPatch?: boolean): GIFFrame[];
}
