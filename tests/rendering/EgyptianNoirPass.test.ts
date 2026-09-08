import { describe, expect, it } from 'vitest';
import {
  EgyptianNoirShader,
  createEgyptianNoirController,
} from '@/rendering/postfx/EgyptianNoirPass.js';

describe('EgyptianNoirPass — Post-processing Egyptian Noir (P11)', () => {
  it('EgyptianNoirShader contiene vertex, fragment e uniform validi', () => {
    expect(EgyptianNoirShader.name).toBe('EgyptianNoirShader');
    expect(EgyptianNoirShader.vertexShader.length).toBeGreaterThan(20);
    expect(EgyptianNoirShader.fragmentShader.length).toBeGreaterThan(50);
    expect(EgyptianNoirShader.uniforms.tDiffuse).toBeDefined();
    expect(EgyptianNoirShader.uniforms.uVignette.value).toBeGreaterThan(0);
  });

  it('createEgyptianNoirController aggiorna i parametri rispettando i clamp', () => {
    const uniforms = {
      tDiffuse: { value: null },
      uTime: { value: 0 },
      uVignette: { value: 0.4 },
      uContrast: { value: 1.1 },
      uWarmth: { value: 0.2 },
      uGrainIntensity: { value: 0.04 },
    };

    const controller = createEgyptianNoirController(uniforms);

    controller.update(12.5);
    expect(uniforms.uTime.value).toBe(12.5);

    controller.setVignette(1.5); // deve essere clampato a 1
    expect(uniforms.uVignette.value).toBe(1);

    controller.setWarmth(-0.5); // deve essere clampato a 0
    expect(uniforms.uWarmth.value).toBe(0);

    controller.setContrast(1.35);
    expect(uniforms.uContrast.value).toBeCloseTo(1.35, 2);

    controller.setGrain(0.08);
    expect(uniforms.uGrainIntensity.value).toBeCloseTo(0.08, 2);
  });
});
