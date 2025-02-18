declare module 'svgdom' {
    export interface SVGWindow extends Window {
        SVGElement: typeof SVGElement;
        document: Document;
    }
    export function createSVGWindow(): SVGWindow;
}

declare module '@svgdotjs/svg.js' {
    interface Point {
        x: number;
        y: number;
    }

    interface Box extends Point {
        width: number;
        height: number;
    }

    interface FontOptions {
        family: string;
        size: number;
        weight?: string;
        style?: string;
    }

    interface TextDecorationAttributes {
        'text-decoration'?: string;
        'text-anchor'?: 'start' | 'middle' | 'end';
        'dominant-baseline'?: string;
    }

    interface CustomSVGElement extends SVGElement {
        element(tagName: string): CustomSVGElement;
        words(text: string): void;
        font(options: FontOptions): this;
        fill(color: string): this;
        stroke(color: string): this;
        x(x: number): this;
        y(y: number): this;
        text(content: string): this;
        plain(content: string): this;
        tspan(text: string): this;
        dy(value: number | string): this;
        dx(value: number | string): this;
        attr(name: string | Record<string, string | number>): this;
        toPaths(): void;
        remove(): void;
        addClass(className: string): this;
        removeClass(className: string): this;
        node: SVGElement;
        getBBox(): { x: number; y: number; width: number; height: number };
        opacity(value: number): this;
        move(x: number, y: number): this;
    }

    interface Text extends CustomSVGElement {
        toPaths(): void;
    }

    interface SVGContainer {
        size(width: number, height: number): SVGContainer;
        width(): number;
        height(): number;
        viewbox(x: number, y: number, width: number, height: number): SVGContainer;
        attr(attrs: Record<string, string | number>): SVGContainer;
        element(tagName: string): CustomSVGElement;
        text(content: string | ((add: { tspan: (text: string) => void }) => void)): Text;
        defs(): CustomSVGElement;
        svg(): string;
    }

    export function SVG(element: HTMLElement | string): SVGContainer;
    export function registerWindow(window: Window, document: Document): void;
}