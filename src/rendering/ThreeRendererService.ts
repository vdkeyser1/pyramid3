/**
 * Scopo: implementazione Three.js del servizio di rendering.
 * Ownership: RendererService.create() lo istanzia.
 *
 * Supporta WebGPU (preferito) e WebGL2 (fallback).
 */

import * as THREE from 'three';
import type { WebGPURenderer as ThreeWebGPURenderer } from 'three/webgpu';
import type {
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
  createDissolveMaterial,
  createHieroglyphTexture,
  createHieroglyphPanelTexture,
  createSandTexture,
  loadPbrTextureSet,
} from '@/rendering/Materials.js';
import { createLogger } from '@/core/Logger.js';
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
  let placedFlame: { group: THREE.Group; update(deltaMs: number, intensity: number): void; setFlickerReduced(reduced: boolean): void } | null = null;
  // V6: god ray della torcia accesa — cono additivo che segue la camera.
  let torchBeam: { mesh: THREE.Mesh; material: THREE.MeshBasicMaterial } | null = null;
  let sparkBurst: ParticleBurst | null = null;
  // G-15 V2: trail a falce per i colpi corpo-a-corpo.
  let weaponTrail: { mesh: THREE.Mesh; slash(position: { readonly x: number; readonly y: number; readonly z: number }, yaw: number): void; update(deltaMs: number): boolean } | null = null;
  let weaponViewmodel: {
    group: THREE.Group;
    setVisible(visible: boolean): void;
    playSwing(): void;
    playParry(): void;
    update(deltaMs: number): void;
  } | null = null;
  let envMapTexture: THREE.Texture | null = null;
  let ambientLight: THREE.AmbientLight;
  let hemiLight: THREE.HemisphereLight;
  let floorMaterial: THREE.MeshStandardMaterial;
  let wallMaterial: THREE.MeshStandardMaterial;
  let doorMaterial: THREE.MeshStandardMaterial;
  let enemyMaterial: THREE.MeshStandardMaterial;
  let exitBeaconMaterial: THREE.MeshStandardMaterial;
  let placedTorchMaterial: THREE.MeshStandardMaterial;
  let digSiteMaterial: THREE.MeshStandardMaterial;
  let digSiteMarker: THREE.Mesh | null = null;
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
  }[] = [];
  let exitBeacon: THREE.Mesh | null = null;
  let exitBeaconLight: THREE.PointLight | null = null;
  /** Materiale dei glifi sul pavimento — animato nel render loop (pulsazione emissiva). */
  let decorGlyphMaterial: THREE.MeshStandardMaterial | null = null;
  let disposed = false;
  let initialized = false;
  let activeFloorLayout: FloorSceneLayout | null = null;
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
          scene.environmentIntensity = 0.45;
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
      renderer.toneMappingExposure = 1.2;
      renderer.outputColorSpace = THREE.SRGBColorSpace;
    }

    if ('init' in renderer && typeof renderer.init === 'function') {
      await renderer.init();
    }

    renderer.setPixelRatio(window.devicePixelRatio);
    renderer.setSize(canvas.clientWidth, canvas.clientHeight);

    scene = new THREE.Scene();
    scene.background = new THREE.Color(0x0b0908);
    scene.fog = new THREE.FogExp2(0x0b0908, 0.0008);

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
        scene.environmentIntensity = 0.55;
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

    ambientLight = new THREE.AmbientLight(0xffddbb, 0.6);
    scene.add(ambientLight);

    hemiLight = new THREE.HemisphereLight(0x88ccff, 0x442200, 0.5);
    scene.add(hemiLight);

    // G-18 V2: torcia con halo ampio da "vera fiamma" — SpotLight calda con
    // penombra morbida + PointLight ambientale secondaria (l'alone che illumina
    // la stanza intorno al giocatore).
    torchLight = new THREE.SpotLight(0xffb45e, 100, 45, Math.PI / 3.2, 0.85, 0.6);
    torchLight.visible = false;
    torchLight.position.copy(camera.position);
    torchLight.castShadow = true;
    torchLight.shadow.mapSize.set(1024, 1024);
    torchLight.shadow.camera.near = 0.3;
    torchLight.shadow.camera.far = 45;
    torchLight.shadow.bias = -0.0002;
    scene.add(torchLight);
    scene.add(torchLight.target);

    torchAmbientLight = new THREE.PointLight(0xff9a3c, 0, 9, 1.7);
    torchAmbientLight.visible = false;
    scene.add(torchAmbientLight);

    placedTorchLight = new THREE.PointLight(0xd78e38, 16, 11, 2);
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
    // Pavimento: lastre di pietra egizia (Poly Haven stone_floor CC0, 512px).
    // Fallback: sabbia procedurale se il file manca.
    const floorPbr = loadPbrTextureSet(
      'textures/stone_floor_color.ktx2',
      'textures/stone_floor_normal.ktx2',
      5, 5,
      'textures/stone_floor_roughness.ktx2',
      'textures/stone_floor_ao.ktx2',
      glRenderer,
    );
    if (floorPbr.color) {
      floorMaterial.map = floorPbr.color;
      if (floorPbr.normal) {
        floorMaterial.normalMap = floorPbr.normal;
        floorMaterial.normalScale.set(0.5, 0.5);
      }
      if (floorPbr.roughness) floorMaterial.roughnessMap = floorPbr.roughness;
      if (floorPbr.ao) {
        floorMaterial.aoMap = floorPbr.ao;
        floorMaterial.aoMapIntensity = 0.65;
      }
      floorMaterial.color.setHex(0xffffff);
      floorMaterial.roughness = 0.88;
    } else {
      // fallback sabbia procedurale
      const sandPbr = loadPbrTextureSet(
        'textures/sand_color.ktx2', 'textures/sand_normalgl.ktx2', 6, 6,
        'textures/sand_roughness.ktx2', 'textures/sand_ambientocclusion.ktx2',
        glRenderer,
      );
      if (sandPbr.color) {
        floorMaterial.map = sandPbr.color;
        if (sandPbr.normal) { floorMaterial.normalMap = sandPbr.normal; floorMaterial.normalScale.set(0.6, 0.6); }
        if (sandPbr.roughness) floorMaterial.roughnessMap = sandPbr.roughness;
        if (sandPbr.ao) { floorMaterial.aoMap = sandPbr.ao; floorMaterial.aoMapIntensity = 0.7; }
        floorMaterial.color.setHex(0xffffff);
      } else {
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
    // Muri: arenaria sabbiosa egizia (Poly Haven sandstone_brick_wall_01 CC0, 512px).
    // Per i livelli profondi (floorIndex >= 5) si usa old_sandstone_02 (più scura).
    const wallPbr = loadPbrTextureSet(
      'textures/sandstone_wall_color.ktx2',
      'textures/sandstone_wall_normal.ktx2',
      4, 3,
      'textures/sandstone_wall_roughness.ktx2',
      'textures/sandstone_wall_ao.ktx2',
      glRenderer,
    );
    if (wallPbr.color) {
      wallMaterial.map = wallPbr.color;
      if (wallPbr.normal) {
        wallMaterial.normalMap = wallPbr.normal;
        wallMaterial.normalScale.set(0.85, 0.85);
      }
      if (wallPbr.roughness) wallMaterial.roughnessMap = wallPbr.roughness;
      if (wallPbr.ao) {
        wallMaterial.aoMap = wallPbr.ao;
        wallMaterial.aoMapIntensity = 0.80;
      }
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
    camera.add(hand.group);
    hand.group.position.set(0.42, -0.34, -0.55);
    handFlame = hand;
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
      const { createKhopeshViewmodel } = await import('@/rendering/WeaponViewmodel.js');
      const viewmodel = createKhopeshViewmodel();
      viewmodel.setVisible(true);
      camera.add(viewmodel.group);
      weaponViewmodel = viewmodel;
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

  function setFloorLayout(layout: FloorSceneLayout | null): void {
    activeFloorLayout = layout;
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
    scene.fog = new THREE.FogExp2(0x0b0908, 0.0008 + darkness * 0.0016);
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
    torchLight.shadow.camera.far = profile.tier === 'low' ? 30 : 45;
    placedTorchLight.shadow.mapSize.set(Math.min(512, shadowSize), Math.min(512, shadowSize));

    // Bloom (solo WebGL2): off su low, ridotto su medium
    if (bloomPass) {
      const strength = profile.usePostFx
        ? (profile.tier === 'medium' ? 0.38 : 0.55)
        : 0;
      bloomPass.strength = strength;
      if (composer) {
        composer.setSize(canvas.clientWidth, canvas.clientHeight);
      }
    }

    // SSAO/bloom (solo WebGL2): il profilo low salta il composer in render()
    // (SSAOPass non ha un toggle runtime semplice e ri-crearlo è costoso).
    _qualityWantsPostFx = profile.usePostFx;
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
    const goldMaterial = new THREE.MeshStandardMaterial({
      color: 0xd4a05a,
      roughness: 0.35,
      metalness: 0.85,
      emissive: 0x4a2f00,
      emissiveIntensity: 0.6,
    });
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

    const group = new THREE.Group();
    const mat = new THREE.MeshStandardMaterial({
      color: 0xc89030,
      roughness: 0.4,
      metalness: 0.7,
      emissive: 0x6a3a00,
      emissiveIntensity: 0.5,
    });
    // Manico orizzontale
    const handle = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.08, 0.55), mat);
    handle.position.y = 0.04;
    // Testa della pala
    const blade = new THREE.Mesh(new THREE.BoxGeometry(0.26, 0.06, 0.18), mat);
    blade.position.set(0, 0.04, 0.3);
    group.add(handle, blade);

    // Bagliore a terra
    const glowMat = new THREE.MeshBasicMaterial({
      color: 0xffd060,
      transparent: true,
      opacity: 0.28,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    });
    const glow = new THREE.Mesh(new THREE.CircleGeometry(0.38, 16), glowMat);
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
  async function placeKayKitRoomProps(layout: FloorSceneLayout, root: THREE.Group): Promise<void> {
    const { loadArtifact } = await import('@/rendering/ArtifactLoader.js');
    const { getArtifactsBySource, getArtifactById } = await import('@/content/ArtifactRegistry.js');
    const kayKitDefs = getArtifactsBySource('kaykit');
    const columnDef = kayKitDefs.find((d) => d.id === 'column_kaykit');
    const pillarDef = kayKitDefs.find((d) => d.id === 'pillar_decorated');
    const ruinsColumnDef = getArtifactById('ruins_column');
    if (!columnDef && !pillarDef && !ruinsColumnDef) return;

    for (const room of layout.rooms) {
      const { minX, maxX, minZ, maxZ } = room.bounds;
      const w = maxX - minX;
      const d = maxZ - minZ;
      if (w < 8 || d < 8) continue;

      const cx = (minX + maxX) / 2;
      const cz = (minZ + maxZ) / 2;
      const halfW = w / 2 - 1.2;
      const halfD = d / 2 - 1.2;

      // 4 angoli della stanza — 1 colonna o pilastro per angolo.
      // Stanze grandi: KayKit (più elaborate). Stanze medie: Kenney ruins.
      const isLarge = w >= 10 && d >= 10;
      const corners = [
        { x: cx - halfW, z: cz - halfD },
        { x: cx + halfW, z: cz - halfD },
        { x: cx - halfW, z: cz + halfD },
        { x: cx + halfW, z: cz + halfD },
      ];

      for (let i = 0; i < corners.length; i++) {
        const def = isLarge
          ? (i % 2 === 0 ? (columnDef ?? pillarDef) : (pillarDef ?? columnDef))
          : ruinsColumnDef;
        if (!def) continue;
        const prop = await loadArtifact(def);
        if (!prop || disposed) return;
        const corner = corners[i];
        if (!corner) continue;
        prop.position.set(corner.x, 0, corner.z);
        root.add(prop);
      }
    }
  }

  async function rebuildFloorLayout(layout: FloorSceneLayout): Promise<void> {
    // Swap texture muri: arenaria chiara nei livelli bassi, scura in cripta.
    const useDeepWall = layout.floorIndex >= 5;
    const wPbr = loadPbrTextureSet(
      useDeepWall ? 'textures/sandstone_dark_color.ktx2' : 'textures/sandstone_wall_color.ktx2',
      useDeepWall ? 'textures/sandstone_dark_normal.ktx2' : 'textures/sandstone_wall_normal.ktx2',
      4, 3,
      useDeepWall ? 'textures/sandstone_dark_roughness.ktx2' : 'textures/sandstone_wall_roughness.ktx2',
      useDeepWall ? 'textures/sandstone_dark_ao.ktx2' : 'textures/sandstone_wall_ao.ktx2',
      backend === 'webgl2' ? renderer as THREE.WebGLRenderer : undefined,
    );
    if (wPbr.color) {
      wallMaterial.map = wPbr.color;
      wallMaterial.normalMap = wPbr.normal ?? null;
      if (wPbr.normal) wallMaterial.normalScale.set(0.85, 0.85);
      wallMaterial.roughnessMap = wPbr.roughness ?? null;
      wallMaterial.aoMap = wPbr.ao ?? null;
      if (wPbr.ao) wallMaterial.aoMapIntensity = 0.80;
      wallMaterial.needsUpdate = true;
    }

    dungeonRoot.clear();
    brazierRoot.clear();
    brazierLights.clear();
    brazierMaterials.clear();
    digSiteMarker = null;
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
    const roomBounds = buildDungeonLayout?.({
      layout,
      dungeonRoot,
      floorMaterial,
      wallMaterial,
      createStaticBox,
      glyphEmissiveMap: glyphTexture,
      glyphColorMap,
    }) ?? [];
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

    // W-5 / task-9: piazza props GLB KayKit nelle stanze grandi.
    void placeKayKitRoomProps(layout, dungeonRoot);

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

    for (const brazier of layout.braziers) {
      const brazierMaterial = new THREE.MeshStandardMaterial({
        color: 0x6a4726,
        emissive: 0x220c02,
        emissiveIntensity: 0.22,
        roughness: 0.58,
        metalness: 0.2,
      });
      const bowl = new THREE.Mesh(
        new THREE.CylinderGeometry(0.34, 0.52, 0.38, 12),
        brazierMaterial,
      );
      bowl.position.set(brazier.position.x, brazier.position.y + 0.18, brazier.position.z);
      bowl.castShadow = true;
      bowl.receiveShadow = true;
      brazierRoot.add(bowl);

      const light = new THREE.PointLight(0xff9b3d, 18, 10, 2);
      light.visible = false;
      light.position.set(brazier.position.x, brazier.position.y + 0.72, brazier.position.z);
      light.castShadow = true;
      light.shadow.mapSize.set(512, 512);
      light.shadow.bias = -0.0002;
      brazierRoot.add(light);

      brazierLights.set(brazier.brazierId, light);
      brazierMaterials.set(brazier.brazierId, brazierMaterial);
    }

    if (layout.digSite) {
      digSiteMarker = new THREE.Mesh(
        new THREE.CylinderGeometry(0.72, 0.92, 0.12, 18),
        digSiteMaterial,
      );
      digSiteMarker.position.set(layout.digSite.position.x, 0.06, layout.digSite.position.z);
      digSiteMarker.castShadow = false;
      digSiteMarker.receiveShadow = true;
      brazierRoot.add(digSiteMarker);
    }

    log.info('Layout floor applicato al renderer', {
      floorId: layout.floorId,
      rooms: layout.rooms.length,
      corridors: layout.corridors.length,
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
      torchLight.intensity = 85 * flicker;
      placedTorchLight.intensity = placedTorchLight.visible ? 14 * (0.92 + flicker * 0.16) : 0;

      // Alone caldo della fiamma: segue la camera, respira col flicker.
      torchAmbientLight.visible = true;
      torchAmbientLight.position.copy(camera.position);
      torchAmbientLight.intensity = 7.5 * (0.85 + flicker * 0.3);

      // G-15: animazione fiamme procedurali
      const litGain = presentation.reduceTorchFlicker ? 0.35 : 1.0;
      handFlame?.update(deltaMs, litGain);
      placedFlame?.update(deltaMs, litGain);
      weaponViewmodel?.update(deltaMs);

      // V6: god ray della torcia accesa — visibile e pulsante col flicker
      if (torchBeam) {
        torchBeam.mesh.visible = true;
        torchBeam.material.opacity = 0.05 + 0.05 * flicker;
      }
    } else {
      torchAmbientLight.visible = false;
      if (torchBeam) {
        torchBeam.mesh.visible = false;
      }
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

    // Occhio del Ladro: pulsazione del tell di pericolo sul sito di scavo.
    if (dangerTellActive && digSiteMarker) {
      const pulse = 1.4 + Math.sin(performance.now() * 0.006) * 0.6;
      digSiteMaterial.emissiveIntensity = pulse;
    }

    frustumCuller.update(camera);

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
    scene.fog = new THREE.FogExp2(backgroundColor, settings.assistedLight ? 0.00022 : 0.00055);
    ambientLight.intensity = settings.assistedLight ? 1.0 : 0.6;
    hemiLight.intensity = settings.assistedLight ? 0.8 : 0.5;
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

  function setEnemyStates(states: readonly RendererEnemyState[]): void {
    ensureEnemyVisualCount(states.length);

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
      const state = states[i];
      if (!state?.alive) {
        visual.mesh.visible = false;
        continue;
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
    _doorPhysics?.dispose();
    _doorPhysics = null;
    assetLoader = null;
    handFlame = null;
    placedFlame = null;
    sparkBurst = null;
    weaponTrail = null;
    weaponViewmodel = null;
    envMapTexture?.dispose();
    envMapTexture = null;
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
          light.intensity = state.lit ? (state.refillUsed ? 10 : 18) : 0;
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
    /** C-02: aggancia una sessione WebXR (probe sperimentale, try/catch). */
    enableXr(session: unknown): void {
      const xrRenderer = renderer as {
        xr?: { enabled: boolean; setSession(s: unknown): Promise<void> | void };
      };
      if (xrRenderer.xr) {
        xrRenderer.xr.enabled = true;
        try {
          void xrRenderer.xr.setSession(session);
        } catch (error) {
          log.warn('WebXR setSession fallito', { error: String(error) });
        }
      }
    },
    /** Viewmodel arma 3D: mostra/nascondi (cambio arma). */
    setWeaponViewmodelVisible(visible: boolean): void {
      weaponViewmodel?.setVisible(visible);
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
