/* Blyant — types as documentation. Components are HTML classes plus a few JS helpers on window.Blyant. */

/** <button class="b-btn b-btn--primary">. Call Blyant.ink(root) to draw the pencil outline. */
export interface ButtonProps { variant?: "default" | "primary" | "marker" | "quiet"; size?: "md" | "sm" | "icon"; disabled?: boolean; }
/** <label class="b-field"><span class="b-field__label"/><input class="b-input"/><span class="b-field__hint"/></label> */
export interface FieldProps { label: string; hint?: string; invalid?: boolean; control?: "input" | "select" | "textarea"; /** b-input--line: no box, a pencil rule under the text */ line?: boolean; }
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

/** <article class="b-prose b-flow"> around HTML from Markdown; .b-meta under the title; figure + figcaption for pictures. */
export interface ProseProps { flow?: boolean; meta?: string[]; }
/** <label class="b-sidenote__ref" for="n1"></label><input class="b-sidenote__toggle" type="checkbox" id="n1"><span class="b-sidenote">…</span> inside .b-sidenotes */
export interface SidenoteProps { id: string; text: string; }
/** <ul class="b-entries"><li class="b-entry"><time class="b-entry__meta"/><a class="b-entry__title"/><p class="b-entry__summary"/></li></ul> */
export interface EntriesProps { entries: { title: string; href: string; meta?: string; summary?: string }[]; /** b-entries--compact: one line per entry, meta to the right */ compact?: boolean; }
/** <div class="b-empty [b-empty--center]"><svg class="b-empty__art" data-doodle="ark"/><div class="b-empty__body"><p class="b-empty__title"/><p class="b-empty__text"/></div></div> */
export interface EmptyProps { title: string; text?: string; doodle?: "ark" | "ide" | "ukjent"; center?: boolean; }
/** <ul class="b-menu" role="listbox"><li class="b-menu__label"/><li class="b-menu__item [is-active]" role="option"><span class="b-menu__text"/><span class="b-menu__hint"/></li></ul>; aria-checked on an item draws a tick */
export interface MenuProps { items: { text: string; hint?: string; active?: boolean; checked?: boolean; disabled?: boolean }[]; label?: string; empty?: string; }
/** <div class="b-toasts"><div class="b-toast [b-toast--error]" role="status"><span>Text</span><button class="b-toast__action">Angre</button></div></div> */
export interface ToastProps { text: string; error?: boolean; action?: string; }
/** class="b-editor" on a textarea, a contenteditable or an editor's content node; parts b-editor__syntax, __h1, __h2, __h3, __quote, __code, __rule, __placeholder. --b-editor-size sets the text size. */
export interface EditorProps { size?: string; }
/** <div class="b-toolbar [b-toolbar--vertical|--compact]" role="toolbar" aria-label="Verktøy"><button class="b-toolbar__btn [b-toolbar__btn--marker] [is-busy]" aria-pressed aria-label title><svg viewBox="0 0 64 64"/></button><span class="b-toolbar__sep"/></div>;
    choices: .b-toolbar__swatch (style="--b-swatch: var(--dust-red)"), .b-toolbar__size (style="--b-size: 4px"), .b-toolbar__text. The app places it. */
export interface ToolbarProps { tools: { label: string; pressed?: boolean; marker?: boolean; busy?: boolean; disabled?: boolean }[]; vertical?: boolean; compact?: boolean; label: string; }

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
  /** Draw a path with graphite grain. The grain filter's region follows the path; a path too large for WebKit's filter limit is drawn without grain. grain: false turns it off. */
  draw(svg: SVGSVGElement, d: string, style?: { stroke?: string; width?: number; fill?: string; fillOpacity?: number; opacity?: number; dash?: string; grain?: boolean }): SVGPathElement;
  /** Like draw, but a path too large for one grain region becomes one <path> per subpath, so it keeps the grain. ink, figure and frames use it. */
  drawParts(svg: SVGSVGElement, d: string, style?: { stroke?: string; width?: number; fill?: string; fillOpacity?: number; opacity?: number; dash?: string; grain?: boolean }): SVGPathElement[];
  /** The shared grain filter for a box in user units, as "url(#…)", or null if the box is too large for WebKit at 3×. Without a box: a region from the svg's viewBox. */
  grainFilter(svg?: SVGSVGElement, box?: { x: number; y: number; w: number; h: number }, strokeWidth?: number): string | null;
  /** Bounding box of SVG path data, control points included; null if it can't be read. */
  pathBox(d: string): { x: number; y: number; w: number; h: number } | null;
  /** Draw a ready-made doodle in an <svg> (default viewBox 0 0 120 90). Blyant.ink also draws every svg[data-doodle]. */
  doodle(svg: SVGSVGElement, name?: "ark" | "ide" | "ukjent"): SVGSVGElement;
  doodles: string[];
  /** Draw pencil outlines on every Blyant component under root, and every svg[data-doodle]. Safe to call again. */
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

/** Blyant.frames(el, props) — comic-book panels that fill any box. */
export interface FramesProps { count?: number; geometry?: number; seed?: number; gutter?: number; minSize?: number; numbers?: boolean; render?: (panel: FramePanel, index: number, fresh: boolean) => void; }
export interface FramePanel { index: number; points: [number, number][]; bbox: { x: number; y: number; w: number; h: number }; safe: { x: number; y: number; w: number; h: number }; area: number; pop: boolean; el?: HTMLElement; body?: HTMLElement; }
export interface FramesHandle { el: HTMLElement; panels: FramePanel[]; layout(): FramesHandle; update(patch: Partial<FramesProps>): FramesHandle; destroy(): void; }

declare global { interface Window { Blyant: BlyantGlobal & { chart: {
  line(el: HTMLElement, p: LineChartProps): ChartHandle; bar(el: HTMLElement, p: BarChartProps): ChartHandle;
  scatter(el: HTMLElement, p: ScatterChartProps): ChartHandle; segments(el: HTMLElement, p: SegmentsProps): ChartHandle;
  stat(el: HTMLElement, p: StatProps): HTMLElement; spark(el: HTMLElement, values: number[], o?: { color?: string; width?: number; height?: number }): SVGSVGElement;
};
  frames: { (el: HTMLElement, p?: FramesProps): FramesHandle; layout(w: number, h: number, p?: FramesProps): FramePanel[] };
} } }
