declare module "night-vision" {
  export type CandleData = [timeMs: number, open: number, high: number, low: number, close: number, volume?: number];
  export type SplineData = [timeMs: number, value: number];

  export type Overlay = {
    name: string;
    type: string;
    main?: boolean;
    data?: Array<CandleData | SplineData>;
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
    timezone?: number;
  };

  export class NightVision {
    constructor(target: string, props?: NightVisionProps);
    data: NightVisionData;
    range: unknown;
    update(type?: string, opt?: Record<string, unknown>): void;
    fullReset(): void;
    destroy(): void;
  }
}
