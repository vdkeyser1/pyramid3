/**
 * Scopo: EgyptianNoirPass (P11) — shader pass di color grading e post-processing
 *        cinematografico "Egyptian Noir".
 *
 * Effetti combinati:
 *   1. Vignette tombale: bordi oscurati per focalizzare la vista sulla torcia;
 *   2. Egyptian Color Grading: neri profondi, toni dorati sui mezzitoni,
 *      accenti blu lapislazzuli sulle ombre e caldo incenso sui bracieri;
 *   3. Micro-grain cinematografico organico per atmosfera da tomba antica.
 *
 * Ownership: rendering/postfx.
 */

import type { IUniform } from 'three';

export interface EgyptianNoirUniforms {
  tDiffuse: IUniform<null>;
  uTime: IUniform<number>;
  uVignette: IUniform<number>;
  uContrast: IUniform<number>;
  uWarmth: IUniform<number>;
  uGrainIntensity: IUniform<number>;
}

export const EgyptianNoirShader = {
  name: 'EgyptianNoirShader',

  uniforms: {
    tDiffuse: { value: null },
    uTime: { value: 0 },
    uVignette: { value: 0.45 },
    uContrast: { value: 1.12 },
    uWarmth: { value: 0.18 },
    uGrainIntensity: { value: 0.04 },
  } satisfies EgyptianNoirUniforms,

  vertexShader: /* glsl */ `
    varying vec2 vUv;
    void main() {
      vUv = uv;
      gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
    }
  `,

  fragmentShader: /* glsl */ `
    uniform sampler2D tDiffuse;
    uniform float uTime;
    uniform float uVignette;
    uniform float uContrast;
    uniform float uWarmth;
    uniform float uGrainIntensity;

    varying vec2 vUv;

    // Hash pseudo-random deterministico per il grain cinematografico
    float hash21(vec2 p) {
      p = fract(p * vec2(233.34, 851.73));
      p += dot(p, p + 23.45);
      return fract(p.x * p.y);
    }

    void main() {
      vec4 baseColor = texture2D(tDiffuse, vUv);
      vec3 color = baseColor.rgb;

      // 1. Contrasto Egyptian Noir (S-curve)
      color = (color - 0.5) * uContrast + 0.5;

      // 2. Color grading: calore dorato sui mezzitoni e luce, leggero blu freddo nelle ombre
      float luminance = dot(color, vec3(0.299, 0.587, 0.114));
      vec3 goldTint = vec3(1.08, 0.98, 0.82);   // oro antico
      vec3 shadowTint = vec3(0.85, 0.88, 1.02); // ciano lapislazzuli freddo

      vec3 graded = mix(color * shadowTint, color * goldTint, clamp(luminance * 1.4, 0.0, 1.0));
      color = mix(color, graded, uWarmth);

      // 3. Vignette ottica morbida
      vec2 centerCoord = vUv * 2.0 - 1.0;
      float dist = length(centerCoord * vec2(0.8, 0.9));
      float vig = smoothstep(0.4, 1.35, dist);
      color *= (1.0 - vig * uVignette);

      // 4. Micro grain cinematografico
      if (uGrainIntensity > 0.001) {
        float noise = hash21(vUv * 640.0 + vec2(uTime * 37.1, uTime * 19.7));
        color += (noise - 0.5) * uGrainIntensity;
      }

      gl_FragColor = vec4(clamp(color, 0.0, 1.0), baseColor.a);
    }
  `,
} as const;

export interface EgyptianNoirController {
  update(elapsedSeconds: number): void;
  setVignette(value: number): void;
  setWarmth(value: number): void;
  setContrast(value: number): void;
  setGrain(value: number): void;
}

export function createEgyptianNoirController(
  uniforms: EgyptianNoirUniforms,
): EgyptianNoirController {
  return {
    update(elapsedSeconds: number): void {
      uniforms.uTime.value = elapsedSeconds;
    },
    setVignette(value: number): void {
      uniforms.uVignette.value = Math.max(0, Math.min(1, value));
    },
    setWarmth(value: number): void {
      uniforms.uWarmth.value = Math.max(0, Math.min(1, value));
    },
    setContrast(value: number): void {
      uniforms.uContrast.value = Math.max(0.5, Math.min(2.0, value));
    },
    setGrain(value: number): void {
      uniforms.uGrainIntensity.value = Math.max(0, Math.min(0.2, value));
    },
  };
}
