<template>
  <div class="player-overlay" @click.self="$emit('close')">
    <div class="player-sheet anim-scale">
      <div class="player-head">
        <div class="ph-title-block">
          <div class="ph-title">{{ lecture.title }}</div>
          <div class="ph-sub">Слайд {{ currentIndex + 1 }} из {{ lecture.slides.length }}</div>
        </div>
        <div class="ph-actions">
          <button v-if="canDelete" class="btn-del" title="Удалить лекцию" :disabled="deleting" @click="removeLecture">
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <polyline points="3 6 5 6 21 6"/>
              <path d="M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6m3 0V4a2 2 0 012-2h4a2 2 0 012 2v2"/>
            </svg>
          </button>
          <button class="btn btn-icon btn-ghost" @click="$emit('close')">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M18 6L6 18M6 6l12 12"/></svg>
          </button>
        </div>
      </div>

      <div v-if="!showSummary" class="stage">
        <div class="slide-area" ref="slideAreaEl" :class="{ 'is-fullscreen': isFullscreen }">
          <!-- Приветствие / прощание: аватар крупно на всю область -->
          <video
            v-if="showAvatarVideo"
            ref="introVideoEl"
            :key="currentVideoUrl || ''"
            :src="currentVideoUrl || undefined"
            class="stage-video"
            playsinline
            muted
            @ended="onIntroVideoEnded"
          />
          <img v-else-if="currentSlide?.slide_image_url" :src="currentSlide.slide_image_url" class="slide-img" />
          <div v-else class="slide-placeholder">
            <div class="slide-placeholder-text">Слайд готовится...</div>
          </div>

          <button class="fullscreen-btn" @click="toggleFullscreen" :title="isFullscreen ? 'Выйти из полноэкранного режима' : 'На весь экран'">
            <svg v-if="!isFullscreen" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M8 3H5a2 2 0 00-2 2v3m18 0V5a2 2 0 00-2-2h-3m0 18h3a2 2 0 002-2v-3M3 16v3a2 2 0 002 2h3"/></svg>
            <svg v-else width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M8 3v3a2 2 0 01-2 2H3m18 0h-3a2 2 0 01-2-2V3m0 18v-3a2 2 0 012-2h3M3 16h3a2 2 0 012 2v3"/></svg>
          </button>

          <div v-if="!showAvatarVideo" class="avatar-corner" :class="{ talking: isPlaying }">
            <!-- 3D VRM-аватар (говорит всю лекцию, рендер в браузере) -->
            <div v-if="vrmUrl" class="avatar-vrm-wrap">
              <VrmAvatar :vrm-url="vrmUrl" :audio-el="audioEl" :speaking="isPlaying" />
            </div>
            <!-- 3D Avatar canvas -->
            <canvas v-else-if="is3DAvatar" ref="avatarCanvasEl" class="avatar-canvas"></canvas>
            <!-- Статичное фото преподавателя -->
            <div v-else class="avatar-wobble">
              <img v-if="photoUrl" :src="photoUrl" class="avatar-media avatar-photo" />
              <div v-else class="avatar-fallback">👨‍🏫</div>
            </div>

            <div class="speech-indicator" v-if="isPlaying">
              <span></span><span></span><span></span><span></span><span></span>
            </div>
          </div>

          <div v-if="isFullscreen" class="fs-overlay-controls">
            <div class="fs-progress-row">
              <div v-for="(s, i) in lecture.slides" :key="s.id" class="progress-seg fs-seg">
                <div class="progress-fill" :style="{ width: i === currentIndex ? slideProgressPct + '%' : (i < currentIndex ? '100%' : '0%') }"></div>
              </div>
            </div>
            <div class="fs-controls-row">
              <button class="ctrl-btn" :disabled="currentIndex === 0" @click="prevSlide">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polygon points="19 20 9 12 19 4 19 20"/><line x1="5" y1="19" x2="5" y2="5"/></svg>
              </button>
              <button class="ctrl-btn ctrl-main" @click="togglePlay">
                <svg v-if="!isPlaying" width="22" height="22" viewBox="0 0 24 24" fill="currentColor"><polygon points="5 3 19 12 5 21 5 3"/></svg>
                <svg v-else width="20" height="20" viewBox="0 0 24 24" fill="currentColor"><rect x="6" y="4" width="4" height="16"/><rect x="14" y="4" width="4" height="16"/></svg>
              </button>
              <button class="ctrl-btn" :disabled="currentIndex >= lecture.slides.length - 1" @click="nextSlide">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polygon points="5 4 15 12 5 20 5 4"/><line x1="19" y1="5" x2="19" y2="19"/></svg>
              </button>
            </div>
          </div>
        </div>

        <!-- Аудио слайдов. На слайде с говорящим видео звук идёт из видео, поэтому аудио отключаем. -->
        <audio
          ref="audioEl"
          :src="currentSlide?.audio_url || undefined"
          @ended="onAudioEnded"
          @timeupdate="onTimeUpdate"
          @loadedmetadata="onLoadedMeta"
        />

        <div class="progress-row">
          <div
            v-for="(s, i) in lecture.slides"
            :key="s.id"
            class="progress-seg"
          >
            <div class="progress-fill" :style="{ width: i === currentIndex ? slideProgressPct + '%' : (i < currentIndex ? '100%' : '0%') }"></div>
          </div>
        </div>

        <div v-if="currentSlide?.narration_text" class="narration-box">{{ currentSlide.narration_text }}</div>

        <div class="controls-row">
          <button class="ctrl-btn" :disabled="currentIndex === 0" @click="prevSlide">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polygon points="19 20 9 12 19 4 19 20"/><line x1="5" y1="19" x2="5" y2="5"/></svg>
          </button>
          <button class="ctrl-btn ctrl-main" @click="togglePlay">
            <svg v-if="!isPlaying" width="22" height="22" viewBox="0 0 24 24" fill="currentColor"><polygon points="5 3 19 12 5 21 5 3"/></svg>
            <svg v-else width="20" height="20" viewBox="0 0 24 24" fill="currentColor"><rect x="6" y="4" width="4" height="16"/><rect x="14" y="4" width="4" height="16"/></svg>
          </button>
          <button class="ctrl-btn" :disabled="currentIndex >= lecture.slides.length - 1" @click="nextSlide">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polygon points="5 4 15 12 5 20 5 4"/><line x1="19" y1="5" x2="19" y2="19"/></svg>
          </button>
          <button v-if="lecture.summary_text" class="ctrl-btn ctrl-summary" @click="showSummary = true">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="9" y1="13" x2="15" y2="13"/><line x1="9" y1="17" x2="15" y2="17"/></svg>
            Конспект
          </button>
        </div>
      </div>

      <div v-else class="summary-stage">
        <div class="summary-head-row">
          <button class="back-to-lecture" @click="showSummary = false">
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M19 12H5M12 19l-7-7 7-7"/></svg>
            Вернуться к лекции
          </button>
        </div>
        <div class="summary-body" v-html="renderedSummary"></div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, watch, onMounted, onBeforeUnmount, nextTick } from 'vue'
import type { AvatarLectureFull } from '~/services/avatars'
import { useAvatarsSvc } from '~/services/avatars'
import { useToast } from '~/composables/useToast'
import VrmAvatar from './VrmAvatar.vue'

const avatarsSvc = useAvatarsSvc()
const toast = useToast()

const props = defineProps<{
  lecture: AvatarLectureFull
  avatarPhotoUrl?: string | null
  avatarVrmUrl?: string | null // ссылка на 3D-модель .vrm (avatar.voice_sample_url)
  canDelete?: boolean          // передай true для автора лекции/админа
}>()
const emit = defineEmits<{ close: []; deleted: [id: number] }>()

const deleting = ref(false)
const removeLecture = async () => {
  if (!confirm(`Удалить лекцию «${props.lecture.title}»? Это действие необратимо.`)) return
  deleting.value = true
  try {
    await avatarsSvc.deleteLecture(props.lecture.id)
    toast.ok('Лекция удалена')
    emit('deleted', props.lecture.id)
    emit('close')
  } catch (e: any) {
    toast.err(e?.response?.data?.detail || 'Не удалось удалить лекцию')
  } finally {
    deleting.value = false
  }
}

const currentIndex = ref(0)
const isPlaying = ref(false)
const showSummary = ref(false)
const audioEl = ref<HTMLAudioElement | null>(null)
const introVideoEl = ref<HTMLVideoElement | null>(null)
const slideAreaEl = ref<HTMLElement | null>(null)
const avatarCanvasEl = ref<HTMLCanvasElement | null>(null)
const slideProgressPct = ref(0)
const isFullscreen = ref(false)

const lastIndex = computed(() => props.lecture.slides.length - 1)

// Ссылки на медиа аватара: сначала проп, иначе — то, что пришло вместе с лекцией
const vrmUrl = computed(() => props.avatarVrmUrl || (props.lecture as any).avatar_vrm_url || null)
const photoUrl = computed(() => props.avatarPhotoUrl || (props.lecture as any).avatar_photo_url || null)

// Какое говорящее видео показывать на текущем слайде (вступление / концовка)
const currentVideoUrl = computed<string | null>(() => {
  if (currentIndex.value === 0 && props.lecture.intro_video_url) return props.lecture.intro_video_url
  if (currentIndex.value === lastIndex.value && props.lecture.outro_video_url) return props.lecture.outro_video_url
  return null
})
const showAvatarVideo = computed(() => !!currentVideoUrl.value)

// ── 3D Avatar ──────────────────────────────────────────────────────────────
let THREE: any = null
let avatarRenderer: any = null
let avatarScene: any = null
let avatarCamera: any = null
let avatarHead: any = null
let avatarAnimFrame: number = 0
let avatarAngle = 0
let mouthMesh: any = null

const is3DAvatar = computed(() => {
  try {
    const parsed = JSON.parse(props.avatarPhotoUrl ?? '')
    return parsed?.type === 'glb' || parsed?.type === 'avatar3d'
  } catch { return false }
})

const avatarGlbUrl = computed(() => {
  try {
    const parsed = JSON.parse(props.avatarPhotoUrl ?? '')
    return parsed?.url ?? ''
  } catch { return '' }
})

const avatar3DConfig = computed(() => {
  try {
    const parsed = JSON.parse(props.avatarPhotoUrl ?? '')
    return parsed?.config ?? {}
  } catch { return {} }
})

function loadScript(src: string): Promise<void> {
  return new Promise((resolve, reject) => {
    if (document.querySelector(`script[src="${src}"]`)) { resolve(); return }
    const s = document.createElement('script')
    s.src = src
    s.onload = () => resolve()
    s.onerror = reject
    document.head.appendChild(s)
  })
}

async function init3DAvatar() {
  if (!is3DAvatar.value || !avatarCanvasEl.value) return
  await loadScript('https://cdn.jsdelivr.net/npm/three@0.150.0/build/three.min.js')
  THREE = (window as any).THREE
  if (!THREE) { console.error('Three.js не загрузился'); return }

  const canvas = avatarCanvasEl.value
  const W = 92, H = 92

  avatarRenderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true })
  avatarRenderer.setSize(W, H)
  avatarRenderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))
  avatarRenderer.outputEncoding = THREE.sRGBEncoding

  avatarScene = new THREE.Scene()
  avatarCamera = new THREE.PerspectiveCamera(36, W / H, 0.1, 100)
  avatarCamera.position.set(0, 0.5, 3.5)

  avatarScene.add(new THREE.AmbientLight(0xffffff, 0.6))
  const key = new THREE.DirectionalLight(0xfff8f0, 1.4)
  key.position.set(1.5, 2, 3); avatarScene.add(key)
  const fill = new THREE.DirectionalLight(0xd0e8ff, 0.5)
  fill.position.set(-2, 0.5, 1); avatarScene.add(fill)

  const glbUrl = avatarGlbUrl.value

  if (glbUrl) {
    await loadScript('https://cdn.jsdelivr.net/npm/three@0.150.0/examples/js/loaders/GLTFLoader.js')
    const GLTFLoader = (window as any).THREE.GLTFLoader || (window as any).GLTFLoader
    if (GLTFLoader) {
      const loader = new GLTFLoader()
      loader.load(
        glbUrl,
        (gltf: any) => {
          const model = gltf.scene
          const box = new THREE.Box3().setFromObject(model)
          const center = box.getCenter(new THREE.Vector3())
          const size = box.getSize(new THREE.Vector3())
          model.position.sub(center)
          model.position.y += size.y * 0.1
          const scale = 2.2 / Math.max(size.x, size.y, size.z)
          model.scale.setScalar(scale)
          avatarScene.add(model)
          avatarHead = model

          model.traverse((node: any) => {
            if (node.isMesh && node.morphTargetDictionary) {
              const keys = Object.keys(node.morphTargetDictionary)
              const mouthKey = keys.find(k =>
                k.toLowerCase().includes('mouth') ||
                k.toLowerCase().includes('open') ||
                k.toLowerCase().includes('jaw') ||
                k.toLowerCase().includes('viseme')
              )
              if (mouthKey !== undefined) {
                mouthMesh = { mesh: node, key: mouthKey, idx: node.morphTargetDictionary[mouthKey] }
              }
            }
          })
        },
        undefined,
        (err: any) => { console.error('GLB load error:', err); build3DHead() }
      )
    } else {
      build3DHead()
    }
  } else {
    build3DHead()
  }

  animate3D()
}

function hexColor(hex: string) {
  return new THREE.Color(hex)
}

const SKINS: Record<string, string> = { s1:'#FCDAB7',s2:'#F5C099',s3:'#E8A87C',s4:'#C78B5E',s5:'#9C6340',s6:'#6B3E26' }
const HAIRS: Record<string, string> = { black:'#1a0a00',darkbrown:'#3d1c02',brown:'#7B3F00',auburn:'#922B21',blonde:'#F4D03F',gray:'#ABB2B9',white:'#F2F3F4' }
const EYES: Record<string, string> = { brown:'#6B3A2A',green:'#2E7D32',blue:'#1565C0',gray:'#607D8B',black:'#212121' }

function build3DHead() {
  if (!THREE || !avatarScene) return
  if (avatarHead) { avatarScene.remove(avatarHead) }

  const cfg = avatar3DConfig.value
  const skinHex = SKINS[cfg.skin] ?? '#F5C099'
  const hairHex = HAIRS[cfg.hairColor] ?? '#3d1c02'
  const eyeHex = EYES[cfg.eyeColor] ?? '#6B3A2A'
  const faceScale = cfg.face === 'round' ? 1.0 : cfg.face === 'square' ? 1.1 : 0.92

  const g = new THREE.Group()
  const skinMat = new THREE.MeshStandardMaterial({ color: hexColor(skinHex), roughness: 0.65 })

  const headM = new THREE.Mesh(new THREE.SphereGeometry(1, 32, 32), skinMat)
  headM.scale.set(faceScale, 1, 0.88)
  g.add(headM)

  const jawM = new THREE.Mesh(new THREE.SphereGeometry(0.78, 24, 24), skinMat)
  jawM.scale.set(faceScale * 0.92, 0.55, 0.8)
  jawM.position.y = -0.72
  g.add(jawM)

  const neckM = new THREE.Mesh(new THREE.CylinderGeometry(0.28, 0.33, 0.55, 20), skinMat)
  neckM.position.y = -1.32
  g.add(neckM)

  const eyeW = new THREE.MeshStandardMaterial({ color: 0xfafafa, roughness: 0.2 })
  const irisMat = new THREE.MeshStandardMaterial({ color: hexColor(eyeHex), roughness: 0.3 })
  const pupilMat = new THREE.MeshStandardMaterial({ color: 0x050505 })
  ;[-0.29, 0.29].forEach(x => {
    const ew = new THREE.Mesh(new THREE.SphereGeometry(0.148, 16, 16), eyeW)
    ew.scale.set(1, 0.78, 0.45); ew.position.set(x, 0.14, 0.78); g.add(ew)
    const ir = new THREE.Mesh(new THREE.SphereGeometry(0.085, 14, 14), irisMat)
    ir.position.set(x, 0.14, 0.88); g.add(ir)
    const pu = new THREE.Mesh(new THREE.SphereGeometry(0.042, 10, 10), pupilMat)
    pu.position.set(x, 0.14, 0.915); g.add(pu)
  })

  const browMat = new THREE.MeshStandardMaterial({ color: hexColor(hairHex), roughness: 0.9 })
  ;[-0.29, 0.29].forEach(x => {
    const b = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.03, 0.04), browMat)
    b.position.set(x, 0.36, 0.82); b.rotation.z = x < 0 ? 0.08 : -0.08; g.add(b)
  })

  const noseMat = new THREE.MeshStandardMaterial({ color: hexColor(skinHex).multiplyScalar(0.88), roughness: 0.7 })
  const noseM = new THREE.Mesh(new THREE.SphereGeometry(0.072, 12, 12), noseMat)
  noseM.scale.set(0.7, 0.55, 0.8); noseM.position.set(0, -0.14, 0.9); g.add(noseM)

  const lipMat = new THREE.MeshStandardMaterial({ color: hexColor(skinHex).multiplyScalar(0.75), roughness: 0.5 })
  const upperL = new THREE.Mesh(new THREE.SphereGeometry(0.2, 14, 10), lipMat)
  upperL.scale.set(1, 0.3, 0.38); upperL.position.set(0, -0.44, 0.85); g.add(upperL)

  mouthMesh = new THREE.Mesh(new THREE.SphereGeometry(0.22, 14, 10), lipMat)
  mouthMesh.scale.set(1, 0.32, 0.4); mouthMesh.position.set(0, -0.54, 0.84); g.add(mouthMesh)

  const earMat = new THREE.MeshStandardMaterial({ color: hexColor(skinHex).multiplyScalar(0.95), roughness: 0.7 })
  ;[-1, 1].forEach(side => {
    const e = new THREE.Mesh(new THREE.SphereGeometry(0.22, 14, 14), earMat)
    e.scale.set(0.28, 0.42, 0.22); e.position.set(side * faceScale, 0, 0); g.add(e)
  })

  if (cfg.hair && cfg.hair !== 'bald') {
    const hairMat = new THREE.MeshStandardMaterial({ color: hexColor(hairHex), roughness: 0.85 })
    const top = new THREE.Mesh(new THREE.SphereGeometry(1.04, 24, 20, 0, Math.PI * 2, 0, Math.PI * 0.55), hairMat)
    top.scale.set(1, 0.72, 0.92); top.position.y = 0.38; g.add(top)
    if (cfg.hair === 'long' || cfg.hair === 'medium') {
      ;[-1, 1].forEach(side => {
        const sh = cfg.hair === 'long' ? 1.8 : 0.72
        const sGeo = new THREE.CylinderGeometry(0.2, 0.16, sh, 12)
        const sm = new THREE.Mesh(sGeo, hairMat)
        sm.position.set(side * 0.88, cfg.hair === 'long' ? -1.0 : -0.42, -0.08); g.add(sm)
      })
    }
  }

  g.position.y = 0.4
  avatarScene.add(g)
  avatarHead = g
}

function animate3D() {
  avatarAnimFrame = requestAnimationFrame(animate3D)
  avatarAngle += 0.004

  if (avatarHead) {
    avatarHead.rotation.y = Math.sin(avatarAngle) * 0.18
    avatarHead.rotation.x = Math.sin(avatarAngle * 0.6) * 0.04

    if (mouthMesh && isPlaying.value) {
      if (mouthMesh.mesh && mouthMesh.idx !== undefined) {
        const openVal = Math.abs(Math.sin(avatarAngle * 8)) * 0.7
        mouthMesh.mesh.morphTargetInfluences[mouthMesh.idx] = openVal
      } else if (mouthMesh.scale) {
        const openAmount = 0.32 + Math.abs(Math.sin(avatarAngle * 8)) * 0.25
        mouthMesh.scale.y = openAmount
        mouthMesh.position.y = -0.54 - (openAmount - 0.32) * 0.15
      }
    } else if (mouthMesh) {
      if (mouthMesh.mesh && mouthMesh.idx !== undefined) {
        mouthMesh.mesh.morphTargetInfluences[mouthMesh.idx] = 0
      } else if (mouthMesh.scale) {
        mouthMesh.scale.y = 0.32
        mouthMesh.position.y = -0.54
      }
    }
  }

  if (avatarRenderer && avatarScene && avatarCamera) {
    avatarRenderer.render(avatarScene, avatarCamera)
  }
}

const cleanup3D = () => {
  cancelAnimationFrame(avatarAnimFrame)
  avatarRenderer?.dispose()
  avatarHead = null
  mouthMesh = null
}

const toggleFullscreen = async () => {
  if (!slideAreaEl.value) return
  try {
    if (!document.fullscreenElement) {
      await slideAreaEl.value.requestFullscreen()
    } else {
      await document.exitFullscreen()
    }
  } catch {
    // Fullscreen API недоступен — тихо игнорируем
  }
}

const onFullscreenChange = () => {
  isFullscreen.value = document.fullscreenElement === slideAreaEl.value
}

const currentSlide = computed(() => props.lecture.slides[currentIndex.value])

const renderedSummary = computed(() => {
  const text = props.lecture.summary_text || ''
  return text
    .replace(/^### (.*$)/gim, '<h4>$1</h4>')
    .replace(/^## (.*$)/gim, '<h3>$1</h3>')
    .replace(/^# (.*$)/gim, '<h2>$1</h2>')
    .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
    .replace(/^- (.*$)/gim, '<li>$1</li>')
    .replace(/(<li>.*<\/li>)/gims, '<ul>$1</ul>')
    .replace(/\n\n/g, '<br/><br/>')
})

// Проигрывание: на слайде с говорящим видео играем видео (в нём и звук),
// иначе — обычное аудио слайда.
const playCurrent = async () => {
  if (showAvatarVideo.value) {
    if (!introVideoEl.value) return
    try {
      // видео без звука + оригинальное аудио слайда: голос везде одинаковый,
      // липсинк совпадает, т.к. видео сгенерировано из этого же аудио
      introVideoEl.value.currentTime = 0
      if (audioEl.value) audioEl.value.currentTime = 0
      await introVideoEl.value.play()
      if (audioEl.value) await audioEl.value.play()
      isPlaying.value = true
    } catch {
      isPlaying.value = false
    }
    return
  }
  if (!audioEl.value) return
  try {
    await audioEl.value.play()
    isPlaying.value = true
  } catch {
    isPlaying.value = false
  }
}

const togglePlay = () => {
  if (showAvatarVideo.value) {
    if (!introVideoEl.value) return
    if (isPlaying.value) {
      introVideoEl.value.pause()
      audioEl.value?.pause()
      isPlaying.value = false
    } else { playCurrent() }
    return
  }
  if (!audioEl.value) return
  if (isPlaying.value) {
    audioEl.value.pause()
    isPlaying.value = false
  } else {
    playCurrent()
  }
}

const nextSlide = () => {
  if (currentIndex.value < props.lecture.slides.length - 1) currentIndex.value++
}
const prevSlide = () => {
  if (currentIndex.value > 0) currentIndex.value--
}

const onIntroVideoEnded = () => {
  // видео короче/длиннее аудио — ждём окончания аудио, ничего не делаем
}

const onAudioEnded = () => {
  isPlaying.value = false
  slideProgressPct.value = 100
  if (currentIndex.value < props.lecture.slides.length - 1) {
    setTimeout(() => { nextSlide() }, 600)
  }
}

const onTimeUpdate = () => {
  if (!audioEl.value || !audioEl.value.duration) return
  slideProgressPct.value = (audioEl.value.currentTime / audioEl.value.duration) * 100
}
const onLoadedMeta = () => { slideProgressPct.value = 0 }

watch(currentIndex, () => {
  slideProgressPct.value = 0
  isPlaying.value = false
  if (introVideoEl.value) { try { introVideoEl.value.pause(); introVideoEl.value.currentTime = 0 } catch {} }
  setTimeout(() => {
    if (showAvatarVideo.value || currentSlide.value?.audio_url) playCurrent()
  }, 150)
})

onMounted(() => {
  if (showAvatarVideo.value || currentSlide.value?.audio_url) playCurrent()
  document.addEventListener('fullscreenchange', onFullscreenChange)
  nextTick(() => { if (is3DAvatar.value && !showAvatarVideo.value && !vrmUrl.value) init3DAvatar() })
})

onBeforeUnmount(() => {
  audioEl.value?.pause()
  introVideoEl.value?.pause()
  document.removeEventListener('fullscreenchange', onFullscreenChange)
  cleanup3D()
})
</script>

<style scoped>
.player-overlay { position: fixed; inset: 0; background: rgba(0,0,0,.7); display: flex; align-items: center; justify-content: center; z-index: 200; padding: 16px; }
.player-sheet { background: var(--surface); border: 1px solid var(--border2); border-radius: var(--r-2xl); width: 100%; max-width: 860px; max-height: 92vh; display: flex; flex-direction: column; box-shadow: var(--sh-lg); overflow: hidden; }
.player-head { display: flex; align-items: center; justify-content: space-between; padding: 18px 22px; border-bottom: 1px solid var(--border); flex-shrink: 0; }
.ph-title { font-family: 'Outfit',sans-serif; font-size: 16px; font-weight: 800; color: var(--text1); }
.ph-sub { font-size: 12px; color: var(--text4); margin-top: 2px; }
.ph-actions { display: flex; align-items: center; gap: 8px; }
.btn-del { width: 34px; height: 34px; border-radius: var(--r-md); background: var(--surface2); border: 1px solid var(--border); color: var(--text4); display: flex; align-items: center; justify-content: center; cursor: pointer; transition: all .15s; }
.btn-del:hover:not(:disabled) { color: var(--red); border-color: var(--red); background: rgba(248,113,113,.08); }
.btn-del:disabled { opacity: .4; cursor: not-allowed; }
.stage { padding: 20px 22px 22px; display: flex; flex-direction: column; gap: 14px; overflow-y: auto; }
.slide-area { position: relative; width: 100%; aspect-ratio: 16/9; background: #0b1220; border-radius: var(--r-lg); overflow: hidden; border: 1px solid var(--border); }
.slide-area.is-fullscreen { border-radius: 0; aspect-ratio: unset; width: 100vw; height: 100vh; }
.slide-area:fullscreen { border-radius: 0; width: 100vw; height: 100vh; }
.slide-area:fullscreen .slide-img { object-fit: contain; }
.fullscreen-btn { position: absolute; top: 12px; right: 12px; width: 34px; height: 34px; border-radius: 8px; background: rgba(0,0,0,.5); border: 1px solid rgba(255,255,255,.15); color: #fff; display: flex; align-items: center; justify-content: center; cursor: pointer; transition: all .15s; backdrop-filter: blur(4px); z-index: 5; }
.fullscreen-btn:hover { background: rgba(0,0,0,.7); }
.fs-overlay-controls { position: absolute; bottom: 0; left: 0; right: 0; display: flex; flex-direction: column; gap: 10px; padding: 16px 20px 20px; background: linear-gradient(to top, rgba(0,0,0,.65), transparent); }
.fs-seg { background: rgba(255,255,255,.25); }
.fs-progress-row { display: flex; gap: 4px; }
.fs-controls-row { display: flex; align-items: center; justify-content: center; gap: 12px; }
.slide-img { width: 100%; height: 100%; object-fit: contain; background: #fff; }
.stage-video { width: 100%; height: 100%; object-fit: contain; display: block; background: #0b1220; }
.slide-placeholder { width: 100%; height: 100%; display: flex; align-items: center; justify-content: center; }
.slide-placeholder-text { color: var(--text4); font-size: 13px; }
.avatar-corner { position: absolute; bottom: 14px; right: 14px; width: 92px; border-radius: 16px; overflow: visible; display: flex; flex-direction: column; align-items: center; gap: 6px; z-index: 4; }
.slide-area:fullscreen .avatar-corner { width: 160px; bottom: 110px; right: 28px; }

.avatar-video-wrap { width: 100%; aspect-ratio: 1; border-radius: 16px; overflow: hidden; border: 2px solid rgba(0,177,201,.5); box-shadow: 0 6px 20px rgba(0,0,0,.4); background: #000; }
.avatar-corner.talking .avatar-video-wrap { border-color: var(--teal); box-shadow: 0 0 0 4px rgba(0,177,201,.2), 0 6px 20px rgba(0,0,0,.4); }
.avatar-video { width: 100%; height: 100%; object-fit: contain; display: block; background: #000; }

.avatar-wobble { width: 100%; aspect-ratio: 1; border-radius: 16px; overflow: hidden; border: 2px solid rgba(0,177,201,.5); box-shadow: 0 6px 20px rgba(0,0,0,.4); background: var(--surface2); display: flex; align-items: center; justify-content: center; transition: border-color .3s; }
.avatar-corner.talking .avatar-wobble { border-color: var(--teal); box-shadow: 0 0 0 4px rgba(0,177,201,.2), 0 6px 20px rgba(0,0,0,.4); }

.avatar-vrm-wrap { width: 100%; aspect-ratio: 1; border-radius: 16px; overflow: hidden; border: 2px solid rgba(0,177,201,.5); box-shadow: 0 6px 20px rgba(0,0,0,.4); background: var(--surface2); }
.avatar-corner.talking .avatar-vrm-wrap { border-color: var(--teal); box-shadow: 0 0 0 4px rgba(0,177,201,.2), 0 6px 20px rgba(0,0,0,.4); }
.avatar-canvas { width: 100%; height: 100%; display: block; border-radius: 14px; }
.avatar-photo { width: 100%; height: 100%; object-fit: cover; }
.avatar-fallback { font-size: 40px; }

.speech-indicator { display: flex; align-items: flex-end; gap: 3px; height: 20px; padding: 2px 8px; background: rgba(0,0,0,.55); border-radius: 100px; backdrop-filter: blur(6px); }
.speech-indicator span { width: 3px; border-radius: 3px; background: var(--teal); animation: speechWave 1s ease-in-out infinite; }
.speech-indicator span:nth-child(1) { animation-delay: 0s; }
.speech-indicator span:nth-child(2) { animation-delay: .1s; }
.speech-indicator span:nth-child(3) { animation-delay: .2s; }
.speech-indicator span:nth-child(4) { animation-delay: .1s; }
.speech-indicator span:nth-child(5) { animation-delay: 0s; }
@keyframes speechWave {
  0%, 100% { height: 4px; opacity: .5; }
  50% { height: 16px; opacity: 1; }
}
.progress-row { display: flex; gap: 4px; }
.progress-seg { flex: 1; height: 4px; background: var(--border); border-radius: 3px; overflow: hidden; }
.progress-fill { height: 100%; background: var(--teal); transition: width .15s linear; }
.narration-box { font-size: 13px; line-height: 1.6; color: var(--text2); background: var(--surface2); border: 1px solid var(--border); border-radius: var(--r-lg); padding: 14px 16px; max-height: 120px; overflow-y: auto; }
.controls-row { display: flex; align-items: center; justify-content: center; gap: 12px; }
.ctrl-btn { width: 42px; height: 42px; border-radius: 50%; background: var(--surface2); border: 1px solid var(--border); color: var(--text2); display: flex; align-items: center; justify-content: center; cursor: pointer; transition: all .15s; }
.ctrl-btn:hover:not(:disabled) { background: var(--surface3); color: var(--text1); }
.ctrl-btn:disabled { opacity: .35; cursor: not-allowed; }
.ctrl-summary { width: auto; border-radius: var(--r-lg); padding: 0 16px; gap: 6px; font-size: 12px; font-weight: 600; }
.ctrl-main { width: 54px; height: 54px; border-radius: 50%; background: linear-gradient(135deg, #00B1C9, #009aaf); color: #fff; border: none; box-shadow: 0 4px 16px rgba(0,177,201,.4); }
.ctrl-main:hover { box-shadow: 0 6px 22px rgba(0,177,201,.55); }
.summary-stage { padding: 20px 22px 22px; overflow-y: auto; }
.summary-head-row { margin-bottom: 14px; }
.back-to-lecture { display: flex; align-items: center; gap: 6px; background: var(--surface2); border: 1px solid var(--border); border-radius: var(--r-md); padding: 7px 13px; font-size: 12px; font-weight: 600; color: var(--text2); cursor: pointer; transition: all .15s; }
.back-to-lecture:hover { background: var(--surface3); color: var(--text1); }
.summary-body { font-size: 14px; line-height: 1.7; color: var(--text1); }
.summary-body :deep(h2), .summary-body :deep(h3), .summary-body :deep(h4) { font-family: 'Outfit',sans-serif; font-weight: 800; margin: 16px 0 8px; color: var(--text1); }
.summary-body :deep(ul) { margin: 8px 0; padding-left: 20px; }
.summary-body :deep(li) { margin: 4px 0; }
@media (max-width: 768px) {
  .player-sheet { max-height: 96vh; }
  .avatar-corner { width: 64px; height: 64px; bottom: 8px; right: 8px; }
  .controls-row { gap: 8px; }
}
</style>