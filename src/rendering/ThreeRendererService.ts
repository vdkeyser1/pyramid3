/**
 * Scopo: implementazione Three.js del servizio di rendering.
 * Ownership: RendererService.create() lo istanzia.
 *
 * Supporta WebGPU (preferito) e WebGL2 (fallback).
 */

import * as THREE from 'three';
import type { WebGPURenderer as ThreeWebGPURenderer } from 'three/webgpu';
import type {
  FloorLayoutTrapHooks,
  RendererBrazierState,
  RendererEnemyState,
  RendererHandle,
  RendererObjectiveState,
  RendererPlacedTorchState,
  RendererPresentationSettings,
  RenderBackend,
} from '@/rendering/RendererService.js';
import { resolveWorldAccessibilityPalette } from '@/config/AccessibilityPalette.js';
import {
  createAstronomicalCeilingTexture,
  createBronzeMaterial,
  createDissolveMaterial,
  createGoldMaterial,
  createTombWallTexture,
  createHieroglyphTexture,
  createHieroglyphPanelTexture,
  createSandTexture,
  loadPbrTextureSet,
} from '@/rendering/Materials.js';
import { createLogger } from '@/core/Logger.js';
import { TRAPS } from '@/content/balance.js';
import { resolveFeatureFlags } from '@/config/FeatureFlags.js';
import { createLodManager, type LodManager } from '@/rendering/LodManager.js';
import { ShadowMapOptimizer } from '@/rendering/ShadowMapOptimizer.js';
import type { AssetLoader } from '@/rendering/AssetLoader.js';
import type { ParticleBurst } from '@/rendering/Vfx.js';
import type { PhysicsKinematicBox, PhysicsWorld } from '@/physics/PhysicsWorld.js';
import type { FloorSceneLayout } from '@/world/FloorSceneLayout.js';
import { createFrustumCuller } from '@/rendering/FrustumCuller.js';
import type { FrustumCuller } from '@/rendering/FrustumCuller.js';
import { getReducedMotionAdapter } from '@/platform/ReducedMotionAdapter.js';

const log = createLogger('ThreeRenderer');

type BuildDungeonLayout = typeof import('@/rendering/ThreeDungeonLayout.js').buildDungeonLayout;

function isDoorRotated(yawRad: number): boolean {
  return Math.abs(Math.sin(yawRad)) > 0.5;
}

function loadRealTexture(
  path: string,
  repeatX: number,
  repeatY: number,
  fallback: () => THREE.Texture | null,
  renderer?: THREE.WebGLRenderer,
): THREE.Texture | null {
  try {
    // I .ktx2 vanno transcodificati da Basis: TextureLoader non li legge.
    // Senza renderer WebGL non è possibile, quindi si usa il fallback.
    if (path.endsWith('.ktx2')) {
      if (!renderer) return fallback();
      const placeholder = new THREE.Texture();
      placeholder.colorSpace = THREE.SRGBColorSpace;
      placeholder.wrapS = THREE.RepeatWrapping;
      placeholder.wrapT = THREE.RepeatWrapping;
      placeholder.repeat.set(repeatX, repeatY);
      placeholder.anisotropy = 4;
      void import('@/rendering/KTX2TextureLoader.js').then(({ loadKTX2TextureSync }) => {
        loadKTX2TextureSync(path, renderer, () => placeholder, { transcoderPath: '/basis/' });
      });
      return placeholder;
    }

    const texture = new THREE.TextureLoader().load(path);
    texture.colorSpace = THREE.SRGBColorSpace;
    texture.wrapS = THREE.RepeatWrapping;
    texture.wrapT = THREE.RepeatWrapping;
    texture.repeat.set(repeatX, repeatY);
    texture.anisotropy = 4;
    return texture;
  } catch {
    return fallback();
  }
}

export function createThreeRenderer(
  backend: RenderBackend,
  canvas: HTMLCanvasElement,
  physicsWorld?: PhysicsWorld,
): RendererHandle {
  let renderer: ThreeWebGPURenderer | THREE.WebGLRenderer;
  let scene: THREE.Scene;
  let dungeonRoot: THREE.Group;
  let frustumCuller: FrustumCuller;
  let camera: THREE.PerspectiveCamera;
  let torchLight: THREE.SpotLight;
  let torchAmbientLight: THREE.PointLight;
  let placedTorchLight: THREE.PointLight;
  let placedTorchMesh: THREE.Mesh;
  // G-15: fiamma procedurale della torcia (mano) e della torcia posata.
  let handFlame: { group: THREE.Group; update(deltaMs: number, intensity: number): void; setFlickerReduced(reduced: boolean): void } | null = null;
  /** Braccio che regge la torcia (con la fiamma agganciata in cima). */
  let torchViewmodel: import('@/rendering/TorchViewmodel.js').TorchViewmodel | null = null;
  let placedFlame: { group: THREE.Group; update(deltaMs: number, intensity: number): void; setFlickerReduced(reduced: boolean): void } | null = null;
  // V6: god ray della torcia accesa — cono additivo che segue la camera.
  let torchBeam: { mesh: THREE.Mesh; material: THREE.MeshBasicMaterial } | null = null;
  let sparkBurst: ParticleBurst | null = null;
  // G-15 V2: trail a falce per i colpi corpo-a-corpo.
  let weaponTrail: { mesh: THREE.Mesh; slash(position: { readonly x: number; readonly y: number; readonly z: number }, yaw: number): void; update(deltaMs: number): boolean } | null = null;
  /** Un viewmodel per tipo d'arma; solo quello attivo è visibile. */
  const weaponViewmodels = new Map<string, {
    readonly group: THREE.Group;
    setVisible(visible: boolean): void;
    playSwing(): void;
    playParry(): void;
    update(deltaMs: number): void;
  }>();
  let weaponViewmodel: {
    group: THREE.Group;
    setVisible(visible: boolean): void;
    playSwing(): void;
    playParry(): void;
    update(deltaMs: number): void;
  } | null = null;
  let envMapTexture: THREE.Texture | null = null;
  let ambientLight: THREE.AmbientLight;
  /** C-02: sessione XR attiva (solo WebGL2). */
  let xrActive = false;
  let onXrSessionEnd: (() => void) | null = null;
  let hemiLight: THREE.HemisphereLight;
  let floorMaterial: THREE.MeshStandardMaterial;
  let wallMaterial: THREE.MeshStandardMaterial;
  let doorMaterial: THREE.MeshStandardMaterial;
  let enemyMaterial: THREE.MeshStandardMaterial;
  let exitBeaconMaterial: THREE.MeshStandardMaterial;
  let placedTorchMaterial: THREE.MeshStandardMaterial;
  let digSiteMaterial: THREE.MeshStandardMaterial;
  let digSiteMarker: THREE.Group | null = null;
  /** Materiale del fascio verticale del sito di scavo (opacità = vicinanza). */
  let digSiteBeamMaterial: THREE.MeshBasicMaterial | null = null;
  /** Segno blu dipinto dentro l'anello del sito di scavo. */
  let digSiteGlyphMaterial: THREE.MeshBasicMaterial | null = null;
  let doorwayGlowMaterial: THREE.MeshBasicMaterial | null = null;
  /**
   * Colonne procedurali del piano corrente. Ognuna possiede geometrie e
   * materiali propri: vanno liberate al cambio piano, altrimenti si accumulano
   * sulla GPU a ogni discesa.
   */
  const columnDisposables: { dispose(): void }[] = [];
  let brazierRoot: THREE.Group;
  // G-16 + B-06: texture geroglifica condivisa per i landmark glyph + color
  // map papiro reale (create/load in init, fallback procedurale).
  let glyphTexture: THREE.Texture | null = null;
  let glyphColorMap: THREE.Texture | null = null;
  // G-17: loader asset 3D (creato in init, usato per i modelli .glb).
  let assetLoader: AssetLoader | null = null;
  // G-16: dissolve attivo per la morte dei nemici (0 = intatto, 1 = sparito).
  let enemyDissolve = 0;
  let dissolveSetter: ((value: number) => void) | null = null;
  const brazierLights = new Map<string, THREE.PointLight>();
  const brazierMaterials = new Map<string, THREE.MeshStandardMaterial>();
  const enemyVisuals: {
    mesh: THREE.Mesh;
    material: THREE.MeshStandardMaterial;
    /** B-03: fase di animazione idle (0-1, deterministica per indice). */
    phaseOffset: number;
    /** Modello GLB agganciato alla capsula, se già caricato. */
    model?: THREE.Group;
    /** Tipo attualmente montato, per non ricaricare a ogni frame. */
    kind?: string;
    /** Animator del modello, se il GLB ha clip utilizzabili. */
    animator?: import('@/rendering/EnemyAnimator.js').EnemyAnimator | null;
  }[] = [];
  /** GAME-ART: InstancedMesh per sciami SCARAB (≥3) — 1 draw call. */
  let scarabSwarmMesh: THREE.InstancedMesh | null = null;
  const scarabSwarmDummy = new THREE.Object3D();
  const SCARAB_SWARM_INSTANCE_CAP = 32;
  /** Cache dei GLB nemici: un solo fetch per tipo, poi si clona. */
  const enemyModelCache = new Map<string, THREE.Group>();
  /** yOffset per archetipo, letto da ENEMY_ASSETS al primo caricamento. */
  const enemyModelOffsets = new Map<string, number>();
  let exitBeacon: THREE.Mesh | null = null;
  let exitBeaconLight: THREE.PointLight | null = null;
  /** Materiale dei glifi sul pavimento — animato nel render loop (pulsazione emissiva). */
  let decorGlyphMaterial: THREE.MeshStandardMaterial | null = null;
  let disposed = false;
  let initialized = false;
  let activeFloorLayout: FloorSceneLayout | null = null;
  let pendingTrapHooks: FloorLayoutTrapHooks | null = null;
  /** GAME-ART-010: LOD props + shadow map condizionale (FeatureFlags). */
  const featureFlags = resolveFeatureFlags();
  const lodManager: LodManager | null = featureFlags.meshLod ? createLodManager() : null;
  let shadowMapOptimizer: ShadowMapOptimizer | null = null;
  let _doorOpen = false;
  let _doorMesh: THREE.Mesh | null = null;
  let _doorPhysics: PhysicsKinematicBox | null = null;
  let buildDungeonLayout: BuildDungeonLayout | null = null;
  const _doorClosedPos = { x: 0, y: 1.75, z: 5 };
  const _doorOpenPos = { x: 1.2, y: 1.75, z: 5 };
  let _doorYawRad = 0;
  let presentation: RendererPresentationSettings = {
    fovDeg: 90,
    highContrast: false,
    colorBlindMode: 'none',
    assistedLight: false,
    reduceTorchFlicker: false,
    amplifiedTelegraphs: false,
    reduceCameraShake: false,
    disableMotionBlur: false,
  };

  // G-15 V5: bloom selettivo (solo backend WebGL2 — WebGPU ha il suo pipeline).
  let composer: { render(): void; setSize(width: number, height: number): void; dispose(): void } | null = null;
  let bloomPass: { strength: number; radius: number; threshold: number } | null = null;
  // Bloom WebGPU: RenderPipeline + BloomNode TSL (r183+).
  let webgpuPipeline: { render(): void; dispose(): void } | null = null;
  // SSAO-1: ambient occlusion screen-space (solo WebGL2, per ambienti di pietra).
  let ssaoPass: { dispose(): void; setSize(width: number, height: number): void } | null = null;
  // W-7: sandstorm post-processing controller (heat shimmer + grain).
  let sandStormController: import('@/rendering/SandStormPass.js').SandStormController | null = null;
  // QC-1: post-fx (bloom+SSAO) attivo? Controllato da applyQualityProfile.
  // _qualityWantsPostFx e _motionReduced si combinano: entrambi devono essere
  // veri per attivare il composer (prefers-reduced-motion disabilita gli effetti).
  let _qualityWantsPostFx = true;
  let _motionReduced = false;
  let postFxEnabled = true;
  // G-05: reliquiario del tesoro dissotterrato (loot fisico raccoglibile).
  let lootReliquary: THREE.Group | null = null;
  // Pickup della pala — piccola croce dorata sul pavimento.
  let shovelPickupGroup: THREE.Group | null = null;
  // KayKit: torcia posata (GLB) — sostituisce il cilindro placeholder se caricato.
  let placedTorchGlb: THREE.Group | null = null;
  // Soffitto stellato: ricreato a ogni piano (seed = floorIndex), va rilasciato.
  let ceilingMaterial: THREE.MeshStandardMaterial | null = null;

  /**
   * Costruisce il materiale del soffitto delle camere: stelle dorate su fondo
   * nero, sul modello della camera funeraria di Unas (V dinastia).
   *
   * L'emissive è dorata e tenue: illumina solo le stelle (che nella texture
   * sono le uniche zone chiare) e non la stanza. Con la torcia spenta il
   * soffitto resta appena percettibile — il buio è una meccanica del gioco,
   * non un difetto da compensare qui.
   */
  function buildCeilingMaterial(floorIndex: number): THREE.MeshStandardMaterial {
    // map ed emissiveMap sono la stessa CanvasTexture: basta un dispose.
    ceilingMaterial?.map?.dispose();
    ceilingMaterial?.dispose();
    const starMap = createAstronomicalCeilingTexture(floorIndex);
    const material = new THREE.MeshStandardMaterial({
      color: 0xffffff,
      roughness: 0.95,
      metalness: 0.0,
    });
    if (starMap) {
      // Le camere sono grandi: ripetiamo il cielo per non stirare le stelle.
      starMap.repeat.set(2, 2);
      material.map = starMap;
      material.emissiveMap = starMap;
      // Oro caldo: le stelle brillano come pigmento illuminato, non come LED.
      material.emissive = new THREE.Color(0xC79A45);
      material.emissiveIntensity = 0.30;
    } else {
      // Canvas 2D non disponibile: soffitto in tinta unita, comunque chiuso.
      material.color.setHex(0x0d0a07);
    }
    ceilingMaterial = material;
    return material;
  }

  async function init(): Promise<void> {
    let webgpuReady = false;
    const dungeonLayoutModulePromise = import('@/rendering/ThreeDungeonLayout.js');

    // G-17: preload degli asset 3D dichiarati nel manifest, fire-and-forget.
    // Se un asset manca, l'AssetLoader fallisce a null e il renderer usa le
    // primitive placeholder — mai un blocco del bootstrap.
    void (async () => {
      const { createAssetLoader } = await import('@/rendering/AssetLoader.js');
      const { ENEMY_ASSETS, LANDMARK_ASSETS } = await import('@/content/assets.js');
      assetLoader = createAssetLoader();
      const paths = [
        ...ENEMY_ASSETS.map((entry) => entry.modelPath),
        ...LANDMARK_ASSETS.map((entry) => entry.modelPath),
      ].filter((path): path is string => path !== null);
      if (paths.length > 0) {
        await assetLoader.preload(paths);
        log.info('Asset preload completato', { assets: paths.length, caricate: paths.filter((p) => assetLoader?.has(p) ?? false).length });
      }

      // Carica torcia KayKit (CC0) — sostituisce il cilindro placeholder.
      const torchGltf = await assetLoader.load('assets/props/torch_lit.glb');
      if (torchGltf && !disposed) {
        const group = torchGltf.scene.clone(true);
        group.scale.setScalar(0.9);
        // KayKit usa asse Y verso l'alto, origine alla base — nessuna rotazione necessaria.
        group.traverse((child) => {
          if (child instanceof THREE.Mesh) {
            child.castShadow = true;
            child.receiveShadow = true;
          }
        });
        group.visible = false;
        scene.add(group);
        placedTorchGlb = group;
      }

      // W-1: HDRI Poly Haven CC0 — migliora l'IBL su tutti i MeshStandardMaterial.
      // Sostituisce l'env map procedurale se il file è disponibile.
      if (backend === 'webgl2' && !disposed) {
        const { loadHDRI } = await import('@/rendering/HDRILoader.js');
        const hdri = await loadHDRI(renderer as THREE.WebGLRenderer, '/hdri/sahara_2k.hdr');
        // `disposed` può cambiare durante l'await (dispose() concorrente): TS non
        // modella la mutazione attraverso il confine async e crede sia sempre false,
        // ma il controllo è una guardia reale contro l'uso dopo il rilascio.
        // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
        if (hdri && !disposed) {
          envMapTexture?.dispose();
          scene.environment = hdri.envMap;
          scene.environmentIntensity = 0.2;
          envMapTexture = hdri.envMap;
          log.info('HDRI Poly Haven caricato');
        }
      }
    })();

    if (backend === 'webgpu') {
      // Verifica preventiva: richiedi esplicitamente un GPU adapter prima di creare
      // il WebGPURenderer. Su Linux/Ubuntu senza driver Vulkan, navigator.gpu esiste
      // ma requestAdapter() ritorna null — in quel caso usiamo direttamente WebGL2.
      let gpuAdapterAvailable = false;
      try {
        const gpu = (navigator as { gpu?: { requestAdapter?: () => Promise<unknown> } }).gpu;
        if (gpu?.requestAdapter) {
          const adapter = await gpu.requestAdapter();
          gpuAdapterAvailable = adapter !== null;
        }
      } catch {
        gpuAdapterAvailable = false;
      }

      if (gpuAdapterAvailable) {
        try {
          const { WebGPURenderer } = await import('three/webgpu');
          renderer = new WebGPURenderer({
            canvas,
            antialias: true,
            alpha: false,
            powerPreference: 'high-performance',
          });
          webgpuReady = true;
        } catch {
          log.warn('WebGPU non disponibile, fallback WebGL2');
          backend = 'webgl2';
        }
      } else {
        log.warn('Nessun GPU adapter WebGPU disponibile (Linux/Ubuntu senza Vulkan) — uso WebGL2');
        backend = 'webgl2';
      }
    }

    if (backend === 'webgl2' || !webgpuReady) {
      renderer = new THREE.WebGLRenderer({
        canvas,
        antialias: true,
        alpha: false,
        powerPreference: 'high-performance',
      });
      renderer.shadowMap.enabled = true;
      renderer.shadowMap.type = THREE.PCFSoftShadowMap;
      renderer.toneMapping = THREE.ACESFilmicToneMapping;
      // Exposure neutra: ambient bassa + torcia moderata (Egyptian Noir).
      renderer.toneMappingExposure = 1.0;
      renderer.outputColorSpace = THREE.SRGBColorSpace;
    }

    if ('init' in renderer && typeof renderer.init === 'function') {
      await renderer.init();
    }

    renderer.setPixelRatio(window.devicePixelRatio);
    renderer.setSize(canvas.clientWidth, canvas.clientHeight);

    scene = new THREE.Scene();
    scene.background = new THREE.Color(0x0b0908);
    scene.fog = new THREE.FogExp2(0x0b0908, 0.0011);

    dungeonRoot = new THREE.Group();
    scene.add(dungeonRoot);
    frustumCuller = createFrustumCuller();

    // A-10: prefers-reduced-motion → disabilita bloom+SSAO per accessibilità.
    const motionAdapter = getReducedMotionAdapter();
    _motionReduced = motionAdapter.isReduced;
    motionAdapter.onChange((reduced) => {
      _motionReduced = reduced;
      postFxEnabled = _qualityWantsPostFx && !_motionReduced;
      if (bloomPass) {
        bloomPass.strength = _motionReduced ? 0 : (_qualityWantsPostFx ? 0.55 : 0);
      }
    });
    brazierRoot = new THREE.Group();
    scene.add(brazierRoot);

    camera = new THREE.PerspectiveCamera(
      90,
      canvas.clientWidth / Math.max(1, canvas.clientHeight),
      0.1,
      280,
    );
    camera.position.set(0, 1.7, 0);

    // HDRI/env map procedurale (WebGL2): riflessioni sui metalli (bronzo,
    // oro) senza asset esterni. Scena ambiente scura con luci calde/fredde
    // coerenti con la palette Egyptian Noir: i metalli riflettono accenti
    // ambrati e turchesi invece di uno studio neutro che laverebbe il buio.
    // WebGPU mantiene il rendering diretto (limitazione documentata).
    if (backend === 'webgl2') {
      try {
        const pmrem = new THREE.PMREMGenerator(renderer as THREE.WebGLRenderer);
        const envScene = new THREE.Scene();
        envScene.background = new THREE.Color(0x0b0908);
        const warm = new THREE.PointLight(0xffb45e, 8, 25);
        warm.position.set(2.5, 4, -3.5);
        envScene.add(warm);
        const teal = new THREE.PointLight(0x2e8b8b, 4, 25);
        teal.position.set(-3.5, 2, 2.5);
        envScene.add(teal);
        const gold = new THREE.DirectionalLight(0xd4a05a, 1.4);
        gold.position.set(0, 6, 0);
        envScene.add(gold);
        const envMap = pmrem.fromScene(envScene, 0.04).texture;
        scene.environment = envMap;
        // IBL debole: riempie i metalli senza lavare l'oscurità delle stanze.
        scene.environmentIntensity = 0.22;
        envMapTexture = envMap;
        pmrem.dispose();
        log.info('Env map procedurale attiva', { backend });
      } catch (err) {
        log.warn('Env map non disponibile', { error: String(err) });
      }
    }

    // G-15 V5: bloom selettivo su WebGL2 (EffectComposer da three/examples —
    // nessuna dipendenza nuova). WebGPU mantiene il proprio rendering diretto.
    if (backend === 'webgl2') {
      try {
        const { EffectComposer } = await import('three/examples/jsm/postprocessing/EffectComposer.js');
        const { RenderPass } = await import('three/examples/jsm/postprocessing/RenderPass.js');
        const { UnrealBloomPass } = await import('three/examples/jsm/postprocessing/UnrealBloomPass.js');
        const { SSAOPass } = await import('three/examples/jsm/postprocessing/SSAOPass.js');
        const composition = new EffectComposer(renderer as unknown as THREE.WebGLRenderer);
        composition.addPass(new RenderPass(scene, camera));
        // SSAO-1: ambient occlusion screen-space per ambienti di pietra
        // credibili (profondità percepita senza geometria extra). Solo WebGL2.
        const ssao = new SSAOPass(scene, camera, canvas.clientWidth, canvas.clientHeight);
        ssao.output = 1; // SSAOOutputPass? 1 = default SSAO blend
        composition.addPass(ssao);
        const bloom = new UnrealBloomPass(
          new THREE.Vector2(canvas.clientWidth, canvas.clientHeight),
          0.55,
          0.55,
          0.42,
        );
        composition.addPass(bloom);
        // W-7: SandStorm ShaderPass — heat shimmer + grain desertico (intensità default 0.12).
        const { ShaderPass } = await import('three/examples/jsm/postprocessing/ShaderPass.js');
        const { SandStormShader, createSandStormController } = await import('@/rendering/SandStormPass.js');
        const sandPass = new ShaderPass(SandStormShader);
        composition.addPass(sandPass);
        sandStormController = createSandStormController(
          sandPass.uniforms as unknown as import('@/rendering/SandStormPass.js').SandStormUniforms,
        );
        sandStormController.setIntensity(0.12);
        composer = {
          render: () => {
            sandStormController?.update(performance.now() * 0.001);
            composition.render();
          },
          setSize: (width, height) => {
            composition.setSize(width, height);
            ssao.setSize(width, height);
          },
          dispose: () => {
            composition.dispose();
            ssao.dispose();
          },
        };
        bloomPass = bloom;
        ssaoPass = ssao;
        log.info('Bloom + SSAO attivi (WebGL2)');
      } catch (error) {
        log.warn('Bloom/SSAO non disponibili, rendering diretto', { error: String(error) });
        composer = null;
        bloomPass = null;
        ssaoPass = null;
      }
    }

    // Bloom WebGPU: RenderPipeline (r183+) + BloomNode TSL — il pipeline
    // sostituisce il rendering diretto sul backend WebGPU. In caso di errore
    // si resta sul rendering diretto (comportamento preesistente).
    if (backend === 'webgpu' && webgpuReady) {
      try {
        const [{ RenderPipeline, WebGPURenderer: _WebGPURenderer }, tsl, { bloom }] = await Promise.all([
          import('three/webgpu'),
          import('three/tsl'),
          import('three/addons/tsl/display/BloomNode.js'),
        ]);
        const scenePass = tsl.pass(scene, camera);
        const scenePassColor = scenePass.getTextureNode('output');
        const bloomPassNode = bloom(scenePassColor, 0.55, 0.55, 0.42);
        // Il blocco è runtime-gated su backend webgpu: il cast è necessario
        // perché renderer è tipizzato come unione WebGL|WebGPU.
        const pipeline = new RenderPipeline(
          renderer as unknown as InstanceType<typeof _WebGPURenderer>,
        );
        pipeline.outputNode = scenePassColor.add(bloomPassNode);
        webgpuPipeline = pipeline;
        log.info('Bloom WebGPU attivo (RenderPipeline + BloomNode TSL)');
      } catch (error) {
        log.warn('Bloom WebGPU non disponibile, rendering diretto', { error: String(error) });
        webgpuPipeline = null;
      }
    }

    ambientLight = new THREE.AmbientLight(0xffddbb, 0.07);
    scene.add(ambientLight);

    hemiLight = new THREE.HemisphereLight(0x88ccff, 0x442200, 0.11);
    scene.add(hemiLight);

    // G-18: torcia Egyptian Noir — cono stretto, alone vicino (non lava la stanza).
    torchLight = new THREE.SpotLight(0xffb45e, 42, 28, Math.PI / 3.8, 0.72, 1.1);
    torchLight.visible = false;
    torchLight.position.copy(camera.position);
    torchLight.castShadow = true;
    torchLight.shadow.mapSize.set(1024, 1024);
    torchLight.shadow.camera.near = 0.3;
    torchLight.shadow.camera.far = 28;
    torchLight.shadow.bias = -0.0002;
    scene.add(torchLight);
    scene.add(torchLight.target);

    if (featureFlags.shadowMapOpt && 'shadowMap' in renderer) {
      const gl = renderer as THREE.WebGLRenderer;
      gl.shadowMap.autoUpdate = false;
      shadowMapOptimizer = new ShadowMapOptimizer();
      shadowMapOptimizer.addSpotLight(torchLight, 256);
    }

    torchAmbientLight = new THREE.PointLight(0xff9a3c, 0, 6.5, 2.0);
    torchAmbientLight.visible = false;
    scene.add(torchAmbientLight);

    placedTorchLight = new THREE.PointLight(0xd78e38, 9, 9, 2);
    placedTorchLight.visible = false;
    placedTorchLight.castShadow = true;
    placedTorchLight.shadow.mapSize.set(512, 512);
    placedTorchLight.shadow.bias = -0.00018;
    scene.add(placedTorchLight);

    // W-2: renderer WebGL2 passato a loadPbrTextureSet per upgrade KTX2 asincrono.
    const glRenderer = backend === 'webgl2' ? renderer as THREE.WebGLRenderer : undefined;

    floorMaterial = new THREE.MeshStandardMaterial({
      color: 0x3a2a1a,
      roughness: 0.92,
      metalness: 0.08,
    });
    // Pavimento: SABBIA come materiale base. Una piramide sepolta nel deserto
    // ha i pavimenti coperti di sabbia infiltrata da millenni — la pietra a
    // vista resta l'eccezione delle camere cerimoniali, non la regola.
    // (Prima la gerarchia era invertita: pietra ovunque, sabbia solo come
    // fallback se il file mancava, e il suolo non leggeva come desertico.)
    // repeat 8×8: grana più fitta della pietra, i granuli non devono stirarsi.
    const floorPbr = loadPbrTextureSet(
      'textures/sand_color.ktx2',
      'textures/sand_normalgl.ktx2',
      8, 8,
      'textures/sand_roughness.ktx2',
      'textures/sand_ambientocclusion.ktx2',
      glRenderer,
    );
    if (floorPbr.color) {
      floorMaterial.map = floorPbr.color;
      if (floorPbr.normal) {
        // Normal contenuta: a 0.85 la sabbia produceva chiazze irregolari
        // che leggevano come "forme" senza significato invece che come grana.
        // La compressione ETC1S accentua l'effetto sulle mappe non-colore.
        floorMaterial.normalMap = floorPbr.normal;
        floorMaterial.normalScale.set(0.35, 0.35);
      }
      if (floorPbr.roughness) floorMaterial.roughnessMap = floorPbr.roughness;
      if (floorPbr.ao) {
        // AO tenue: la sabbia è una superficie continua, non ha incavi
        // profondi da scurire. A 0.7 creava macchie scure a chiazze.
        floorMaterial.aoMap = floorPbr.ao;
        floorMaterial.aoMapIntensity = 0.25;
      }
      // Tinta calda: la sabbia illuminata dal fuoco tende all'ocra, non al grigio.
      floorMaterial.color.setHex(0xd9c49a);
      floorMaterial.roughness = 0.95;
      floorMaterial.metalness = 0.02;
    } else {
      // Fallback 1: lastre di pietra (il set sabbia non ha transcodificato).
      const stonePbr = loadPbrTextureSet(
        'textures/stone_floor_color.ktx2', 'textures/stone_floor_normal.ktx2', 5, 5,
        'textures/stone_floor_roughness.ktx2', 'textures/stone_floor_ao.ktx2',
        glRenderer,
      );
      if (stonePbr.color) {
        floorMaterial.map = stonePbr.color;
        if (stonePbr.normal) { floorMaterial.normalMap = stonePbr.normal; floorMaterial.normalScale.set(0.5, 0.5); }
        if (stonePbr.roughness) floorMaterial.roughnessMap = stonePbr.roughness;
        if (stonePbr.ao) { floorMaterial.aoMap = stonePbr.ao; floorMaterial.aoMapIntensity = 0.65; }
        floorMaterial.color.setHex(0xffffff);
      } else {
        // Fallback 2: sabbia procedurale su canvas, senza alcun file.
        const sandTexture = createSandTexture(256, '#8a7350');
        if (sandTexture) { floorMaterial.map = sandTexture; floorMaterial.color.setHex(0xb09a70); }
      }
    }
    // Texture geroglifica per i landmark glyph (sprite sheet CC0).
    glyphTexture = loadRealTexture('textures/hieroglyphs_a_m.ktx2', 2, 2, () =>
      createHieroglyphTexture(0, 256, '#6ee0d1'),
      glRenderer,
    );
    glyphColorMap = loadRealTexture('textures/papyrus.ktx2', 1, 1, () => null, glRenderer);
    wallMaterial = new THREE.MeshStandardMaterial({
      color: 0xffffff,
      roughness: 0.90,
      metalness: 0.04,
    });
    // Muri: arenaria egizia (Poly Haven sandstone_brick_wall_01 CC0).
    //
    // repeat 1.6×1.1 invece di 4×3. La texture è a corsi di blocchi: ripetuta
    // 4×3 su una parete alta 4,5 m ogni blocco risultava ~25 cm, la misura di
    // un mattone moderno — e la parete leggeva come muratura di mattoni.
    // A 1.6×1.1 ogni blocco è ~65 cm, la scala dei conci di calcare con cui
    // sono costruite le piramidi.
    const wallPbr = loadPbrTextureSet(
      'textures/sandstone_wall_color.ktx2',
      'textures/sandstone_wall_normal.ktx2',
      1.6, 1.1,
      'textures/sandstone_wall_roughness.ktx2',
      'textures/sandstone_wall_ao.ktx2',
      glRenderer,
    );
    // Parete a registri generata: calcare chiaro con bordo colorato, righe di
    // geroglifici incisi e zoccolo. È la struttura che accomuna tutte le
    // camere funerarie reali, e che la texture di mattoni non aveva.
    // Ha la precedenza sul PBR da file; il PBR resta come fallback.
    const tombWall = createTombWallTexture(0);
    if (tombWall) {
      // repeat solo orizzontale: i registri devono restare uno per parete,
      // non ripetersi in verticale (wrapT è ClampToEdge nella texture).
      tombWall.repeat.set(3, 1);
      wallMaterial.map = tombWall;
      wallMaterial.color.setHex(0xffffff);
      wallMaterial.roughness = 0.94;
      wallMaterial.metalness = 0.0;
    } else if (wallPbr.color) {
      wallMaterial.map = wallPbr.color;
      if (wallPbr.normal) {
        wallMaterial.normalMap = wallPbr.normal;
        // Con blocchi grandi il rilievo va contenuto: a 0.85 le fughe
        // sembravano scavate col cemento invece che tagliate nella pietra.
        wallMaterial.normalScale.set(0.45, 0.45);
      }
      if (wallPbr.roughness) wallMaterial.roughnessMap = wallPbr.roughness;
      if (wallPbr.ao) {
        wallMaterial.aoMap = wallPbr.ao;
        wallMaterial.aoMapIntensity = 0.45;
      }
      // Calcare di Tura: i corridoi delle piramidi sono in pietra chiara e
      // calda, non nell'arenaria rossastra dei templi all'aperto.
      wallMaterial.color.setHex(0xC9B48C);
    } else {
      // fallback: vecchia texture generica
      const fallbackPbr = loadPbrTextureSet(
        'textures/stone_color.ktx2', 'textures/stone_normalgl.ktx2', 4, 3,
        'textures/stone_roughness.ktx2', 'textures/stone_ambientocclusion.ktx2',
        glRenderer,
      );
      if (fallbackPbr.color) {
        wallMaterial.map = fallbackPbr.color;
        if (fallbackPbr.normal) { wallMaterial.normalMap = fallbackPbr.normal; wallMaterial.normalScale.set(0.7, 0.7); }
        if (fallbackPbr.roughness) wallMaterial.roughnessMap = fallbackPbr.roughness;
        if (fallbackPbr.ao) { wallMaterial.aoMap = fallbackPbr.ao; wallMaterial.aoMapIntensity = 0.75; }
      }
    }
    doorMaterial = new THREE.MeshStandardMaterial({
      color: 0x6a4a2a,
      roughness: 0.8,
      metalness: 0.2,
    });
    // G-16: materiale nemico con dissolve per la morte (0 intatto → 1 sparito).
    const dissolve = createDissolveMaterial(0x8d8a73, 0xd4a05a);
    enemyMaterial = dissolve.material;
    enemyMaterial.emissive = new THREE.Color(0x000000);
    dissolveSetter = dissolve.setDissolve;
    exitBeaconMaterial = new THREE.MeshStandardMaterial({
      color: 0xd4900a,
      emissive: 0xcc6600,
      emissiveIntensity: 1.8,
      roughness: 0.3,
      metalness: 0.45,
    });
    placedTorchMaterial = new THREE.MeshStandardMaterial({
      color: 0x6a4824,
      emissive: 0x2b1202,
      emissiveIntensity: 0.55,
      roughness: 0.74,
      metalness: 0.12,
    });
    digSiteMaterial = new THREE.MeshStandardMaterial({
      color: 0x9a7030,
      emissive: 0x7a4a10,
      emissiveIntensity: 1.2,
      roughness: 0.9,
      metalness: 0.08,
    });

    _doorMesh = new THREE.Mesh(new THREE.BoxGeometry(2.0, 3.5, 0.2), doorMaterial);
    _doorMesh.position.set(_doorClosedPos.x, _doorClosedPos.y, _doorClosedPos.z);
    _doorMesh.castShadow = true;
    _doorMesh.receiveShadow = true;
    scene.add(_doorMesh);

    exitBeacon = new THREE.Mesh(new THREE.OctahedronGeometry(0.28, 0), exitBeaconMaterial);
    exitBeacon.position.set(_doorClosedPos.x, _doorClosedPos.y + 1.0, _doorClosedPos.z);
    exitBeacon.visible = true;
    scene.add(exitBeacon);
    exitBeaconLight = new THREE.PointLight(0xffaa22, 14, 7, 2);
    exitBeaconLight.position.set(_doorClosedPos.x, _doorClosedPos.y + 1.0, _doorClosedPos.z);
    scene.add(exitBeaconLight);

    placedTorchMesh = new THREE.Mesh(
      new THREE.CylinderGeometry(0.05, 0.09, 0.85, 8),
      placedTorchMaterial,
    );
    placedTorchMesh.visible = false;
    placedTorchMesh.castShadow = true;
    placedTorchMesh.receiveShadow = true;
    scene.add(placedTorchMesh);

    // G-15: fiamme procedurali — la fiamma in mano segue la camera (viewmodel),
    // quella posata segue il mesh della torcia posata.
    const { createTorchFlame, createParticleBurst, createWeaponTrail } = await import('@/rendering/Vfx.js');
    const hand = createTorchFlame();
    hand.group.visible = false;
    handFlame = hand;

    // Braccio con la torcia: prima la fiamma fluttuava davanti alla camera
    // senza nulla che la reggesse. Ora è agganciata in cima al bastone, così
    // segue il braccio anche quando si china sul braciere per accendere.
    try {
      const { createTorchViewmodel } = await import('@/rendering/TorchViewmodel.js');
      const torchVm = createTorchViewmodel();
      camera.add(torchVm.group);
      torchVm.flameAnchor.add(hand.group);
      torchViewmodel = torchVm;
    } catch (err) {
      log.warn('Viewmodel torcia non disponibile', { error: String(err) });
      // Senza braccio la fiamma resta comunque visibile, come prima.
      camera.add(hand.group);
      hand.group.position.set(0.42, -0.34, -0.55);
    }
    const placed = createTorchFlame();
    placed.group.visible = false;
    scene.add(placed.group);
    placedFlame = placed;
    sparkBurst = createParticleBurst();
    scene.add(sparkBurst.points);
    // W-6: texture Kenney CC0 per le scintille — caricamento asincrono, fallback al disco.
    // Catturiamo il riferimento locale: la callback può arrivare dopo un dispose()
    // che ha già azzerato `sparkBurst`, e il materiale locale resta comunque valido.
    const burstForTexture = sparkBurst;
    new THREE.TextureLoader().load('/textures/particles/spark.png', (tex) => {
      const mat = burstForTexture.points.material as THREE.PointsMaterial;
      mat.map = tex;
      mat.needsUpdate = true;
    });
    const trail = createWeaponTrail();
    scene.add(trail.mesh);
    weaponTrail = trail;

    // Viewmodel arma 3D: khopesh procedurale agganciato alla camera.
    // Import dinamico (stesso pattern di Vfx) per non gonfiare il chunk
    // principale; in caso di errore il gioco continua senza viewmodel.
    try {
      const vm = await import('@/rendering/WeaponViewmodel.js');
      // Un viewmodel per arma: prima esisteva solo il khopesh, e cambiando
      // slot non si vedeva nulla in mano.
      weaponViewmodels.set('fists', vm.createFistsViewmodel());
      weaponViewmodels.set('khopesh', vm.createKhopeshViewmodel());
      weaponViewmodels.set('staff', vm.createStaffViewmodel());
      weaponViewmodels.set('shovel', vm.createShovelViewmodel());
      for (const model of weaponViewmodels.values()) {
        model.setVisible(false);
        camera.add(model.group);
      }
      // Il khopesh è l'arma iniziale.
      const initial = weaponViewmodels.get('khopesh');
      if (initial) {
        initial.setVisible(true);
        weaponViewmodel = initial;
      }
    } catch (err) {
      log.warn('Viewmodel arma non disponibile', { error: String(err) });
    }

    // V6: god ray della torcia — cono additivo trasparente attaccato alla
    // camera (il raggio segue lo sguardo). Visibile solo a torcia accesa.
    const torchBeamMaterial = new THREE.MeshBasicMaterial({
      color: 0xffb45e,
      transparent: true,
      opacity: 0.08,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      side: THREE.DoubleSide,
    });
    const torchBeamMesh = new THREE.Mesh(
      new THREE.ConeGeometry(1.05, 7.5, 14, 1, true),
      torchBeamMaterial,
    );
    torchBeamMesh.position.set(0, -0.1, -3.75);
    torchBeamMesh.rotation.x = Math.PI / 2; // ruota il cono da asse Y → asse -Z (forward)
    torchBeamMesh.visible = false;
    camera.add(torchBeamMesh);
    torchBeam = { mesh: torchBeamMesh, material: torchBeamMaterial };

    initialized = true;
    ({ buildDungeonLayout } = await dungeonLayoutModulePromise);
    if (activeFloorLayout) {
      void rebuildFloorLayout(activeFloorLayout);
    }
    applyPresentation(presentation);

    log.info(`Three.js renderer inizializzato: ${backend}`, {
      renderer: renderer.constructor.name.replace('Renderer', ''),
    });
  }

  function setFloorLayout(
    layout: FloorSceneLayout | null,
    trapHooks?: FloorLayoutTrapHooks,
  ): void {
    activeFloorLayout = layout;
    pendingTrapHooks = trapHooks ?? null;
    if (!initialized || !layout) {
      return;
    }
    void rebuildFloorLayout(layout);
  }

  /**
   * G-10: palette del piano corrente — muri/pavimento più scuri con la
   * profondità, accento (emissive dei landmark) che cambia per fascia.
   * Il fog ambientale si intensifica (darknessFactor) senza toccare la torcia.
   */
  function applyFloorPalette(palette: {
    readonly wallHex: number;
    readonly floorHex: number;
    readonly accentHex: number;
    readonly darknessFactor: number;
  }): void {
    if (!initialized) return;
    wallMaterial.color.setHex(palette.wallHex);
    if (!floorMaterial.map) {
      floorMaterial.color.setHex(palette.floorHex);
    }
    // Accento: emissive dei landmark critici (usato da buildDungeonLayout)
    const darkness = Math.max(0, Math.min(1, palette.darknessFactor));
    scene.fog = new THREE.FogExp2(0x0b0908, 0.0012 + darkness * 0.002);
    scene.background = new THREE.Color(0x0b0908);
    log.info('Palette piano applicata', { wallHex: palette.wallHex, darknessFactor: darkness });
  }

  /**
   * QC-1: applica il profilo di qualità — shadow map size della torcia,
   * bloom on/off (WebGL2) e pixel ratio (resolution scale). Chiamato dal
   * QualityController quando il tier cambia (adattamento runtime).
   */
  function applyQualityProfile(profile: {
    readonly tier: 'low' | 'medium' | 'high';
    readonly resolutionScale: number;
    readonly shadowMapSize: number;
    readonly usePostFx: boolean;
  }): void {
    if (!initialized) return;

    // Shadow map: dimensione scalata per tier
    const shadowSize = Math.max(256, profile.shadowMapSize);
    torchLight.shadow.mapSize.set(shadowSize, shadowSize);
    torchLight.shadow.camera.far = profile.tier === 'low' ? 20 : 28;
    placedTorchLight.shadow.mapSize.set(Math.min(512, shadowSize), Math.min(512, shadowSize));

    // Bloom (solo WebGL2): off su low, ridotto su medium, pieno su high.
    // Threshold più alto su medium → meno bloom su superfici litte (torch).
    if (bloomPass) {
      const strength = profile.usePostFx
        ? (profile.tier === 'medium' ? 0.32 : profile.tier === 'high' ? 0.55 : 0)
        : 0;
      bloomPass.strength = strength;
      bloomPass.threshold = profile.tier === 'medium' ? 0.55 : 0.42;
      bloomPass.radius = profile.tier === 'medium' ? 0.4 : 0.55;
      if (composer) {
        composer.setSize(canvas.clientWidth, canvas.clientHeight);
      }
    }

    // SSAO/bloom (solo WebGL2): il profilo low salta il composer in render()
    // (SSAOPass non ha un toggle runtime semplice e ri-crearlo è costoso).
    _qualityWantsPostFx = profile.usePostFx && profile.tier !== 'low';
    postFxEnabled = _qualityWantsPostFx && !_motionReduced;
    if (ssaoPass && composer) {
      // Mantieni i target dell'SSAO allineati al canvas corrente
      composer.setSize(canvas.clientWidth, canvas.clientHeight);
    }

    // Pixel ratio: resolution scale per tier
    const baseRatio = window.devicePixelRatio || 1;
    renderer.setPixelRatio(Math.max(0.5, baseRatio * profile.resolutionScale));

    log.info('Quality profile applicato', {
      tier: profile.tier,
      shadowMapSize: shadowSize,
      usePostFx: profile.usePostFx,
      pixelRatio: baseRatio * profile.resolutionScale,
    });
  }

  /**
   * G-05: reliquiario del tesoro — oggetto fisico dorato che appare quando lo
   * scavo completa; il player lo raccoglie con E. Geometria semplice condivisa.
   */
  function setLootReliquary(position: { readonly x: number; readonly y: number; readonly z: number } | null): void {
    if (lootReliquary) {
      brazierRoot.remove(lootReliquary);
      lootReliquary = null;
    }
    if (!position || !initialized) return;

    const group = new THREE.Group();
    // Cofanetto: base cubica + coperchio piramidale, oro con emissive
    // Oro dalla libreria materiali. L'emissive va alzato rispetto al default:
    // il reliquiario deve attirare l'occhio nel buio, non solo riflettere.
    const goldMaterial = createGoldMaterial();
    goldMaterial.emissive.setHex(0x4a2f00);
    goldMaterial.emissiveIntensity = 0.6;
    const base = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.28, 0.5), goldMaterial);
    base.position.y = 0.14;
    base.castShadow = true;
    base.receiveShadow = true;
    const lid = new THREE.Mesh(new THREE.ConeGeometry(0.42, 0.22, 4), goldMaterial);
    lid.position.y = 0.39;
    lid.rotation.y = Math.PI / 4;
    lid.castShadow = true;
    group.add(base, lid);

    // V6: god ray del tesoro — cono volumetrico additivo (raggio di luce
    // ascendente) + bagliore pulsante. Fake volumetric: funziona su WebGL2
    // e WebGPU senza ray-marching TSL.
    const beamMaterial = new THREE.MeshBasicMaterial({
      color: 0xffd48a,
      transparent: true,
      opacity: 0.16,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      side: THREE.DoubleSide,
    });
    const beam = new THREE.Mesh(new THREE.ConeGeometry(0.55, 2.6, 12, 1, true), beamMaterial);
    beam.position.y = 1.5;
    beam.renderOrder = 2;
    group.add(beam);
    // Bagliore alla base del raggio
    const glowMaterial = new THREE.MeshBasicMaterial({
      color: 0xffd48a,
      transparent: true,
      opacity: 0.35,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    });
    const glow = new THREE.Mesh(new THREE.SphereGeometry(0.34, 12, 8), glowMaterial);
    glow.position.y = 0.3;
    group.add(glow);

    group.position.set(position.x, position.y + 0.02, position.z);
    brazierRoot.add(group);
    lootReliquary = group;
    log.info('Reliquiario del tesoro appare', { x: position.x, z: position.z });
  }

  function setShovelPickup(
    position: { readonly x: number; readonly z: number } | null,
  ): void {
    if (shovelPickupGroup) {
      brazierRoot.remove(shovelPickupGroup);
      shovelPickupGroup = null;
    }
    if (!position || !initialized) return;

    // Pala a terra: prima era due box tozze in oro emissivo, che a terra
    // leggevano come un oggetto dorato astratto anziché come un attrezzo.
    // Ora ha proporzioni da utensile vero — manico lungo e sottile, lama
    // larga e piatta — e materiali coerenti: legno per l'asta, bronzo per
    // la lama. Il bronzo è quello di Materials.createBronzeMaterial().
    const group = new THREE.Group();

    const woodMat = new THREE.MeshStandardMaterial({
      color: 0x6B4A2A,
      roughness: 0.85,
      metalness: 0.0,
    });
    // Bronzo dalla libreria materiali invece che riscritto a mano: era una
    // terza copia degli stessi valori (pala a terra, viewmodel, Materials).
    const bronzeMat = createBronzeMaterial();

    // Asta: 1,05 m, sottile — la lunghezza è ciò che rende leggibile l'attrezzo.
    const shaft = new THREE.Mesh(
      new THREE.CylinderGeometry(0.028, 0.032, 1.05, 8),
      woodMat,
    );
    shaft.rotation.x = Math.PI / 2;
    shaft.position.set(0, 0.05, -0.1);
    shaft.castShadow = true;

    // Impugnatura a T in cima all'asta.
    const grip = new THREE.Mesh(new THREE.CylinderGeometry(0.022, 0.022, 0.22, 6), woodMat);
    grip.rotation.z = Math.PI / 2;
    grip.position.set(0, 0.05, -0.62);

    // Ghiera che unisce asta e lama: il dettaglio che dice "costruito".
    const collar = new THREE.Mesh(new THREE.CylinderGeometry(0.045, 0.045, 0.09, 8), bronzeMat);
    collar.rotation.x = Math.PI / 2;
    collar.position.set(0, 0.05, 0.4);

    // Lama larga e piatta, leggermente inclinata come appoggiata al suolo.
    const blade = new THREE.Mesh(new THREE.BoxGeometry(0.30, 0.022, 0.34), bronzeMat);
    blade.position.set(0, 0.035, 0.60);
    blade.rotation.x = -0.12;
    blade.castShadow = true;

    group.add(shaft, grip, collar, blade);

    // Bagliore a terra: tenue, serve solo a farla notare nel buio senza
    // trasformarla in un oggetto magico luminoso.
    const glowMat = new THREE.MeshBasicMaterial({
      color: 0xE8B451,
      transparent: true,
      opacity: 0.18,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    });
    const glow = new THREE.Mesh(new THREE.CircleGeometry(0.55, 16), glowMat);
    glow.rotation.x = -Math.PI / 2;
    glow.position.y = 0.01;
    group.add(glow);

    group.position.set(position.x, 0, position.z);
    brazierRoot.add(group);
    shovelPickupGroup = group;
  }

  // W-5 / task-9: posiziona props 3D CC0 nelle stanze.
  // Stanze ≥ 8×8: colonne/pilastri KayKit agli angoli.
  // Stanze più piccole: colonne Kenney Dungeon.
  /**
   * Dispone le colonne nelle camere secondo lo schema della sala ipostila
   * egizia: due file parallele che fiancheggiano l'asse centrale, lasciando
   * libero il passaggio in mezzo (Karnak, Luxor).
   *
   * Sostituisce il piazzamento precedente ai 4 angoli di ogni stanza, che era
   * meccanico e usava i prop del pack KayKit Dungeon — colonne con armi e
   * scudi, fantasy medievale fuori tema per una piramide egizia.
   *
   * Usa solo `ruins_column` (Kenney CC0), che è geometricamente neutra.
   */
  async function placeRoomColumns(layout: FloorSceneLayout, root: THREE.Group): Promise<void> {
    // Colonne generate proceduralmente invece dell'asset `ruins_column`:
    // quello era un cilindro bianco liscio con capitello classicheggiante,
    // che in scena leggeva come colonna greco-romana. Queste hanno fusto
    // scanalato, capitello papiriforme/lotiforme/palmiforme e bande dipinte.
    const { createEgyptianColumn } = await import('@/rendering/EgyptianColumn.js');
    if (disposed) return;

    /** Larghezza libera al centro: il giocatore deve poterci passare. */
    const AISLE_HALF_WIDTH_M = 2.2;
    /** Distanza minima dalle pareti, per non compenetrare i bracieri. */
    const WALL_MARGIN_M = 2.8;
    /** Sotto questa dimensione la camera non regge una colonnata. */
    const MIN_ROOM_M = 9;

    const { presetFor } = await import('@/content/RoomThemes.js');

    for (const room of layout.rooms) {
      const { minX, maxX, minZ, maxZ } = room.bounds;
      const w = maxX - minX;
      const d = maxZ - minZ;
      if (w < MIN_ROOM_M || d < MIN_ROOM_M) continue;

      // ART-004: le stanze crollate e insabbiate non hanno colonnate — sono
      // proprio l'assenza di ordine architettonico a caratterizzarle.
      if (!presetFor(room.theme).columns) continue;

      const cx = (minX + maxX) / 2;
      const cz = (minZ + maxZ) / 2;

      // La colonnata corre lungo il lato lungo della stanza.
      const alongZ = d >= w;
      const halfSpan = (alongZ ? d : w) / 2 - WALL_MARGIN_M;
      if (halfSpan <= 0) continue;

      // Camere più profonde reggono tre coppie invece di due: la densità
      // cresce con la stanza, non è un numero fisso.
      const pairs = halfSpan >= 5.5 ? 3 : 2;

      for (let side = -1; side <= 1; side += 2) {
        for (let i = 0; i < pairs; i++) {
          // Coppie distribuite simmetricamente attorno al centro:
          // t va da -1 (parete vicina) a +1 (parete opposta).
          const t = (i / (pairs - 1)) * 2 - 1;
          const offset = t * halfSpan;

          const x = alongZ ? cx + side * AISLE_HALF_WIDTH_M : cx + offset;
          const z = alongZ ? cz + offset : cz + side * AISLE_HALF_WIDTH_M;

          // Il tipo di capitello deriva dalla stanza, non dalla posizione:
          // una sala ha colonne coerenti fra loro, come nelle sale ipostile.
          const roomSeed = Number(room.roomId) || 0;
          const column = createEgyptianColumn(roomSeed);
          columnDisposables.push(column);
          column.group.position.set(x, 0, z);
          // Collider: senza questo il giocatore attraversava le colonne.
          // Box leggermente più stretto del fusto (0.34 di raggio) per non
          // creare un ostacolo invisibile più largo di quello che si vede.
          createStaticBox(x, 1.95, z, 0.40, 1.95, 0.40);
          // Rotazione alternata: file allineate al millimetro leggono come
          // copia-incolla invece che come pietra scolpita a mano.
          column.group.rotation.y = ((i + (side > 0 ? 1 : 0)) % 4) * (Math.PI / 4);
          root.add(column.group);
        }
      }
    }
  }

  /**
   * A1: porta GLB CC0 (`ruins_gate`) sulle soglie — silhouette di arco
   * funerario. Se il file manca, nessun crash (solo glow a pavimento).
   */
  async function placeDoorwayGates(
    layout: FloorSceneLayout,
    root: THREE.Group,
  ): Promise<void> {
    if (layout.doorways.length === 0) return;
    const { loadArtifact } = await import('@/rendering/ArtifactLoader.js');
    const { getArtifactById } = await import('@/content/ArtifactRegistry.js');
    if (disposed) return;

    const def = getArtifactById('ruins_gate');
    if (!def) return;

    const prototype = await loadArtifact(def);
    if (!prototype) return;
    // Re-check dopo await: `disposed` può cambiare durante il load GLB.
    // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition -- mutazione async
    if (disposed) return;

    for (const doorway of layout.doorways) {
      const gate = prototype.clone(true);
      gate.traverse((child) => {
        if (child instanceof THREE.Mesh) {
          child.castShadow = true;
          child.receiveShadow = true;
        }
      });
      // Asse 'x' = passaggio lungo X → arco perpendicolare (ruota 90°).
      const yaw = doorway.axis === 'x' ? Math.PI / 2 : 0;
      gate.position.set(doorway.center.x, 0, doorway.center.z);
      gate.rotation.y = yaw;
      root.add(gate);
    }
  }

  async function rebuildFloorLayout(layout: FloorSceneLayout): Promise<void> {
    // Swap texture muri: arenaria chiara nei livelli bassi, scura in cripta.
    const useDeepWall = layout.floorIndex >= 5;
    const wPbr = loadPbrTextureSet(
      useDeepWall ? 'textures/sandstone_dark_color.ktx2' : 'textures/sandstone_wall_color.ktx2',
      useDeepWall ? 'textures/sandstone_dark_normal.ktx2' : 'textures/sandstone_wall_normal.ktx2',
      // Stessa scala dei conci usata in init: blocchi da ~65 cm, non mattoni.
      1.6, 1.1,
      useDeepWall ? 'textures/sandstone_dark_roughness.ktx2' : 'textures/sandstone_wall_roughness.ktx2',
      useDeepWall ? 'textures/sandstone_dark_ao.ktx2' : 'textures/sandstone_wall_ao.ktx2',
      backend === 'webgl2' ? renderer as THREE.WebGLRenderer : undefined,
    );
    if (wPbr.color) {
      wallMaterial.map = wPbr.color;
      wallMaterial.normalMap = wPbr.normal ?? null;
      if (wPbr.normal) wallMaterial.normalScale.set(0.45, 0.45);
      wallMaterial.roughnessMap = wPbr.roughness ?? null;
      wallMaterial.aoMap = wPbr.ao ?? null;
      if (wPbr.ao) wallMaterial.aoMapIntensity = 0.45;
      // Scendendo la pietra si scurisce: calcare chiaro in alto, granito
      // rossastro nelle camere profonde (come nella camera del re di Cheope).
      wallMaterial.color.setHex(useDeepWall ? 0xA8896A : 0xC9B48C);
      wallMaterial.needsUpdate = true;
    }

    dungeonRoot.clear();
    lodManager?.clear();
    shadowMapOptimizer?.forceUpdate();
    brazierRoot.clear();
    brazierLights.clear();
    brazierMaterials.clear();
    digSiteMarker = null;
    // Il fascio del sito di scavo è ricreato a ogni piano: senza dispose il
    // materiale del piano precedente resterebbe allocato sulla GPU.
    digSiteBeamMaterial?.dispose();
    digSiteBeamMaterial = null;
    digSiteGlyphMaterial?.dispose();
    digSiteGlyphMaterial = null;
    doorwayGlowMaterial?.dispose();
    doorwayGlowMaterial = null;
    // Stesso discorso per le colonne procedurali del piano precedente.
    for (const column of columnDisposables) column.dispose();
    columnDisposables.length = 0;
    // La scala appartiene al piano: va rilasciata insieme a lui.
    staircase?.dispose();
    staircase = null;
    decorGlyphMaterial = null;
    if (lootReliquary) {
      brazierRoot.remove(lootReliquary);
      lootReliquary = null;
    }
    if (shovelPickupGroup) {
      brazierRoot.remove(shovelPickupGroup);
      shovelPickupGroup = null;
    }

    _doorPhysics?.dispose();
    _doorPhysics = null;

    frustumCuller.clearRooms();
    const trapHooks = pendingTrapHooks;
    const roomBounds = buildDungeonLayout?.({
      layout,
      dungeonRoot,
      floorMaterial,
      wallMaterial,
      createStaticBox,
      glyphEmissiveMap: glyphTexture,
      glyphColorMap,
      ceilingMaterial: buildCeilingMaterial(layout.floorIndex),
      onPressurePlateMeshReady: (trapId, spikesGroup) => {
        trapHooks?.onPressurePlateReady?.(trapId, (spikesGroupY) => {
          spikesGroup.position.y = spikesGroupY;
        });
      },
      onPendulumMeshReady: (trapId, pivotGroup, corridorAxis) => {
        trapHooks?.onPendulumReady?.(trapId, (angleRad) => {
          if (corridorAxis === 'x') {
            pivotGroup.rotation.z = angleRad;
          } else {
            pivotGroup.rotation.x = angleRad;
          }
        });
      },
      onDartLauncherMeshReady: (trapId, dartMesh, fireAxis) => {
        const originX = dartMesh.position.x;
        const originZ = dartMesh.position.z;
        trapHooks?.onDartReady?.(trapId, (travel01, visible) => {
          dartMesh.visible = visible;
          const along = travel01 * TRAPS.dartLauncher.rangeM;
          if (fireAxis === 'x') {
            dartMesh.position.x = originX + along;
            dartMesh.position.z = originZ;
          } else {
            dartMesh.position.x = originX;
            dartMesh.position.z = originZ + along;
          }
        });
      },
      onRollingBoulderMeshReady: (trapId, boulderMesh, rollAxis) => {
        const originX = boulderMesh.position.x;
        const originZ = boulderMesh.position.z;
        trapHooks?.onBoulderReady?.(trapId, (offsetM) => {
          if (rollAxis === 'x') {
            boulderMesh.position.x = originX + offsetM;
            boulderMesh.position.z = originZ;
            boulderMesh.rotation.z = -offsetM;
          } else {
            boulderMesh.position.x = originX;
            boulderMesh.position.z = originZ + offsetM;
            boulderMesh.rotation.x = offsetM;
          }
        });
      },
      onLeverMeshReady: (leverId, handleMesh, sealMesh) => {
        trapHooks?.onLeverReady?.(leverId, (handleAngleRad, sealY) => {
          handleMesh.rotation.z = handleAngleRad;
          sealMesh.position.y = sealY;
        });
      },
    }) ?? [];

    // Pulviscolo in sospensione proporzionale alla profondità: l'aria si fa
    // più densa scendendo verso la base della piramide. Prima l'intensità era
    // bloccata a 0.12 e setSandStormIntensity non veniva mai chiamata.
    const depth = Math.max(0, Math.min(1, (layout.floorIndex - 1) / 9));
    sandStormController?.setIntensity(0.08 + depth * 0.30);
    for (const bounds of roomBounds) {
      frustumCuller.registerRoom(bounds);
    }

    // G-14: carica i modelli .glb dei landmark dichiarati nel manifest e li
    // aggiunge sopra la primitiva placeholder (la copre visivamente). Se il
    // modello manca, la primitiva resta — fallback silenzioso.
    void loadLandmarkModels(layout).catch((error: unknown) => {
      log.warn('Caricamento landmark GLB fallito', { error: String(error) });
    });

    // G-14: decorazione procedurale delle stanze (vasi, anfore, candele,
    // colonne, cumuli di sabbia) — deterministico, solo stanze non critiche.
    // v2: mood per fascia del piano (Cripta = ossa, Anticamera = vasi).
    try {
      const { decorateRooms } = await import('@/rendering/RoomDecor.js');
      const decorResult = decorateRooms({
        layout,
        dungeonRoot,
        wallMaterial,
        sandColor: 0x8a7350,
        clayColor: 0x9c6b3c,
        candleColor: 0xd4a05a,
        mood: layout.floorIndex >= 5 ? 'cripta' : layout.floorIndex <= 2 ? 'anticamera' : 'galleria',
        hieroglyphPanelTexture: createHieroglyphPanelTexture(layout.floorIndex),
      });
      decorGlyphMaterial = decorResult.glyphMaterial;
    } catch (error) {
      log.warn('Decorazione stanze non disponibile', { error: String(error) });
    }

    // GAME-ART-008: props della stanza speciale (arsenale / tesoreria / santuario).
    try {
      const { placeSpecialRoomProps } = await import('@/rendering/SpecialRoomProps.js');
      placeSpecialRoomProps(layout.specialProps, dungeonRoot, wallMaterial, lodManager);
    } catch (error) {
      log.warn('Props stanza speciale non disponibili', { error: String(error) });
    }

    // W-5 / task-9: piazza props GLB KayKit nelle stanze grandi.
    void placeRoomColumns(layout, dungeonRoot);
    // A1: archi/gate CC0 sulle soglie (complementa il glow a pavimento).
    void placeDoorwayGates(layout, dungeonRoot);

    // ART-005: tromba di scale sotto l'uscita, quando il piano ne ha una.
    // L'ultimo piano ha un'uscita vera, non una scala: lì non va costruita.
    void buildExitStaircase(layout);

    _doorClosedPos.x = layout.exitDoorClosedPosition.x;
    _doorClosedPos.y = layout.exitDoorClosedPosition.y;
    _doorClosedPos.z = layout.exitDoorClosedPosition.z;
    _doorOpenPos.x = layout.exitDoorOpenPosition.x;
    _doorOpenPos.y = layout.exitDoorOpenPosition.y;
    _doorOpenPos.z = layout.exitDoorOpenPosition.z;
    _doorYawRad = layout.exitDoorYawRad;
    _doorOpen = false;

    if (_doorMesh) {
      _doorMesh.position.set(_doorClosedPos.x, _doorClosedPos.y, _doorClosedPos.z);
      _doorMesh.rotation.set(0, _doorYawRad, 0);
    }
    if (exitBeacon) {
      exitBeacon.position.set(_doorClosedPos.x, _doorClosedPos.y + 1.0, _doorClosedPos.z);
    }
    if (exitBeaconLight) {
      exitBeaconLight.position.set(_doorClosedPos.x, _doorClosedPos.y + 1.0, _doorClosedPos.z);
    }

    if (physicsWorld) {
      _doorPhysics = physicsWorld.createKinematicBox(
        _doorClosedPos,
        isDoorRotated(_doorYawRad)
          ? { x: 0.1, y: 1.75, z: 1.0 }
          : { x: 1.0, y: 1.75, z: 0.1 },
      );
    }

    // Preset dei temi presenti sul piano, risolti una volta sola: la ricerca
    // per stanza dentro il loop dei bracieri sarebbe ripetuta inutilmente.
    const { presetFor: resolvePreset } = await import('@/content/RoomThemes.js');
    const themePresets = new Map(
      layout.rooms.map((r) => [r.theme, resolvePreset(r.theme)] as const),
    );

    for (const brazier of layout.braziers) {
      const brazierMaterial = new THREE.MeshStandardMaterial({
        color: 0x6a4726,
        emissive: 0x220c02,
        emissiveIntensity: 0.22,
        roughness: 0.58,
        metalness: 0.2,
      });
      // Braciere procedurale: treppiede, coppa e carboni. Prima era un solo
      // cilindro tronco-conico, che in scena leggeva come un cono nudo.
      //
      // Serve da STRUTTURA PORTANTE e da fallback: porta il materiale con
      // l'emissive acceso/spento e la luce. Se `brazier.glb` si carica, viene
      // innestato sopra e questa geometria diventa invisibile — così tutti i
      // bracieri del piano hanno lo stesso aspetto, compreso quello del
      // landmark 'braciere-eterno' che già usava il GLB.
      const bowlGroup = new THREE.Group();
      bowlGroup.position.set(brazier.position.x, brazier.position.y, brazier.position.z);

      // Tre gambe divaricate.
      const legGeo = new THREE.CylinderGeometry(0.045, 0.035, 0.62, 6);
      for (let leg = 0; leg < 3; leg++) {
        const a = (leg / 3) * Math.PI * 2;
        const legMesh = new THREE.Mesh(legGeo, brazierMaterial);
        legMesh.position.set(Math.cos(a) * 0.20, 0.29, Math.sin(a) * 0.20);
        legMesh.rotation.set(Math.cos(a) * 0.22, 0, -Math.sin(a) * 0.22);
        legMesh.castShadow = true;
        bowlGroup.add(legMesh);
      }

      // Anello che lega le gambe: il dettaglio che dice "forgiato".
      const ringMesh = new THREE.Mesh(
        new THREE.TorusGeometry(0.21, 0.028, 6, 16),
        brazierMaterial,
      );
      ringMesh.rotation.x = Math.PI / 2;
      ringMesh.position.y = 0.22;
      bowlGroup.add(ringMesh);

      // Coppa svasata poggiata sul treppiede.
      const bowl = new THREE.Mesh(
        new THREE.CylinderGeometry(0.44, 0.26, 0.30, 14),
        brazierMaterial,
      );
      bowl.position.y = 0.72;
      bowl.castShadow = true;
      bowl.receiveShadow = true;
      bowlGroup.add(bowl);

      // Labbro superiore: spessore visibile invece di un bordo tagliato netto.
      const lip = new THREE.Mesh(
        new THREE.TorusGeometry(0.44, 0.035, 6, 18),
        brazierMaterial,
      );
      lip.rotation.x = Math.PI / 2;
      lip.position.y = 0.87;
      bowlGroup.add(lip);

      // Carboni: calotta scura che riempie la coppa. L'emissive viene gestito
      // dal materiale condiviso, quindi si accende insieme al braciere.
      const coals = new THREE.Mesh(
        new THREE.SphereGeometry(0.30, 10, 6, 0, Math.PI * 2, 0, Math.PI / 2),
        brazierMaterial,
      );
      coals.position.y = 0.84;
      coals.scale.y = 0.45;
      bowlGroup.add(coals);

      brazierRoot.add(bowlGroup);
      void attachBrazierModel(bowlGroup);
      // Collider del braciere: anche questo mancava, e ci si passava dentro.
      // Copre treppiede e coppa (alta ~0.9 m), non la fiamma.
      createStaticBox(
        brazier.position.x, 0.45, brazier.position.z,
        0.40, 0.45, 0.40,
      );

      // ART-004: la luce del braciere scala col tema della stanza. Un
      // santuario è dorato e ampio, una camera infestata è quasi cieca:
      // è la differenza di luce, più della geometria, a renderle distinte.
      const room = layout.rooms.find((r) => r.roomId === brazier.roomId);
      const lightScale = room ? themePresets.get(room.theme)?.lightScale ?? 1 : 1;
      const light = new THREE.PointLight(0xff9b3d, 12 * lightScale, 9, 2);
      light.visible = false;
      // All'altezza dei carboni (0.84 + un po'), non a metà della vecchia
      // coppa: la luce deve nascere dal fuoco, non dal piede del braciere.
      light.position.set(brazier.position.x, brazier.position.y + 0.95, brazier.position.z);
      light.castShadow = true;
      light.shadow.mapSize.set(512, 512);
      light.shadow.bias = -0.0002;
      brazierRoot.add(light);

      brazierLights.set(brazier.brazierId, light);
      brazierMaterials.set(brazier.brazierId, brazierMaterial);
    }

    if (layout.digSite) {
      // Marker di scavo: prima era un disco piatto emissivo, identico a ogni
      // distanza — un segnale binario in un compito di ricerca, che non
      // diceva né "scava qui" né "sei vicino".
      //
      // Ora è composto da tre elementi leggibili a distanze diverse:
      //  1. sabbia smossa a terra  — dice "qui si scava" da vicino;
      //  2. anello inciso          — dà il centro esatto del punto;
      //  3. fascio verticale       — visibile da lontano, oltre le colonne.
      // L'intensità cresce avvicinandosi (vedi updateDigSiteProximity).
      const marker = new THREE.Group();

      const mound = new THREE.Mesh(
        new THREE.CylinderGeometry(0.95, 1.15, 0.1, 20),
        digSiteMaterial,
      );
      mound.position.y = 0.05;
      mound.receiveShadow = true;
      marker.add(mound);

      const ring = new THREE.Mesh(
        new THREE.TorusGeometry(0.66, 0.055, 8, 24),
        digSiteMaterial,
      );
      ring.rotation.x = -Math.PI / 2;
      ring.position.y = 0.12;
      marker.add(ring);

      // Segno dipinto dentro l'anello: una croce a quattro bracci in blu
      // egizio, il colore che nelle tombe segnala il sacro. Serve a rendere
      // il punto RICONOSCIBILE, non solo luminoso: l'anello dorato da solo
      // si confondeva con gli altri riflessi del pavimento.
      const glyphMat = new THREE.MeshBasicMaterial({
        color: 0x2E63B8,
        transparent: true,
        opacity: 0.92,
        depthWrite: false,
      });
      digSiteGlyphMaterial = glyphMat;
      for (let arm = 0; arm < 4; arm++) {
        const bar = new THREE.Mesh(new THREE.PlaneGeometry(0.62, 0.14), glyphMat);
        bar.rotation.x = -Math.PI / 2;
        bar.rotation.z = (arm * Math.PI) / 2;
        // Sfalsata dal centro: i quattro bracci formano una croce aperta.
        bar.position.set(
          Math.cos((arm * Math.PI) / 2) * 0.30,
          0.13,
          Math.sin((arm * Math.PI) / 2) * 0.30,
        );
        marker.add(bar);
      }
      // Disco centrale, sempre in blu: il punto esatto dove scavare.
      const center = new THREE.Mesh(new THREE.CircleGeometry(0.17, 16), glyphMat);
      center.rotation.x = -Math.PI / 2;
      center.position.y = 0.135;
      marker.add(center);

      // Fascio: cono rovesciato additivo, non proietta luce (nessun costo
      // di shadow map) ma buca il buio e si vede da tutta la stanza.
      digSiteBeamMaterial = new THREE.MeshBasicMaterial({
        color: 0xe8b451,
        transparent: true,
        opacity: 0.14,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
        side: THREE.DoubleSide,
      });
      const beam = new THREE.Mesh(
        new THREE.ConeGeometry(0.55, 3.4, 12, 1, true),
        digSiteBeamMaterial,
      );
      beam.position.y = 1.7;
      marker.add(beam);

      marker.position.set(layout.digSite.position.x, 0, layout.digSite.position.z);
      digSiteMarker = marker;
      brazierRoot.add(marker);
    }

    // Hint corridoio raggiungibile: soglia dorata a pavimento sulle porte.
    // Leggibile senza torcia, non invasivo (opacity bassa, no light cast).
    if (layout.doorways.length > 0) {
      doorwayGlowMaterial = new THREE.MeshBasicMaterial({
        color: 0xc8900a,
        transparent: true,
        opacity: 0.18,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
      });
      for (const doorway of layout.doorways) {
        const alongAxis = doorway.axis === 'x';
        const w = alongAxis ? 0.55 : 1.35;
        const d = alongAxis ? 1.35 : 0.55;
        const pad = new THREE.Mesh(new THREE.PlaneGeometry(w, d), doorwayGlowMaterial);
        pad.rotation.x = -Math.PI / 2;
        pad.position.set(doorway.center.x, 0.04, doorway.center.z);
        brazierRoot.add(pad);
      }
    }

    log.info('Layout floor applicato al renderer', {
      floorId: layout.floorId,
      rooms: layout.rooms.length,
      corridors: layout.corridors.length,
      doorways: layout.doorways.length,
    });
  }

  function createStaticBox(
    x: number,
    y: number,
    z: number,
    hx: number,
    hy: number,
    hz: number,
  ): void {
    if (!physicsWorld) return;
    physicsWorld.createStaticBox({ x, y, z }, { x: hx, y: hy, z: hz });
  }

  function render(deltaMs: number): void {
    if (disposed) return;

    if (torchLight.visible) {
      torchLight.position.copy(camera.position);
      torchLight.target.position.copy(
        camera.position.clone().add(
          new THREE.Vector3(0, 0, -1).applyQuaternion(camera.quaternion),
        ),
      );

      // G-18 V2: flicker da "vera torcia" — respiro lento + tremolio medio +
      // sfarfallio rapido, con una deriva a bassa frequenza che simula il vento.
      const t = performance.now() * 0.001;
      const flickerFactor = presentation.reduceTorchFlicker ? 0.3 : 1.0;
      const flicker = 1.0 +
        Math.sin(t * 0.23 * Math.PI * 2) * 0.045 * flickerFactor +
        Math.sin(t * 0.71 * Math.PI * 2) * 0.035 * flickerFactor +
        Math.sin(t * 3.1 * Math.PI * 2) * 0.06 * flickerFactor +
        Math.sin(t * 11.3 * Math.PI * 2) * 0.025 * flickerFactor +
        Math.sin(t * 0.13 * Math.PI * 2) * 0.03 * flickerFactor;
      torchLight.intensity = 38 * flicker;
      placedTorchLight.intensity = placedTorchLight.visible ? 8 * (0.92 + flicker * 0.16) : 0;

      // Alone caldo della fiamma: segue la camera, respira col flicker.
      torchAmbientLight.visible = true;
      torchAmbientLight.position.copy(camera.position);
      torchAmbientLight.intensity = 2.8 * (0.85 + flicker * 0.3);

      // G-15: animazione fiamme procedurali
      const litGain = presentation.reduceTorchFlicker ? 0.35 : 1.0;
      handFlame?.update(deltaMs, litGain);
      placedFlame?.update(deltaMs, litGain);
      weaponViewmodel?.update(deltaMs);

      // V6: god ray della torcia accesa — visibile e pulsante col flicker
      if (torchBeam) {
        torchBeam.mesh.visible = true;
        torchBeam.material.opacity = 0.03 + 0.03 * flicker;
      }
    } else {
      torchAmbientLight.visible = false;
      if (torchBeam) {
        torchBeam.mesh.visible = false;
      }
    }

    // Il braccio si anima anche a torcia spenta: la porti comunque in mano,
    // e l'accensione parte proprio da lì.
    torchViewmodel?.update(deltaMs);

    // Mixer dei nemici animati (i modelli statici non hanno animator).
    for (const visual of enemyVisuals) {
      visual.animator?.update(deltaMs);
    }

    sparkBurst?.update(deltaMs);
    weaponTrail?.update(deltaMs);

    // G-05: il reliquiario fluttua e ruota lentamente (attira l'occhio)
    if (lootReliquary) {
      const t = performance.now() * 0.001;
      lootReliquary.rotation.y = Math.sin(t * 0.6) * 0.4;
      lootReliquary.position.y = 0.02 + Math.sin(t * 1.4) * 0.06;
    }
    if (shovelPickupGroup) {
      const t = performance.now() * 0.001;
      shovelPickupGroup.rotation.y = t * 0.8;
      shovelPickupGroup.position.y = 0.04 + Math.sin(t * 1.8) * 0.04;
    }

    if (placedTorchMesh.visible) {
      placedTorchMesh.rotation.z = Math.PI / 2.9;
      placedTorchMesh.rotation.y += deltaMs * 0.00016;
    }

    applyCameraShake(deltaMs);

    // Pulsazione beacon uscita: rotazione lenta + emissive oscillante per
    // rendere l'uscita individuabile anche da lontano.
    if (exitBeacon) {
      const beaconT = performance.now() * 0.002;
      const beaconPulse = 0.7 + Math.sin(beaconT) * 0.3;
      exitBeaconMaterial.emissiveIntensity = 1.8 * beaconPulse;
      if (exitBeaconLight) exitBeaconLight.intensity = 14 * beaconPulse;
      exitBeacon.rotation.y += deltaMs * 0.001;
    }

    // Glifi sul pavimento: pulsazione emissiva lenta (2 onde indipendenti sfasate).
    if (decorGlyphMaterial) {
      const gt = performance.now() * 0.00085;
      decorGlyphMaterial.emissiveIntensity = 0.95 + Math.sin(gt) * 0.45 + Math.sin(gt * 1.618) * 0.1;
    }

    updateDigSiteProximity();

    // Occhio del Ladro: pulsazione del tell di pericolo sul sito di scavo.
    // Ha la precedenza sul gradiente di vicinanza: il pericolo va comunicato
    // sempre, anche da lontano.
    if (dangerTellActive && digSiteMarker) {
      const pulse = 1.4 + Math.sin(performance.now() * 0.006) * 0.6;
      digSiteMaterial.emissiveIntensity = pulse;
    }

    frustumCuller.update(camera);
    lodManager?.update(camera);
    if (shadowMapOptimizer) {
      shadowMapOptimizer.update(camera.position);
    }

    if (webgpuPipeline) {
      webgpuPipeline.render();
    } else if (composer && postFxEnabled) {
      composer.render();
    } else {
      renderer.render(scene, camera);
    }
    void deltaMs;
  }

  // ── Camera shake (G-07) ──────────────────────────────────────────────────
  // Vibrazione decadente applicata DOPO setCameraPose: la posa autoritativa
  // viene prima, lo shake è un offset visivo transitorio che non altera la
  // simulazione. reduceCameraShake lo attenua, e con l'opzione disabilitata
  // (o ridotta) il movimento resta stabile per chi soffre di cinetosi.
  let cameraShakeAmount = 0;

  function applyCameraShake(deltaMs: number): void {
    if (cameraShakeAmount <= 0) return;

    const shakeFactor = presentation.reduceCameraShake ? 0.35 : 1.0;
    const intensity = cameraShakeAmount * shakeFactor;
    const t = performance.now() * 0.001;
    const jitter = 0.045 * intensity;
    camera.position.x += Math.sin(t * 41.7) * jitter;
    camera.position.y += Math.cos(t * 33.1) * jitter * 0.7;
    camera.position.z += Math.sin(t * 51.3 + 1.7) * jitter;

    // Decadimento: ~40% al secondo, torna piatto in ~0.5s per un colpo medio.
    cameraShakeAmount = Math.max(0, cameraShakeAmount - deltaMs * 0.0009);
  }

  /** Aggiunge vibrazione alla camera (0-1). Accumula con gli effetti attivi. */
  function addCameraShake(intensity: number): void {
    cameraShakeAmount = Math.min(1, cameraShakeAmount + Math.max(0, intensity));
  }

  /** Oltre questa distanza il sito di scavo è al minimo di intensità. */
  const DIG_SITE_FAR_M = 18;
  /** Sotto questa distanza è al massimo: il giocatore è praticamente sopra. */
  const DIG_SITE_NEAR_M = 2.5;

  /**
   * Modula il marker di scavo in base alla distanza dal giocatore.
   *
   * Il vecchio marker era acceso in modo costante: comunicava "esisto", non
   * "sei vicino". Con un gradiente il giocatore può orientarsi a vista mentre
   * cerca, invece di dover incrociare il punto esatto.
   */
  function updateDigSiteProximity(): void {
    if (!digSiteMarker) return;

    const dx = camera.position.x - digSiteMarker.position.x;
    const dz = camera.position.z - digSiteMarker.position.z;
    const distance = Math.hypot(dx, dz);

    // 0 = lontano, 1 = addosso.
    const t = 1 - Math.min(1, Math.max(0,
      (distance - DIG_SITE_NEAR_M) / (DIG_SITE_FAR_M - DIG_SITE_NEAR_M),
    ));

    if (!dangerTellActive) {
      // Da 0.45 (appena percettibile) a 1.9 (inequivocabile).
      digSiteMaterial.emissiveIntensity = 0.45 + t * 1.45;
    }
    if (digSiteBeamMaterial) {
      // Il fascio si accende avvicinandosi ma non sparisce mai del tutto:
      // deve restare un punto di riferimento anche da lontano.
      digSiteBeamMaterial.opacity = 0.07 + t * 0.20;
    }
    if (digSiteGlyphMaterial) {
      // Il segno blu resta sempre leggibile: è ciò che identifica il punto,
      // mentre l'oro attorno è solo richiamo. Da lontano si attenua un po'
      // per non competere con il fascio.
      digSiteGlyphMaterial.opacity = 0.55 + t * 0.40;
    }
  }

  // Occhio del Ladro: tell di pericolo sul sito di scavo (emissive pulsante).
  let dangerTellActive = false;

  function setDangerTell(active: boolean): void {
    dangerTellActive = active;
    if (!digSiteMarker) return;
    if (active) {
      digSiteMaterial.emissive.setHex(0xaa2a10);
      digSiteMaterial.emissiveIntensity = 2.0;
    } else {
      digSiteMaterial.emissive.setHex(0x7a4a10);
      digSiteMaterial.emissiveIntensity = 1.2;
    }
  }

  /**
   * Aggancia il modello GLB corrispondente all'archetipo del nemico.
   *
   * I sette modelli in public/assets/enemies/ esistevano già ma non venivano
   * mai caricati: ogni nemico era una CapsuleGeometry, e in scena non
   * assomigliava a nulla di riconoscibile.
   *
   * Percorso, scala e offset vengono da `ENEMY_ASSETS` (content/assets.ts),
   * che è l'unica fonte di verità: aggiungere o spostare un modello si fa lì,
   * non qui. (Una prima versione di questa funzione aveva i valori hardcoded,
   * duplicando un manifest che esisteva già.)
   *
   * La capsula resta come fallback: se il GLB manca il nemico è comunque
   * visibile. Quando il modello arriva la capsula diventa invisibile ma
   * continua a portare il materiale, così dissolve, hit flash e telegrafo
   * restano funzionanti.
   */
  function attachEnemyModel(
    visual: { mesh: THREE.Mesh; model?: THREE.Group; kind?: string },
    kind: string,
  ): void {
    if (visual.kind === kind) return;
    visual.kind = kind;

    const cached = enemyModelCache.get(kind);
    if (cached) { mountEnemyModel(visual, cached, enemyModelOffsets.get(kind) ?? 0); return; }

    void (async (): Promise<void> => {
      try {
        const [{ loadArtifact }, { ENEMY_ASSETS }] = await Promise.all([
          import('@/rendering/ArtifactLoader.js'),
          import('@/content/assets.js'),
        ]);
        const entry = ENEMY_ASSETS.find((e) => e.archetype === kind);
        // modelPath null è legittimo (es. WITNESS): resta la primitiva.
        if (!entry?.modelPath || disposed) return;

        const model = await loadArtifact({
          id: `enemy_${kind}`,
          url: `/${entry.modelPath}`,
          displayName: kind,
          loreName: null,
          rarity: 'common',
          interactable: false,
          scale: entry.scale,
          description: null,
          source: 'procedural',
        });
        // `disposed` può diventare true durante l'await del GLB: TS non
        // modella la mutazione attraverso il confine async e lo crede sempre
        // false, ma senza questa guardia si aggiungerebbe un modello a una
        // scena già rilasciata.
        // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
        if (!model || disposed) return;
        enemyModelCache.set(kind, model);
        enemyModelOffsets.set(kind, entry.yOffset);
        mountEnemyModel(visual, model, entry.yOffset);
      } catch {
        // GLB assente o corrotto: resta la capsula, nessun crash.
      }
    })();
  }

  /** Scala di discesa del piano corrente (ART-005). */
  let staircase: import('@/rendering/Staircase.js').Staircase | null = null;

  /**
   * Costruisce la tromba di scale sotto l'uscita.
   *
   * Rende la discesa uno spazio percorribile: prima si interagiva con la
   * porta e partiva una dissolvenza, quindi la piramide cresceva in pianta
   * ma non si scendeva mai davvero.
   *
   * Solo sui piani che hanno una scala: l'ultimo ha un'uscita vera.
   */
  async function buildExitStaircase(layout: FloorSceneLayout): Promise<void> {
    staircase?.dispose();
    staircase = null;
    if (!layout.exitIsStair) return;

    const { createStaircase } = await import('@/rendering/Staircase.js');
    if (disposed) return;

    // Parte poco oltre la soglia, nella direzione in cui guarda la porta.
    const origin = {
      x: layout.exitPosition.x,
      y: 0,
      z: layout.exitPosition.z,
    };
    const built = createStaircase(origin, layout.exitDoorYawRad, wallMaterial, createStaticBox);
    dungeonRoot.add(built.group);
    staircase = built;
  }

  /** Modello del braciere, condiviso da tutti i bracieri del piano. */
  let brazierModelPromise: Promise<THREE.Group | null> | null = null;

  /**
   * Innesta `brazier.glb` sulla struttura procedurale del braciere.
   *
   * Il GLB è l'asset dell'artista, già usato dal landmark 'braciere-eterno':
   * usarlo anche per i bracieri distribuiti evita due stili diversi nello
   * stesso piano. La geometria procedurale sotto resta come fallback e come
   * portatrice del materiale che gestisce acceso/spento.
   */
  async function attachBrazierModel(host: THREE.Group): Promise<void> {
    brazierModelPromise ??= (async (): Promise<THREE.Group | null> => {
      try {
        const [{ loadArtifact }, { LANDMARK_ASSETS }] = await Promise.all([
          import('@/rendering/ArtifactLoader.js'),
          import('@/content/assets.js'),
        ]);
        const entry = LANDMARK_ASSETS.find((l) => l.kind === 'brazier');
        if (!entry?.modelPath) return null;
        return await loadArtifact({
          id: 'brazier_shared',
          url: `/${entry.modelPath}`,
          displayName: 'Braciere',
          loreName: null,
          rarity: 'common',
          interactable: false,
          scale: entry.scale,
          description: null,
          source: 'procedural',
        });
      } catch {
        return null;
      }
    })();

    const model = await brazierModelPromise;
    // Nessun GLB disponibile: resta la geometria procedurale, già in scena.
    if (!model || disposed) return;

    const clone = model.clone(true);
    host.add(clone);
    // Nasconde le parti procedurali ma NON il gruppo: il materiale condiviso
    // continua a pilotare l'emissive di accensione.
    for (const child of host.children) {
      if (child !== clone) child.visible = false;
    }
  }

  /** Innesta il modello sulla capsula portante, allineandolo a terra. */
  function mountEnemyModel(
    visual: {
      mesh: THREE.Mesh;
      model?: THREE.Group;
      kind?: string;
      animator?: import('@/rendering/EnemyAnimator.js').EnemyAnimator | null;
    },
    source: THREE.Group,
    yOffset: number,
  ): void {
    if (disposed) return;
    if (visual.model) visual.mesh.remove(visual.model);
    visual.animator?.dispose();
    visual.animator = null;
    const clone = source.clone(true);
    // La capsula (raggio 0.45, altezza 1.2) ha origine al centro; i GLB hanno
    // il pivot ai piedi. yOffset del manifest corregge i modelli fuori asse.
    clone.position.y = -1.05 + yOffset;
    visual.mesh.add(clone);
    visual.model = clone;
    visual.mesh.visible = true;
    (visual.mesh.material as THREE.Material).visible = false;

    // Animator sul clone: quattro dei sette GLB sono statici, quindi
    // createEnemyAnimator ritorna null e resta il respiro procedurale.
    void (async (): Promise<void> => {
      const [{ createEnemyAnimator }, { getArtifactClips }] = await Promise.all([
        import('@/rendering/EnemyAnimator.js'),
        import('@/rendering/ArtifactLoader.js'),
      ]);
      // `disposed` cambia durante l'await (TS non lo modella), e il modello
      // può essere stato rimpiazzato nel frattempo da un cambio piano.
      // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
      if (disposed || visual.model !== clone) return;
      const clips = getArtifactClips(`enemy_${visual.kind ?? ''}`);
      visual.animator = createEnemyAnimator(clone, clips);
    })();
  }

  function ensureEnemyVisualCount(count: number): void {
    while (enemyVisuals.length < count) {
      const material = enemyMaterial.clone();
      const mesh = new THREE.Mesh(new THREE.CapsuleGeometry(0.45, 1.2, 4, 8), material);
      mesh.visible = false;
      mesh.castShadow = true;
      mesh.receiveShadow = true;
      scene.add(mesh);
      enemyVisuals.push({ mesh, material, phaseOffset: enemyVisuals.length * 1.618 });
    }
  }

  // G-16: dissolve applicato a tutti i cloni del materiale nemico. I cloni
  // condividono le uniform della closure originale (uDissolve), quindi il
  // setter globale pilota l'intero gruppo — corretto per il VS.
  function setEnemyDissolve(value: number): void {
    enemyDissolve = Math.max(0, Math.min(1, value));
    dissolveSetter?.(enemyDissolve);
  }

  // G-14: carica i .glb dei landmark dichiarati nel manifest e li posiziona
  // sopra la primitiva. Fire-and-forget: nessun blocco del rendering.
  async function loadLandmarkModels(layout: FloorSceneLayout): Promise<void> {
    try {
      const { landmarkAssetFor } = await import('@/content/assets.js');
      const { createAssetLoader } = await import('@/rendering/AssetLoader.js');
      const loader = assetLoader ?? createAssetLoader();
      assetLoader = loader;

      for (const landmark of layout.landmarks) {
        const entry = landmarkAssetFor(landmark.landmarkId);
        if (!entry?.modelPath) {
          continue;
        }
        const gltf = await loader.load(entry.modelPath);
        if (!gltf || disposed) {
          continue;
        }
        const model = gltf.scene.clone(true);
        model.traverse((child) => {
          if (child instanceof THREE.Mesh) {
            child.castShadow = true;
            child.receiveShadow = true;
          }
        });
        model.scale.setScalar(entry.scale);
        model.position.set(landmark.position.x, entry.yOffset, landmark.position.z);
        dungeonRoot.add(model);
      }
    } catch (error) {
      log.warn('Landmark model load fallito', { error: String(error) });
    }
  }

  function setCameraPose(x: number, y: number, z: number, yaw: number, pitch: number): void {
    if (disposed) return;
    camera.position.set(x, y, z);
    camera.quaternion.setFromEuler(new THREE.Euler(pitch, yaw, 0, 'YXZ'));
  }

  function interactDoor(): boolean {
    if (!_doorMesh) return false;
    const dx = camera.position.x - _doorMesh.position.x;
    const dz = camera.position.z - _doorMesh.position.z;
    const dist = Math.sqrt(dx * dx + dz * dz);
    if (dist > 3.0) return false;

    _doorOpen = !_doorOpen;
    const target = _doorOpen ? _doorOpenPos : _doorClosedPos;
    _doorMesh.position.set(target.x, target.y, target.z);
    _doorMesh.rotation.y = _doorYawRad + (_doorOpen ? Math.PI / 2 : 0);
    _doorPhysics?.setTranslation(target);
    return true;
  }

  function applyPresentation(settings: RendererPresentationSettings): void {
    presentation = settings;
    camera.fov = settings.fovDeg;
    camera.updateProjectionMatrix();

    // G-15 V5: contrasto alto ⇒ bloom ridotto (accessibilità, non cheat).
    if (bloomPass) {
      bloomPass.strength = settings.highContrast ? 0.22 : 0.55;
    }

    handFlame?.setFlickerReduced(settings.reduceTorchFlicker);
    placedFlame?.setFlickerReduced(settings.reduceTorchFlicker);

    const palette = resolveWorldAccessibilityPalette(
      settings.colorBlindMode,
      settings.highContrast,
    );
    const backgroundColor = palette.backgroundColor;
    scene.background = new THREE.Color(backgroundColor);
    scene.fog = new THREE.FogExp2(backgroundColor, settings.assistedLight ? 0.00045 : 0.0011);
    // Senza torcia: penombra. Con assistedLight: leggibilità, non daylight.
    ambientLight.intensity = settings.assistedLight ? 0.22 : 0.07;
    hemiLight.intensity = settings.assistedLight ? 0.18 : 0.11;
    floorMaterial.color.setHex(palette.floorColor);
    wallMaterial.color.setHex(palette.wallColor);
    doorMaterial.color.setHex(palette.doorColor);
    enemyMaterial.color.setHex(palette.enemyColor);
    exitBeaconMaterial.color.setHex(palette.exitColor);
    placedTorchMaterial.color.setHex(palette.placedTorchColor);
    placedTorchMaterial.emissive.setHex(palette.placedTorchEmissive);
    digSiteMaterial.color.setHex(palette.digSiteColor);
    digSiteMaterial.emissive.setHex(palette.digSiteEmissive);
    for (const material of brazierMaterials.values()) {
      material.color.setHex(palette.brazierColor);
      material.emissive.setHex(palette.brazierEmissive);
    }
  }

  function ensureScarabSwarmMesh(): THREE.InstancedMesh {
    if (scarabSwarmMesh) return scarabSwarmMesh;
    const geo = new THREE.SphereGeometry(0.32, 8, 6);
    const mat = new THREE.MeshStandardMaterial({
      color: 0x3d5c28,
      metalness: 0.35,
      roughness: 0.5,
      emissive: 0x1a2e10,
      emissiveIntensity: 0.35,
    });
    scarabSwarmMesh = new THREE.InstancedMesh(geo, mat, SCARAB_SWARM_INSTANCE_CAP);
    scarabSwarmMesh.count = 0;
    scarabSwarmMesh.castShadow = true;
    scarabSwarmMesh.frustumCulled = true;
    scene.add(scarabSwarmMesh);
    return scarabSwarmMesh;
  }

  function updateScarabSwarmInstances(states: readonly RendererEnemyState[]): void {
    const mesh = ensureScarabSwarmMesh();
    const n = Math.min(states.length, SCARAB_SWARM_INSTANCE_CAP);
    mesh.count = n;
    mesh.visible = n > 0;
    for (let i = 0; i < n; i++) {
      const s = states[i];
      if (!s) continue;
      const scale = Math.max(0.35, s.modelScale) * (0.9 + s.hpRatio * 0.2);
      scarabSwarmDummy.position.set(s.x, s.y + 0.15, s.z);
      scarabSwarmDummy.scale.setScalar(scale);
      scarabSwarmDummy.rotation.set(0, i * 0.7, 0);
      scarabSwarmDummy.updateMatrix();
      mesh.setMatrixAt(i, scarabSwarmDummy.matrix);
      const color = s.hitFlash
        ? new THREE.Color(0xa23f16)
        : s.awakened
          ? new THREE.Color(0x6a9a40)
          : new THREE.Color(0x3d5c28);
      mesh.setColorAt(i, color);
    }
    mesh.instanceMatrix.needsUpdate = true;
    if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
  }

  function setEnemyStates(states: readonly RendererEnemyState[]): void {
    const scarabs = states.filter((s) => s.kind === 'SCARAB' && s.alive);
    const useSwarmBatch = scarabs.length >= 3;
    const individual = useSwarmBatch
      ? states.filter((s) => s.kind !== 'SCARAB')
      : states;

    if (useSwarmBatch) {
      updateScarabSwarmInstances(scarabs);
    } else if (scarabSwarmMesh) {
      scarabSwarmMesh.count = 0;
      scarabSwarmMesh.visible = false;
    }

    ensureEnemyVisualCount(individual.length);

    // G-16: dissolve alla morte — se almeno un nemico è caduto, il materiale
    // dissolve verso il bordo dorato; quando tutti i marker tornano vivi o
    // spariscono, il render loop lo fa decadere a 0.
    const anyDead = states.some((state) => !state.alive);
    if (anyDead) {
      setEnemyDissolve(1);
    } else if (enemyDissolve > 0) {
      setEnemyDissolve(Math.max(0, enemyDissolve - 0.02));
    }

    for (let i = 0; i < enemyVisuals.length; i++) {
      const visual = enemyVisuals[i];
      if (!visual) {
        continue;
      }
      const state = individual[i];
      if (!state?.alive) {
        // Se c'è un'animazione di morte la si lascia finire prima di
        // nascondere il nemico: sparire di colpo annulla il dissolve.
        if (visual.animator) {
          visual.animator.setState('DEATH');
        } else {
          visual.mesh.visible = false;
        }
        continue;
      }

      // Monta il modello GLB del tipo di nemico (no-op se già montato).
      if (state.kind) attachEnemyModel(visual, state.kind);

      // Stato d'animazione derivato da quello che il gameplay già espone.
      // Priorità: colpito → attacco in telegrafo → sveglio → quiescente.
      if (visual.animator) {
        const anim = state.hitFlash ? 'HIT'
          : state.telegraphStrength > 0.35 ? 'ATTACK'
            : state.awakened ? 'MOVE'
              : 'IDLE';
        visual.animator.setState(anim);
      }

      const telegraph = THREE.MathUtils.clamp(state.telegraphStrength, 0, 1);
      // G-07: amplifiedTelegraphs amplifica scala/emissive del telegrafo d'attacco
      // per rendere il pericolo leggibile anche a giocatori con ridotta acuità.
      const telegraphGain = presentation.amplifiedTelegraphs ? 1.9 : 1.0;
      // B-03: animazione idle procedurale — respiro sinusoidale per nemici svegli.
      // performance.now() solo nel renderer (display code), mai in simulazione.
      const tSec = performance.now() * 0.001;
      const phase = visual.phaseOffset;
      const isAwake = state.awakened;
      const breathAmp = isAwake ? 0.032 : 0.006;
      const breathHz  = isAwake ? 1.15  : 0.45;
      const idleY = Math.sin(tSec * breathHz * Math.PI * 2 + phase) * breathAmp;
      // Attack lunge: Y dip + scale spike al culmine del telegrafo
      const attackLunge = telegraph > 0.05
        ? Math.sin(telegraph * Math.PI) * 0.04 * telegraphGain
        : 0;

      visual.mesh.visible = true;
      visual.mesh.position.set(state.x, state.y + idleY - attackLunge, state.z);
      // Scale breathing (±1.5% quando sveglio, ±0.4% dormiente) + lunge spike
      const breathScale = 1 + Math.sin(tSec * (breathHz * 0.7) * Math.PI * 2 + phase + 1.2) *
        (isAwake ? 0.015 : 0.004);
      visual.mesh.scale.setScalar(
        (0.94 + state.hpRatio * 0.12 + telegraph * 0.18 * telegraphGain) *
          Math.max(0.35, state.modelScale) * breathScale,
      );
      visual.material.emissiveIntensity = 0.7 + telegraph * 0.9 * telegraphGain;
      visual.material.emissive.setHex(
        state.hitFlash
          ? 0xa23f16
          : telegraph > 0.05
            ? 0x4a180c
            : 0x000000,
      );
      visual.material.color.setHex(
        state.awakened
          ? (presentation.highContrast ? 0xf1ebd9 : 0xb7a98d)
          : (presentation.highContrast ? 0xd7d2c0 : 0x8d8a73),
      );
    }

    // Nascondi visual individuali residui oltre individual.length
    for (let i = individual.length; i < enemyVisuals.length; i++) {
      const visual = enemyVisuals[i];
      if (visual) visual.mesh.visible = false;
    }
  }

  function setEnemyState(state: RendererEnemyState | null): void {
    setEnemyStates(state ? [state] : []);
  }

  function setObjectiveState(state: RendererObjectiveState): void {
    if (!_doorMesh || !exitBeacon) return;
    exitBeaconMaterial.emissive.setHex(
      state.completed ? 0x44ff88 :
      state.exitUnlocked ? 0x66c97c :
      0xcc6600,
    );
    exitBeaconMaterial.color.setHex(
      state.completed ? 0xb6ffca :
      state.exitUnlocked ? 0x93d39f :
      0xd4900a,
    );
    if (exitBeaconLight) {
      exitBeaconLight.color.setHex(
        state.completed ? 0x44ff88 :
        state.exitUnlocked ? 0x66c97c :
        0xffaa22,
      );
    }
    _doorMesh.rotation.z = state.completed ? 0.04 : 0;
  }

  /**
   * Debug overlay (v2): metriche renderer del frame corrente — draw calls,
   * triangoli e memoria GPU (quando esposta da WebGL/WebGPU).
   */
  function getDebugStats(): { readonly drawCalls: number; readonly triangles: number; readonly memoryMB: number } {
    const info = renderer.info;
    let memoryMB = 0;
    const memoryInfo = (info as { memory?: { geometries: number; textures: number } }).memory;
    if (memoryInfo) {
      // Stima: ~48B per vertex indice + 4B/byte texture — stima conservativa
      memoryMB = Math.round(
        (info.render.triangles * 12 + memoryInfo.geometries * 512 + memoryInfo.textures * 256) / 1024 / 1024 * 10,
      ) / 10;
    }
    return {
      drawCalls: info.render.calls,
      triangles: info.render.triangles,
      memoryMB,
    };
  }

  function resize(width: number, height: number, pixelRatio: number): void {
    if (disposed) return;
    renderer.setPixelRatio(pixelRatio);
    renderer.setSize(width, height);
    composer?.setSize(width, height);
    camera.aspect = width / Math.max(1, height);
    camera.updateProjectionMatrix();
  }

  function dispose(): void {
    disposed = true;
    if ('setAnimationLoop' in renderer && typeof renderer.setAnimationLoop === 'function') {
      void renderer.setAnimationLoop(null);
    }
    xrActive = false;
    onXrSessionEnd = null;
    lodManager?.clear();
    shadowMapOptimizer?.dispose();
    shadowMapOptimizer = null;
    _doorPhysics?.dispose();
    _doorPhysics = null;
    assetLoader = null;
    handFlame = null;
    torchViewmodel?.dispose();
    torchViewmodel = null;
    placedFlame = null;
    sparkBurst = null;
    weaponTrail = null;
    weaponViewmodel = null;
    envMapTexture?.dispose();
    envMapTexture = null;
    ceilingMaterial?.map?.dispose();
    ceilingMaterial?.dispose();
    ceilingMaterial = null;
    composer?.dispose();
    composer = null;
    bloomPass = null;
    webgpuPipeline?.dispose();
    webgpuPipeline = null;
    renderer.dispose();
    scene.clear();
    log.info('Three.js renderer disposed');
  }

  return {
    get backend(): RenderBackend { return backend; },
    get canvas(): HTMLCanvasElement { return canvas; },
    init,
    render,
    setTorchLit(lit: boolean): void {
      torchLight.visible = lit;
      torchAmbientLight.visible = lit;
      if (handFlame) {
        handFlame.group.visible = lit;
      }
      // Il braccio resta visibile anche a torcia spenta: chi la porta la
      // tiene comunque in mano, solo senza fiamma.
      torchViewmodel?.setVisible(true);
    },
    /**
     * Anima l'accensione: il braccio china la torcia verso i carboni del
     * braciere e risale. Da chiamare quando il giocatore accende al braciere.
     */
    playTorchIgnite(): void {
      torchViewmodel?.playIgnite();
    },
    setPlacedTorchState(state: RendererPlacedTorchState | null): void {
      if (!state) {
        placedTorchMesh.visible = false;
        if (placedTorchGlb) placedTorchGlb.visible = false;
        placedTorchLight.visible = false;
        if (placedFlame) placedFlame.group.visible = false;
        return;
      }
      // Se il GLB KayKit è caricato lo usa; altrimenti il cilindro placeholder.
      if (placedTorchGlb) {
        placedTorchGlb.visible = true;
        placedTorchGlb.position.set(state.x, state.y, state.z);
        placedTorchMesh.visible = false;
      } else {
        placedTorchMesh.visible = true;
        placedTorchMesh.position.set(state.x, state.y + 0.38, state.z);
      }
      placedTorchLight.visible = true;
      placedTorchLight.position.set(state.x, state.y + 0.72, state.z);
      if (placedFlame) {
        placedFlame.group.visible = true;
        placedFlame.group.position.set(state.x, state.y + 0.62, state.z);
      }
    },
    setBrazierStates(states: readonly RendererBrazierState[]): void {
      for (const state of states) {
        const light = brazierLights.get(state.brazierId);
        const material = brazierMaterials.get(state.brazierId);
        if (light) {
          light.position.set(state.x, state.y + 0.72, state.z);
          light.visible = state.lit;
          light.intensity = state.lit ? (state.refillUsed ? 7 : 12) : 0;
        }
        if (material) {
          material.emissiveIntensity = state.lit ? (state.refillUsed ? 0.7 : 1.05) : 0.22;
        }
      }
    },
    setCameraPose,
    interactDoor,
    applyPresentation,
    addCameraShake,
    setDangerTell,
    /** G-15: burst di scintille in posizione (es. colpo critico, scavo). */
    emitSparks(position: { x: number; y: number; z: number }, color = 0xffd27a, count = 18): void {
      if (!sparkBurst) return;
      sparkBurst.emit(new THREE.Vector3(position.x, position.y, position.z), color, count);
    },
    /** G-15 V2: trail a falce sul colpo corpo-a-corpo. */
    playWeaponTrail(position: { x: number; y: number; z: number }, yaw: number): void {
      if (!weaponTrail) return;
      weaponTrail.slash(position, yaw);
    },
    /** Viewmodel arma 3D: fendente (attacco). */
    playWeaponSwing(): void {
      weaponViewmodel?.playSwing();
    },
    /** Viewmodel arma 3D: guardia alzata (parata). */
    playWeaponParry(): void {
      weaponViewmodel?.playParry();
    },
    /** C-02: registra il frame callback via Three.js setAnimationLoop. */
    setAnimationLoop(callback: ((timeMs: number) => void) | null): void {
      if (disposed) return;
      if ('setAnimationLoop' in renderer && typeof renderer.setAnimationLoop === 'function') {
        void renderer.setAnimationLoop(
          callback
            ? (time: number) => {
                callback(time);
              }
            : null,
        );
      }
    },

    isXrActive(): boolean {
      return xrActive;
    },

    /**
     * C-02: avvia una sessione immersive-vr. Richiede WebGL2.
     * Il loop deve già usare setAnimationLoop affinché XR presenti i frame.
     */
    async enableXr(session: unknown): Promise<boolean> {
      if (disposed) return false;
      if (backend !== 'webgl2') {
        log.warn('WebXR richiede backend WebGL2');
        return false;
      }
      const gl = renderer as THREE.WebGLRenderer;
      gl.xr.enabled = true;
      try {
        await gl.xr.setSession(session as XRSession);
        xrActive = true;
        const xrSession = session as XRSession;
        const handleEnd = (): void => {
          xrActive = false;
          gl.xr.enabled = false;
          onXrSessionEnd?.();
        };
        xrSession.addEventListener('end', handleEnd);
        log.info('WebXR: sessione immersiva collegata al renderer');
        return true;
      } catch (error) {
        gl.xr.enabled = false;
        xrActive = false;
        log.warn('WebXR setSession fallito', { error: String(error) });
        return false;
      }
    },

    disableXr(): void {
      if (!xrActive) return;
      const gl = renderer as THREE.WebGLRenderer;
      const active = gl.xr.getSession();
      xrActive = false;
      gl.xr.enabled = false;
      void active?.end();
    },

    /** Viewmodel arma 3D: mostra/nascondi (cambio arma). */
    setWeaponViewmodelVisible(visible: boolean): void {
      weaponViewmodel?.setVisible(visible);
    },
    /**
     * Mostra il viewmodel dell'arma indicata e nasconde gli altri.
     * Sostituisce l'uso di setWeaponViewmodelVisible(false) per le armi
     * diverse dal khopesh, che lasciava le mani vuote.
     */
    setActiveWeaponViewmodel(weaponId: string): void {
      const next = weaponViewmodels.get(weaponId);
      for (const [id, model] of weaponViewmodels) {
        model.setVisible(id === weaponId);
      }
      if (next) weaponViewmodel = next;
    },
    setEnemyStates,
    setEnemyState,
    setObjectiveState,
    setFloorLayout,
    applyFloorPalette,
    applyQualityProfile,
    setLootReliquary,
    setShovelPickup,
    getDebugStats,
    resize,
    dispose,
    /** W-7: imposta l'intensità dell'effetto sandstorm (0 = off, 1 = piena). */
    setSandStormIntensity(value: number): void {
      sandStormController?.setIntensity(value);
    },
  };
}
