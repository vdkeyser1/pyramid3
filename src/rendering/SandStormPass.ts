/**
 * W-7: SandStormPass — ShaderPass per effetto tempesta di sabbia.
 * Combina tre micro-effetti accumulati su schermo (WebGL2 only):
 *   1. Distorsione UV sinusoidale (heat shimmer / miraggio desertico)
 *   2. Overlay grain di sabbia (noise procedurale colorato)
 *   3. Vignette sabbiosa ai bordi dello schermo
 *
 * Intensità 0 = trasparente (nessun costo). Intensità 1 = tempesta piena.
 * Il chiamante aggiorna `uTime` ogni frame e `uIntensity` in base al contesto
 * (es. 0.12 di sfondo, 1.0 durante boss desertico).
 *
 * Compatible con Three.js ShaderPass (three/examples/jsm/postprocessing).
 */

import type { IUniform } from 'three';

export interface SandStormUniforms {
  tDiffuse: IUniform<null>;
  uTime: IUniform<number>;
  uIntensity: IUniform<number>;
}

/** Definizione shader passabile a `new ShaderPass(SandStormShader)`. */
export const SandStormShader = {
  name: 'SandStormShader',

  uniforms: {
    tDiffuse:   { value: null },
    uTime:      { value: 0 },
    uIntensity: { value: 0 },
  } satisfies SandStormUniforms,

  vertexShader: /* glsl */`
    varying vec2 vUv;
    void main() {
      vUv = uv;
      gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
    }
  `,

  fragmentShader: /* glsl */`
    uniform sampler2D tDiffuse;
    uniform float uTime;
    uniform float uIntensity;

    varying vec2 vUv;

    // LCG hash per grain pseudo-random deterministico per frame
    float hash(vec2 p) {
      p = fract(p * vec2(443.897, 441.423));
      p += dot(p, p + 19.19);
      return fract(p.x * p.y);
    }

    void main() {
      if (uIntensity < 0.001) {
        gl_FragColor = texture2D(tDiffuse, vUv);
        return;
      }

      // 1. Distorsione UV — heat shimmer (frequenza alta, ampiezza piccola)
      float shimmer = sin(vUv.y * 80.0 + uTime * 3.1)
                    * sin(vUv.x * 40.0 + uTime * 1.7) * 0.0015;
      vec2 distortedUv = vUv + vec2(shimmer, shimmer * 0.5) * uIntensity;
      vec4 sceneColor = texture2D(tDiffuse, clamp(distortedUv, 0.001, 0.999));

      // 2. Grain di sabbia (particelle micro, colore sabbia #C8A060)
      float grain = hash(vUv * 800.0 + vec2(uTime * 17.3, uTime * 9.1));
      grain = step(0.82, grain);  // solo i grani più chiari → punti sabbia sparsi
      vec3 sandColor = vec3(0.784, 0.627, 0.376);  // #C8A060 sabbia dorata
      vec3 withGrain = mix(sceneColor.rgb, sandColor, grain * 0.45 * uIntensity);

      // 3. Vignette sabbiosa — bordi dello schermo tendono al marrone-sabbia
      vec2 vigUv = vUv * 2.0 - 1.0;
      float vignette = 1.0 - dot(vigUv * 0.7, vigUv * 0.7);
      vignette = clamp(vignette, 0.0, 1.0);
      float vigStr = (1.0 - vignette) * 0.38 * uIntensity;
      vec3 vigColor = vec3(0.55, 0.38, 0.18);  // marrone desertico scuro
      vec3 finalColor = mix(withGrain, vigColor, vigStr);

      gl_FragColor = vec4(finalColor, sceneColor.a);
    }
  `,
} as const;

/**
 * Controller per aggiornare i parametri del SandStormPass a runtime.
 * Usato da ThreeRendererService per aggiornare time + intensity ogni frame.
 */
export interface SandStormController {
  /** Aggiorna il tempo elapsed per animare shimmer e grain. */
  update(elapsedSeconds: number): void;
  /** Imposta l'intensità: 0 = off, 1 = tempesta piena. */
  setIntensity(value: number): void;
  /** Intensità corrente. */
  readonly intensity: number;
}

export function createSandStormController(
  uniforms: SandStormUniforms,
): SandStormController {
  let _intensity = 0;

  return {
    update(elapsedSeconds: number): void {
      uniforms.uTime.value = elapsedSeconds;
    },
    setIntensity(value: number): void {
      _intensity = Math.max(0, Math.min(1, value));
      uniforms.uIntensity.value = _intensity;
    },
    get intensity(): number {
      return _intensity;
    },
  };
}
