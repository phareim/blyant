/* Blyant — types as documentation. Components are HTML classes plus a few JS helpers on window.Blyant. */

/** <button class="b-btn b-btn--primary">. Call Blyant.ink(root) to draw the pencil outline. */
export interface ButtonProps { variant?: "default" | "primary" | "marker" | "quiet"; size?: "md" | "sm" | "icon"; disabled?: boolean; }
/** <label class="b-field"><span class="b-field__label"/><input class="b-input"/><span class="b-field__hint"/></label> */
export interface FieldProps { label: string; hint?: string; invalid?: boolean; control?: "input" | "select" | "textarea"; }
/** <label class="b-check [b-check--radio]"><input/><span class="b-check__box"/>Label</label>, or .b-switch */
export interface CheckProps { kind?: "checkbox" | "radio" | "switch"; checked?: boolean; label: string; }
/** <div class="b-box [b-box--raised|--flat|--dashed]"> or .b-callout */
export interface BoxProps { variant?: "default" | "raised" | "flat" | "dashed" | "callout"; }
/** <div class="b-note [b-note--blue|green|red|purple]" style="--b-tilt:1deg"> */
export interface NoteProps { color?: "marker" | "blue" | "green" | "red" | "purple"; tilt?: string; }
/** <span class="b-tag b-tag--green"><span class="b-dot"/>Klar</span>; also .b-avatar, .b-kbd, .b-progress */
export interface TagProps { tone?: "neutral" | "red" | "orange" | "yellow" | "green" | "blue" | "purple" | "marker"; dot?: boolean; }
/** <mark> or <span class="b-mark [b-mark--green|blue|red|purple]">; .b-underline; .b-scribble */
export interface MarkerProps { tone?: "marker" | "green" | "blue" | "red" | "purple"; }
/** <nav class="b-nav"><a class="b-nav__brand"/><ul class="b-nav__links"><li><a class="b-nav__link" aria-current="page"/></li></ul></nav> */
export interface NavProps { brand: string; links: { label: string; href: string; current?: boolean }[]; }
/** <div class="b-tabs" role="tablist"><button class="b-tab" role="tab" aria-selected="true"/></div> */
export interface TabsProps { tabs: string[]; selected: number; }
/** <div class="b-table-wrap"><table class="b-table"> — numeric cells get class="num" */
export interface TableProps { columns: { label: string; numeric?: boolean }[]; rows: (string | number)[][]; }
/** <div class="b-ph" style="--ratio:16/9"><span>what goes here</span></div> */
export interface PlaceholderProps { ratio?: string; label: string; }
/** <div class="b-slide"> with __kicker, __title, __body, __foot */
export interface SlideProps { kicker?: string; title: string; body?: string; foot?: [string, string]; }

export interface RoughOptions { seed?: number; wobble?: number; passes?: number; bow?: number; gap?: number; angle?: number; }
export type Shape =
  | { type: "line"; x1: number; y1: number; x2: number; y2: number }
  | { type: "rect"; x: number; y: number; w: number; h: number }
  | { type: "circle"; cx: number; cy: number; r: number }
  | { type: "ellipse"; cx: number; cy: number; rx: number; ry: number }
  | { type: "hex"; cx: number; cy: number; r: number; flat?: boolean }
  | { type: "poly" | "curve"; points: [number, number][]; closed?: boolean }
  | { type: "arrow"; x1: number; y1: number; x2: number; y2: number; bend?: number }
  | { type: "hatch"; points: [number, number][]; gap?: number; angle?: number };
/** Blyant.figure(svg, shapes) — fill, fillOpacity, stroke, width, wobble, seed apply to every shape. */
export interface RoughProps { shapes: (Shape & { fill?: string; fillOpacity?: number; stroke?: string; width?: number; wobble?: number; seed?: number })[]; }

/** new Blyant.Sketch3D(container, options). Needs window.THREE (three.js r147 UMD). */
export interface Sketch3DProps {
  camera?: "perspective" | "ortho"; fov?: number; lineWidth?: number; hatch?: boolean; hatchGap?: number;
  grain?: boolean; boil?: boolean; wobble?: number; pixelRatio?: number;
}
/** new Blyant.HexBoard(container, options) — a hex world with a hopping figure, built on Sketch3D. */
export interface HexBoardProps {
  radius?: number; seed?: number; gems?: number; size?: number; interactive?: boolean;
  keyboardTarget?: EventTarget; sketch?: Sketch3DProps;
  onCollect?: (found: number, total: number) => void; onMove?: (cell: [number, number]) => void;
}

export interface BlyantGlobal {
  rough: {
    line(x1: number, y1: number, x2: number, y2: number, o?: RoughOptions): string;
    rect(x: number, y: number, w: number, h: number, o?: RoughOptions): string;
    circle(cx: number, cy: number, r: number, o?: RoughOptions): string;
    ellipse(cx: number, cy: number, rx: number, ry: number, o?: RoughOptions): string;
    hex(cx: number, cy: number, r: number, o?: RoughOptions, flat?: boolean): string;
    poly(points: [number, number][], closed: boolean, o?: RoughOptions): string;
    arrow(x1: number, y1: number, x2: number, y2: number, o?: RoughOptions & { bend?: number }): string;
    hatch(points: [number, number][], o?: RoughOptions): string;
    scribble(points: [number, number][], o?: RoughOptions): string;
  };
  figure(svg: SVGSVGElement, shapes: RoughProps["shapes"], defaults?: { wobble?: number }): SVGSVGElement;
  draw(svg: SVGSVGElement, d: string, style?: { stroke?: string; width?: number; fill?: string; opacity?: number }): SVGPathElement;
  /** Draw pencil outlines on every Blyant component under root. Safe to call again. */
  ink(root?: ParentNode): void;
  reink(root?: ParentNode): void;
  setSkin(skin: "sketch" | "clean" | string, node?: Element): void;
  hexgrid: {
    DIRS: [number, number][];
    toXZ(q: number, r: number, size: number): [number, number];
    dist(a: [number, number], b: [number, number]): number;
    ring(radius: number): [number, number][];
    path(a: [number, number], b: [number, number], ok: (q: number, r: number) => boolean): [number, number][] | null;
  };
  Sketch3D: new (container: HTMLElement, options?: Sketch3DProps) => any;
  HexBoard: new (container: HTMLElement, options?: HexBoardProps) => any;
}
export interface ChartSeries { name: string; values: (number | null)[]; color?: string; }
interface ChartBase { title?: string; subtitle?: string; unit?: string; format?: (v: number) => string; height?: number; }
/** Blyant.chart.line(el, props) */
export interface LineChartProps extends ChartBase { x: string[]; xLabel?: string; series: ChartSeries[]; area?: boolean; yMin?: number; xEvery?: number; endLabels?: boolean; }
/** Blyant.chart.bar(el, props) */
export interface BarChartProps extends ChartBase { categories: string[]; categoryLabel?: string; series: ChartSeries[]; stacked?: boolean; horizontal?: boolean; highlight?: number; labels?: "auto" | "all" | "none"; }
/** Blyant.chart.scatter(el, props) — max three series */
export interface ScatterChartProps extends ChartBase { series: { name: string; points: [number, number, string?][]; color?: string }[]; xLabel?: string; yLabel?: string; xFormat?: (v: number) => string; labelPoints?: string[]; }
/** Blyant.chart.segments(el, props) — one whole split into parts */
export interface SegmentsProps extends ChartBase { parts: { name: string; value: number; color?: string }[]; }
/** Blyant.chart.stat(el, props) */
export interface StatProps { label: string; value: number | string; unit?: string; delta?: number; deltaUnit?: string; deltaLabel?: string; upIsGood?: boolean; trend?: number[]; trendColor?: string; }
/** What every chart returns. */
export interface ChartHandle { update(patch: object): void; table(show?: boolean): boolean; destroy(): void; }

declare global { interface Window { Blyant: BlyantGlobal & { chart: {
  line(el: HTMLElement, p: LineChartProps): ChartHandle; bar(el: HTMLElement, p: BarChartProps): ChartHandle;
  scatter(el: HTMLElement, p: ScatterChartProps): ChartHandle; segments(el: HTMLElement, p: SegmentsProps): ChartHandle;
  stat(el: HTMLElement, p: StatProps): HTMLElement; spark(el: HTMLElement, values: number[], o?: { color?: string; width?: number; height?: number }): SVGSVGElement;
} } } }
