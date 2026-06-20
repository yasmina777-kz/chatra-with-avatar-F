<template>
  <div class="player-overlay" @click.self="$emit('close')">
    <div class="player-sheet anim-scale">
      <div class="player-head">
        <div class="ph-title-block">
          <div class="ph-title">{{ lecture.title }}</div>
          <div class="ph-sub">Слайд {{ currentIndex + 1 }} из {{ lecture.slides.length }}</div>
        </div>
        <button class="btn btn-icon btn-ghost" @click="$emit('close')">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M18 6L6 18M6 6l12 12"/></svg>
        </button>
      </div>

      <div v-if="!showSummary" class="stage">
        <div class="slide-area" ref="slideAreaEl" :class="{ 'is-fullscreen': isFullscreen }">
          <img v-if="currentSlide?.slide_image_url" :src="currentSlide.slide_image_url" class="slide-img" />
          <div v-else class="slide-placeholder">
            <div class="slide-placeholder-text">Слайд готовится...</div>
          </div>

          <button class="fullscreen-btn" @click="toggleFullscreen" :title="isFullscreen ? 'Выйти из полноэкранного режима' : 'На весь экран'">
            <svg v-if="!isFullscreen" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M8 3H5a2 2 0 00-2 2v3m18 0V5a2 2 0 00-2-2h-3m0 18h3a2 2 0 002-2v-3M3 16v3a2 2 0 002 2h3"/></svg>
            <svg v-else width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M8 3v3a2 2 0 01-2 2H3m18 0h-3a2 2 0 01-2-2V3m0 18v-3a2 2 0 012-2h3M3 16h3a2 2 0 012 2v3"/></svg>
          </button>

          <div class="avatar-corner" :class="{ talking: isPlaying }">
            <video
              v-if="currentIndex === 0 && lecture.intro_video_url"
              :src="lecture.intro_video_url"
              class="avatar-media"
              autoplay
              muted
              playsinline
            />
            <img v-else-if="avatarPhotoUrl" :src="avatarPhotoUrl" class="avatar-media avatar-photo" />
            <div v-else class="avatar-fallback">👨‍🏫</div>
            <div class="talk-indicator" v-if="isPlaying"><span></span><span></span><span></span></div>
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
import { ref, computed, watch, onMounted, onBeforeUnmount } from 'vue'
import type { AvatarLectureFull } from '~/services/avatars'

const props = defineProps<{ lecture: AvatarLectureFull; avatarPhotoUrl?: string | null }>()
const emit = defineEmits<{ close: [] }>()

const currentIndex = ref(0)
const isPlaying = ref(false)
const showSummary = ref(false)
const audioEl = ref<HTMLAudioElement | null>(null)
const slideAreaEl = ref<HTMLElement | null>(null)
const slideProgressPct = ref(0)
const isFullscreen = ref(false)

const toggleFullscreen = async () => {
  if (!slideAreaEl.value) return
  try {
    if (!document.fullscreenElement) {
      await slideAreaEl.value.requestFullscreen()
    } else {
      await document.exitFullscreen()
    }
  } catch {
    // Fullscreen API недоступен (например, в iframe без allow="fullscreen") — тихо игнорируем
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

const playCurrentAudio = async () => {
  if (!audioEl.value) return
  try {
    await audioEl.value.play()
    isPlaying.value = true
  } catch {
    isPlaying.value = false
  }
}

const togglePlay = () => {
  if (!audioEl.value) return
  if (isPlaying.value) {
    audioEl.value.pause()
    isPlaying.value = false
  } else {
    playCurrentAudio()
  }
}

const nextSlide = () => {
  if (currentIndex.value < props.lecture.slides.length - 1) currentIndex.value++
}
const prevSlide = () => {
  if (currentIndex.value > 0) currentIndex.value--
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
  setTimeout(() => { if (currentSlide.value?.audio_url) playCurrentAudio() }, 150)
})

onMounted(() => {
  if (currentSlide.value?.audio_url) playCurrentAudio()
  document.addEventListener('fullscreenchange', onFullscreenChange)
})

onBeforeUnmount(() => {
  audioEl.value?.pause()
  document.removeEventListener('fullscreenchange', onFullscreenChange)
})
</script>

<style scoped>
.player-overlay { position: fixed; inset: 0; background: rgba(0,0,0,.7); display: flex; align-items: center; justify-content: center; z-index: 200; padding: 16px; }
.player-sheet { background: var(--surface); border: 1px solid var(--border2); border-radius: var(--r-2xl); width: 100%; max-width: 860px; max-height: 92vh; display: flex; flex-direction: column; box-shadow: var(--sh-lg); overflow: hidden; }
.player-head { display: flex; align-items: center; justify-content: space-between; padding: 18px 22px; border-bottom: 1px solid var(--border); flex-shrink: 0; }
.ph-title { font-family: 'Outfit',sans-serif; font-size: 16px; font-weight: 800; color: var(--text1); }
.ph-sub { font-size: 12px; color: var(--text4); margin-top: 2px; }
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
.slide-placeholder { width: 100%; height: 100%; display: flex; align-items: center; justify-content: center; }
.slide-placeholder-text { color: var(--text4); font-size: 13px; }
.avatar-corner { position: absolute; bottom: 14px; right: 14px; width: 92px; height: 92px; border-radius: 16px; overflow: hidden; border: 2px solid rgba(0,177,201,.5); box-shadow: 0 6px 20px rgba(0,0,0,.4); background: var(--surface2); display: flex; align-items: center; justify-content: center; z-index: 4; }
.slide-area:fullscreen .avatar-corner { width: 160px; height: 160px; bottom: 110px; right: 28px; }
.avatar-corner.talking { border-color: var(--teal); box-shadow: 0 0 0 4px rgba(0,177,201,.2), 0 6px 20px rgba(0,0,0,.4); }
.avatar-media { width: 100%; height: 100%; object-fit: cover; }
.avatar-fallback { font-size: 40px; }
.talk-indicator { position: absolute; bottom: 4px; left: 50%; transform: translateX(-50%); display: flex; gap: 3px; }
.talk-indicator span { width: 4px; height: 4px; border-radius: 50%; background: var(--teal); animation: pulse-talk 1s infinite; }
.talk-indicator span:nth-child(2) { animation-delay: .15s; }
.talk-indicator span:nth-child(3) { animation-delay: .3s; }
@keyframes pulse-talk { 0%,100% { opacity: .3; } 50% { opacity: 1; } }
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