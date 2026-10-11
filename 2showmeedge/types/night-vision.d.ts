declare module "night-vision" {
  export type CandleData = [timeMs: number, open: number, high: number, low: number, close: number, volume?: number];
  export type SplineData = [timeMs: number, value: number];

  export type Overlay = {
    name: string;
    type: string;
    main?: boolean;
    data?: Array<CandleData | SplineData | number[]>;
    settings?: {
      display?: boolean;
      precision?: number;
      scale?: string;
      zIndex?: number;
    };
    props?: Record<string, unknown>;
  };

  export type NightVisionData = {
    indexBased?: boolean;
    panes: Array<{
      overlays: Overlay[];
      settings?: Record<string, unknown>;
    }>;
  };

  export type NightVisionProps = {
    id?: string;
    width?: number;
    height?: number;
    autoResize?: boolean;
    colors?: Record<string, string>;
    data?: NightVisionData;
    indexBased?: boolean;
    showLogo?: boolean;
    scripts?: string[];
    timezone?: number;
  };

  export type NightVisionEvents = {
    on<TEvent = unknown>(componentAndType: string, handler: (event: TEvent) => void): void;
    off(component: string, type?: string): void;
  };

  export class NightVision {
    constructor(target: string, props?: NightVisionProps);
    data: NightVisionData;
    events: NightVisionEvents;
    range: unknown;
    update(type?: string, opt?: Record<string, unknown>): void;
    fullReset(): void;
    destroy(): void;
  }
}
