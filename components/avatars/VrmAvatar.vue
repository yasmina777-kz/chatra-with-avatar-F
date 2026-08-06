<!--
  VrmAvatar.vue — 3D VRM-аватар преподавателя.
  Рендерится в браузере студента (three.js + @pixiv/three-vrm), сервер не нагружается.

  Установка зависимостей:
    npm install three @pixiv/three-vrm

  Использование:
    <VrmAvatar :vrm-url="avatarVrmUrl" :audio-el="audioEl" :speaking="isPlaying" />

  Липсинк: чередуем реальные Shape Keys модели (aa/ih/ou) по ритму речи —
  без перехвата <audio> через WebAudio (чтобы звук никогда не пропадал).
-->
<template>
  <div ref="hostEl" class="vrm-host">
    <div v-if="loading" class="vrm-loading">Загрузка аватара…</div>
    <div v-else-if="error" class="vrm-error">Не удалось загрузить 3D-аватар</div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, onBeforeUnmount } from 'vue'
import * as THREE from 'three'
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js'
import { VRMLoaderPlugin, VRMUtils } from '@pixiv/three-vrm'

const props = defineProps<{
  vrmUrl: string
  audioEl?: HTMLAudioElement | null   // элемент <audio>, под который открывается рот
  speaking?: boolean                  // идёт ли сейчас речь
  yOffset?: number                    // ручная поправка положения по вертикали (для конкретной модели)
}>()

const hostEl = ref<HTMLElement | null>(null)
const loading = ref(true)
const error = ref(false)

let renderer: THREE.WebGLRenderer | null = null
let scene: THREE.Scene | null = null
let camera: THREE.PerspectiveCamera | null = null
let vrm: any = null
let clock: THREE.Clock | null = null
let rafId = 0
let resizeObserver: ResizeObserver | null = null

// ── Липсинк ────────────────────────────────────────────────────────
// ВАЖНО: звук НЕ перехватывается через WebAudio — иначе браузер может
// заглушить <audio>. Рот двигается процедурно, пока идёт речь.
let blinkTimer = 0
let nextBlink = 2 + Math.random() * 3
let baseRotY = 0
let baseRotX = 0
let doubleBlink = false
let mouthEase = 0 // плавно подтягивается к цели — убирает резкие скачки рта
const lookTarget = new THREE.Vector3()
const lookObj = new THREE.Object3D()

// ── Случайная, неповторяющаяся "речь" вместо чистой синусоиды ──────
// Периодически выбираем новую случайную цель для открытия рта (с паузами —
// полным закрытием) и плавно тянемся к ней. Так движение не выглядит
// механически-периодичным, как у робота, и рот реально успевает закрываться.
let mouthTarget = 0
let mouthPickTimer = 0
let mouthPickInterval = 0.16
let currentViseme: 'aa' | 'ih' | 'ou' = 'aa'
let aaEase = 0
let ihEase = 0
let ouEase = 0

// ── Естественное, неповторяющееся движение головы ──────────────────
// Вместо чистых синусов (что выглядит как метроном/робот) — случайные
// цели поворота, к которым голова плавно "дрейфует", как у живого человека.
let headYawTarget = 0
let headPitchTarget = 0
let headRollTarget = 0
let headYawNow = 0
let headPitchNow = 0
let headRollNow = 0
let headPickTimer = 0
let headPickInterval = 2.2

function pickNewHeadTarget() {
  headYawTarget = (Math.random() - 0.5) * 0.22
  headPitchTarget = (Math.random() - 0.5) * 0.10
  headRollTarget = (Math.random() - 0.5) * 0.06
  headPickInterval = 1.6 + Math.random() * 2.2
}

function pickNewMouthTarget() {
  const r = Math.random()
  if (r < 0.22) {
    mouthTarget = 0            // "смычка"/пауза — рот на мгновение закрыт
  } else if (r < 0.4) {
    mouthTarget = 0.25 + Math.random() * 0.25   // лёгкое приоткрытие
  } else {
    mouthTarget = 0.6 + Math.random() * 0.4     // полноценный гласный звук
  }
  // выбираем, какая форма рта сейчас "звучит" — реально разные гласные,
  // а не одна и та же форма A с небольшой примесью
  const vr = Math.random()
  currentViseme = vr < 0.45 ? 'aa' : vr < 0.72 ? 'ih' : 'ou'
  mouthPickInterval = 0.12 + Math.random() * 0.15
}

async function init() {
  if (!hostEl.value) return
  const host = hostEl.value
  const w = host.clientWidth || 300
  const h = host.clientHeight || 300

  renderer = new THREE.WebGLRenderer({
    antialias: true,
    alpha: true,
    powerPreference: 'high-performance',
  })
  renderer.setSize(w, h)
  // до 3x — заметно чётче на ретине и при крупном показе
  renderer.setPixelRatio(Math.min(window.devicePixelRatio * 1.5, 3))
  renderer.outputColorSpace = THREE.SRGBColorSpace
  renderer.toneMapping = THREE.ACESFilmicToneMapping
  renderer.toneMappingExposure = 1.05
  host.appendChild(renderer.domElement)

  scene = new THREE.Scene()
  camera = new THREE.PerspectiveCamera(30, w / h, 0.1, 20)

  scene.add(new THREE.AmbientLight(0xffffff, 1.1))
  const key = new THREE.DirectionalLight(0xfff6ec, 1.9)
  key.position.set(1.2, 1.8, 2.6)
  scene.add(key)
  const fill = new THREE.DirectionalLight(0xdce9ff, 0.7)
  fill.position.set(-1.8, 0.4, 1.4)
  scene.add(fill)
  const rim = new THREE.DirectionalLight(0xffffff, 0.9)
  rim.position.set(-0.4, 1.2, -2.2)
  scene.add(rim)

  clock = new THREE.Clock()

  const loader = new GLTFLoader()
  loader.register((parser) => new VRMLoaderPlugin(parser))

  try {
    const gltf = await loader.loadAsync(props.vrmUrl)
    vrm = gltf.userData.vrm
    VRMUtils.removeUnnecessaryJoints(gltf.scene)
    VRMUtils.rotateVRM0(vrm) // разворачивает модели VRM 0.x лицом к камере

    scene.add(vrm.scene)
    baseRotY = vrm.scene.rotation.y
    baseRotX = vrm.scene.rotation.x
    console.info('VRM: кость head', vrm.humanoid?.getNormalizedBoneNode('head') ? 'найдена' : 'НЕ найдена — качаем модель целиком')

    // ── Камера: вписываем всю модель в кадр ───────────────────────────
    vrm.scene.updateMatrixWorld(true)
    const box = new THREE.Box3().setFromObject(vrm.scene)
    const size = box.getSize(new THREE.Vector3())
    const center = box.getCenter(new THREE.Vector3())

    // радиус описывающей сферы модели
    const radius = Math.max(size.x, size.y, size.z) * 0.5 || 0.5
    const fovRad = (camera.fov * Math.PI) / 180
    // FIT_MARGIN: больше значение — камера дальше (модель мельче)
    const FIT_MARGIN = 1.15
    const distance = (radius / Math.sin(fovRad / 2)) * FIT_MARGIN

    // ручная поправка по вертикали для конкретной модели (если задана)
    const yAdj = (props.yOffset ?? 0) * size.y
    center.y += yAdj

    camera.near = Math.max(0.01, distance - radius * 3)
    camera.far = distance + radius * 10
    camera.position.set(center.x, center.y, center.z + distance)
    camera.lookAt(center)
    camera.updateProjectionMatrix()

    loading.value = false
  } catch (e) {
    console.error('VRM load error:', e)
    error.value = true
    loading.value = false
    return
  }

  resizeObserver = new ResizeObserver(() => {
    if (!renderer || !camera || !hostEl.value) return
    const nw = hostEl.value.clientWidth || 1
    const nh = hostEl.value.clientHeight || 1
    renderer.setSize(nw, nh)
    camera.aspect = nw / nh
    camera.updateProjectionMatrix()
  })
  resizeObserver.observe(host)

  animate()
}

function animate() {
  rafId = requestAnimationFrame(animate)
  if (!renderer || !scene || !camera || !clock) return
  const dt = clock.getDelta()

  if (vrm) {
    const em = vrm.expressionManager
    const t = clock.elapsedTime

    // ── Речь: чередуем реальные формы рта + лёгкая мимика
    if (em) {
      const talking = !!props.speaking

      if (talking) {
        mouthPickTimer += dt
        if (mouthPickTimer > mouthPickInterval) {
          mouthPickTimer = 0
          pickNewMouthTarget()
        }
      } else {
        mouthTarget = 0
        mouthPickTimer = 0
      }

      // Плавно тянемся к случайно выбранной цели — быстрее к открытому,
      // чуть медленнее к закрытому, для естественности.
      const easeSpeed = mouthTarget > mouthEase ? 14 : 9
      mouthEase += (mouthTarget - mouthEase) * Math.min(1, dt * easeSpeed)
      const boosted = mouthEase

      // Плавно смешиваем формы рта синусами разной фазы — без резких порогов,
      // поэтому переход выглядит как естественная артикуляция, а не переключатель.
      // aa — главная форма, идёт на полную амплитуду без искусственного потолка
      // Каждая гласная плавно "включается", когда она текущая, и плавно
      // "выключается", когда очередь переходит к другой — форма рта реально
      // меняется (A / I / U), а не всегда одна и та же с примесью.
      const visemeEaseSpeed = 10
      const aaGoal = currentViseme === 'aa' ? boosted : 0
      const ihGoal = currentViseme === 'ih' ? boosted : 0
      const ouGoal = currentViseme === 'ou' ? boosted : 0
      aaEase += (aaGoal - aaEase) * Math.min(1, dt * visemeEaseSpeed)
      ihEase += (ihGoal - ihEase) * Math.min(1, dt * visemeEaseSpeed)
      ouEase += (ouGoal - ouEase) * Math.min(1, dt * visemeEaseSpeed)

      em.setValue('aa', aaEase)
      em.setValue('ih', ihEase)
      em.setValue('ou', ouEase)
      em.setValue('ee', 0)

      // едва заметная улыбка, слегка «дышит» во время речи
      em.setValue('happy', talking ? 0.10 + Math.sin(t * 0.7) * 0.06 : 0.06)

      // ── Моргание: иногда двойное, как у людей
      blinkTimer += dt
      if (blinkTimer > nextBlink) {
        const p = blinkTimer - nextBlink
        const single = (x: number) => (x < 0.06 ? x / 0.06 : x < 0.14 ? 1 - (x - 0.06) / 0.08 : 0)
        const blink = doubleBlink
          ? Math.max(single(p), single(p - 0.22))
          : single(p)
        em.setValue('blink', Math.min(1, blink))
        const done = doubleBlink ? 0.4 : 0.16
        if (p > done) {
          blinkTimer = 0
          nextBlink = 1.8 + Math.random() * 3.5
          doubleBlink = Math.random() < 0.25
        }
      }
    }

    // ── Движения: голова + корпус + «дыхание» — случайный дрейф, не метроном
    headPickTimer += dt
    if (headPickTimer > headPickInterval) {
      headPickTimer = 0
      pickNewHeadTarget()
    }
    // во время речи голова чуть активнее "живёт"
    const headEase = props.speaking ? 2.2 : 1.3
    headYawNow += (headYawTarget - headYawNow) * Math.min(1, dt * headEase)
    headPitchNow += (headPitchTarget - headPitchNow) * Math.min(1, dt * headEase)
    headRollNow += (headRollTarget - headRollNow) * Math.min(1, dt * headEase)

    const yaw = headYawNow
    const pitch = headPitchNow
    const roll = headRollNow
    // лёгкий кивок только пока говорит — тоже завязан на случайный дрейф mouthEase,
    // а не на жёсткий синус, поэтому не выглядит метрономом
    const nod = props.speaking ? mouthEase * 0.05 : 0
    // "дыхание" — медленный, едва заметный синус остаётся уместным (это и должно
    // быть мягко-периодичным, как настоящее дыхание)
    const breath = Math.sin(t * 1.15) * 0.012

    const head = vrm.humanoid?.getNormalizedBoneNode('head')
    const chest = vrm.humanoid?.getNormalizedBoneNode('chest')
      || vrm.humanoid?.getNormalizedBoneNode('spine')

    if (head) {
      head.rotation.y = yaw
      head.rotation.x = pitch + nod
      head.rotation.z = roll
    } else if (vrm.scene) {
      vrm.scene.rotation.y = baseRotY + yaw
      vrm.scene.rotation.x = baseRotX + pitch + nod
      vrm.scene.rotation.z = roll
    }

    if (chest) {
      chest.rotation.y = yaw * 0.28
      chest.rotation.x = breath
    } else if (vrm.scene) {
      vrm.scene.position.y = breath * 0.6
    }

    // взгляд следует за поворотом головы
    if (vrm.lookAt) {
      lookTarget.set(Math.sin(t * 0.33) * 0.25, 0.02, 1)
      vrm.lookAt.target = lookObj
      lookObj.position.copy(lookTarget).add(camera.position)
    }

    vrm.update(dt)
  }

  renderer.render(scene, camera)
}

onMounted(init)

onBeforeUnmount(() => {
  cancelAnimationFrame(rafId)
  resizeObserver?.disconnect()
  if (vrm) VRMUtils.deepDispose(vrm.scene)
  renderer?.dispose()
})
</script>

<style scoped>
.vrm-host { width: 100%; height: 100%; position: relative; }
.vrm-host :deep(canvas) { display: block; width: 100% !important; height: 100% !important; }
.vrm-loading, .vrm-error {
  position: absolute; inset: 0; display: flex; align-items: center; justify-content: center;
  font-size: 11px; color: var(--text4); text-align: center; padding: 8px;
}
</style>