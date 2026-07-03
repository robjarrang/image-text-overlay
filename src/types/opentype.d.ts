declare module 'axios' {
  import { AxiosRequestConfig, AxiosResponse } from 'axios';

  export interface AxiosError<T = unknown> extends Error {
    code?: string;
    config: AxiosRequestConfig;
    status?: number;
    response?: AxiosResponse<T>;
  }
  
  export function isAxiosError(error: unknown): error is AxiosError;
}

declare module 'opentype.js' {
    interface Path {
        getBoundingBox(): {
            x1: number;
            y1: number;
            x2: number;
            y2: number;
        };
        toPathData(): string;
        toSVG(): string;
        extend(path: Path | Glyph): void;
    }

    interface Font {
        getPath(text: string, x: number, y: number, fontSize: number): Path;
        getAdvanceWidth(text: string, fontSize: number, options?: any): number;
        stringToGlyphs(text: string): Glyph[];
        charToGlyph(char: string): Glyph;
        unitsPerEm: number;
    }

    interface Glyph {
        index: number;
        advanceWidth: number;
        getPath(x: number, y: number, fontSize: number): Path;
    }

    export const Path: { new (): Path };

    export function parse(buffer: ArrayBuffer): Font;
}