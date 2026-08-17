export interface ViewportCanvasLike {
  clientWidth: number;
  clientHeight: number;
  width: number;
  height: number;
}

export interface ViewportRendererLike {
  resize(width: number, height: number, pixelRatio: number): void;
}

export interface ViewportMetrics {
  readonly width: number;
  readonly height: number;
  readonly pixelRatio: number;
  readonly pixelWidth: number;
  readonly pixelHeight: number;
}

export function measureViewportMetrics(
  canvas: Pick<ViewportCanvasLike, 'clientWidth' | 'clientHeight'>,
  pixelRatio: number,
): ViewportMetrics {
  const width = Math.max(1, Math.round(canvas.clientWidth));
  const height = Math.max(1, Math.round(canvas.clientHeight));
  const safePixelRatio = Math.max(1, pixelRatio || 1);

  return {
    width,
    height,
    pixelRatio: safePixelRatio,
    pixelWidth: Math.round(width * safePixelRatio),
    pixelHeight: Math.round(height * safePixelRatio),
  };
}

export function applyViewportMetrics(
  canvas: ViewportCanvasLike,
  renderer: ViewportRendererLike | null,
  pixelRatio: number,
): ViewportMetrics {
  const metrics = measureViewportMetrics(canvas, pixelRatio);
  canvas.width = metrics.pixelWidth;
  canvas.height = metrics.pixelHeight;
  renderer?.resize(metrics.width, metrics.height, metrics.pixelRatio);
  return metrics;
}
