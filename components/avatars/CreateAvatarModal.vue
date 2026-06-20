<template>
  <div class="overlay" @click.self="$emit('close')">
    <div class="modal anim-scale">
      <div class="modal-head">
        <div class="modal-head-l">
          <div class="modal-ico ico-av">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="8" r="4"/><path d="M4 21v-1a8 8 0 0116 0v1"/></svg>
          </div>
          <div>
            <div class="modal-title">Создать AI-аватара</div>
            <div class="modal-sub">Он будет читать лекции вашим голосом</div>
          </div>
        </div>
        <button class="btn btn-icon btn-ghost" @click="$emit('close')">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M18 6L6 18M6 6l12 12"/></svg>
        </button>
      </div>

      <div class="modal-body">
        <div class="info-banner">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><line x1="12" y1="16" x2="12" y2="12"/><line x1="12" y1="8" x2="12.01" y2="8"/></svg>
          <span>Создание аватара требует одобрения администратора — это платная функция (клонирование голоса). Обычно решение принимается в течение дня.</span>
        </div>

        <div class="field">
          <label class="field-label">Имя для отображения</label>
          <input v-model="displayName" class="inp" placeholder="Например: Айгерим Сериковна" />
        </div>

        <div class="field">
          <label class="field-label">Фото для аватара *</label>
          <div v-if="!photoFile && !photoUrl" class="file-drop" @click="photoInput?.click()">
            <input type="file" ref="photoInput" style="display:none" accept="image/png,image/jpeg,image/webp" @change="onPhotoPick" />
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" class="drop-icon"><rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="9" cy="9" r="2"/><path d="M21 15l-5-5L5 21"/></svg>
            <span class="drop-text">Загрузите фото лица <strong>(спокойное выражение, лицо чётко видно)</strong></span>
            <span class="drop-hint">JPG, PNG, WEBP</span>
          </div>
          <div v-else class="preview-row">
            <img :src="photoPreview" class="photo-preview" />
            <button class="btn-rm-sm" @click="resetPhoto">Заменить</button>
          </div>
        </div>

        <div class="field">
          <label class="field-label">Образец голоса *</label>
          <div class="voice-tabs">
            <button :class="['vtab', { active: voiceMode === 'record' }]" @click="voiceMode = 'record'">Записать с микрофона</button>
            <button :class="['vtab', { active: voiceMode === 'upload' }]" @click="voiceMode = 'upload'">Загрузить файл</button>
          </div>

          <div v-if="voiceMode === 'record'" class="record-box">
            <div v-if="!audioBlobUrl" class="record-controls">
              <button class="rec-btn" :class="{ recording: isRecording }" @click="toggleRecording">
                <svg v-if="!isRecording" width="20" height="20" viewBox="0 0 24 24" fill="currentColor"><circle cx="12" cy="12" r="9"/></svg>
                <svg v-else width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><rect x="6" y="6" width="12" height="12" rx="2"/></svg>
              </button>
              <div class="rec-hint">
                <template v-if="isRecording">Идёт запись... {{ formatTime(recordSeconds) }} <span class="rec-min-hint">(минимум 30 сек)</span></template>
                <template v-else>Прочитайте вслух любой текст 30-60 секунд — чем спокойнее и чище запись, тем лучше клонируется голос</template>
              </div>
            </div>
            <div v-else class="audio-ready">
              <audio :src="audioBlobUrl" controls class="audio-player" />
              <button class="btn-rm-sm" @click="resetRecording">Записать снова</button>
            </div>
          </div>

          <div v-else class="field">
            <div v-if="!voiceFile" class="file-drop" @click="voiceInput?.click()">
              <input type="file" ref="voiceInput" style="display:none" accept="audio/*" @change="onVoicePick" />
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" class="drop-icon"><path d="M9 18V5l12-2v13"/><circle cx="6" cy="18" r="3"/><circle cx="18" cy="16" r="3"/></svg>
              <span class="drop-text">Загрузите аудиозапись голоса <strong>(30-60 сек чистой речи)</strong></span>
              <span class="drop-hint">MP3, WAV, M4A</span>
            </div>
            <div v-else class="audio-ready">
              <span class="file-name">{{ voiceFile.name }}</span>
              <button class="btn-rm-sm" @click="voiceFile = null">Заменить</button>
            </div>
          </div>
        </div>

        <div v-if="uploading" class="upload-progress">
          <div class="upload-bar-wrap"><div class="upload-bar" :style="{ width: uploadPct + '%' }"></div></div>
          <span class="upload-text">Загрузка файлов...</span>
        </div>
      </div>

      <div class="modal-foot">
        <button class="btn btn-ghost" @click="$emit('close')">Отмена</button>
        <button class="btn btn-purple" :disabled="!canSubmit || loading" @click="submit">
          <div v-if="loading" class="spinner"></div>
          <span v-else>Отправить на одобрение</span>
        </button>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onBeforeUnmount } from 'vue'
import { useToast } from '~/composables/useToast'
import { useUploadSvc } from '~/services/uploads'
import { useAvatarsSvc } from '~/services/avatars'

const emit = defineEmits<{ close: []; created: [a: any] }>()

const toast = useToast()
const uploadSvc = useUploadSvc()
const avatarsSvc = useAvatarsSvc()

const displayName = ref('')

const photoInput = ref<HTMLInputElement | null>(null)
const photoFile = ref<File | null>(null)
const photoUrl = ref('')
const photoPreview = computed(() => photoFile.value ? URL.createObjectURL(photoFile.value) : photoUrl.value)
const onPhotoPick = (e: Event) => {
  const f = (e.target as HTMLInputElement).files?.[0]
  if (f) photoFile.value = f
}
const resetPhoto = () => { photoFile.value = null; photoUrl.value = '' }

const voiceMode = ref<'record' | 'upload'>('record')
const voiceInput = ref<HTMLInputElement | null>(null)
const voiceFile = ref<File | null>(null)
const onVoicePick = (e: Event) => {
  const f = (e.target as HTMLInputElement).files?.[0]
  if (f) voiceFile.value = f
}

const isRecording = ref(false)
const recordSeconds = ref(0)
const audioBlobUrl = ref('')
const audioBlob = ref<Blob | null>(null)
let mediaRecorder: MediaRecorder | null = null
let recordedChunks: Blob[] = []
let recordTimer: ReturnType<typeof setInterval> | null = null

const formatTime = (s: number) => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`

const toggleRecording = async () => {
  if (isRecording.value) {
    mediaRecorder?.stop()
    return
  }
  try {
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
    recordedChunks = []
    mediaRecorder = new MediaRecorder(stream)
    mediaRecorder.ondataavailable = (e) => { if (e.data.size > 0) recordedChunks.push(e.data) }
    mediaRecorder.onstop = () => {
      const blob = new Blob(recordedChunks, { type: 'audio/webm' })
      audioBlob.value = blob
      audioBlobUrl.value = URL.createObjectURL(blob)
      stream.getTracks().forEach(t => t.stop())
      if (recordTimer) clearInterval(recordTimer)
    }
    mediaRecorder.start()
    isRecording.value = true
    recordSeconds.value = 0
    recordTimer = setInterval(() => { recordSeconds.value++ }, 1000)
  } catch {
    toast.err('Не удалось получить доступ к микрофону')
  }
}
const resetRecording = () => {
  audioBlobUrl.value = ''
  audioBlob.value = null
  recordSeconds.value = 0
}

onBeforeUnmount(() => {
  if (recordTimer) clearInterval(recordTimer)
  try { (mediaRecorder as any)?.stream?.getTracks?.().forEach((t: any) => t.stop()) } catch {}
})

const canSubmit = computed(() => {
  const hasPhoto = !!(photoFile.value || photoUrl.value)
  const hasVoice = !!(audioBlob.value || voiceFile.value)
  return hasPhoto && hasVoice
})

const loading = ref(false)
const uploading = ref(false)
const uploadPct = ref(0)

const submit = async () => {
  if (!canSubmit.value) return
  loading.value = true
  uploading.value = true
  uploadPct.value = 10
  try {
    let finalPhotoUrl = photoUrl.value
    if (photoFile.value) {
      const { file_url } = await uploadSvc.upload(photoFile.value)
      finalPhotoUrl = file_url
    }
    uploadPct.value = 55

    let finalVoiceUrl = ''
    if (audioBlob.value) {
      const file = new File([audioBlob.value], 'voice_sample.webm', { type: audioBlob.value.type })
      const { file_url } = await uploadSvc.upload(file)
      finalVoiceUrl = file_url
    } else if (voiceFile.value) {
      const { file_url } = await uploadSvc.upload(voiceFile.value)
      finalVoiceUrl = file_url
    }
    uploadPct.value = 90

    const avatar = await avatarsSvc.create({
      display_name: displayName.value || undefined,
      photo_url: finalPhotoUrl,
      voice_sample_url: finalVoiceUrl,
    })
    uploadPct.value = 100
    toast.ok('Заявка отправлена на одобрение администратору')
    emit('created', avatar)
  } catch (e: any) {
    toast.err(e?.response?.data?.detail || 'Не удалось создать аватара')
  } finally {
    loading.value = false
    uploading.value = false
  }
}
</script>

<style scoped>
.modal { background: var(--surface); border: 1px solid var(--border2); border-radius: var(--r-2xl); width: 100%; max-width: 560px; max-height: 90vh; display: flex; flex-direction: column; box-shadow: var(--sh-lg); overflow: hidden; }

.modal-head { display: flex; align-items: center; justify-content: space-between; padding: 22px 24px 16px; border-bottom: 1px solid var(--border); flex-shrink: 0; }
.modal-head-l { display: flex; align-items: center; gap: 12px; }
.modal-ico { width: 38px; height: 38px; border-radius: var(--r-md); display: flex; align-items: center; justify-content: center; }
.ico-av { background: rgba(0,177,201,.12); color: var(--teal); border: 1px solid rgba(0,177,201,.2); }
.modal-title { font-family: 'Outfit',sans-serif; font-size: 16px; font-weight: 800; color: var(--text1); }
.modal-sub { font-size: 12px; color: var(--text4); margin-top: 2px; }

.modal-body { padding: 20px 24px; overflow-y: auto; flex: 1; display: flex; flex-direction: column; gap: 16px; }
.modal-foot { padding: 14px 24px; border-top: 1px solid var(--border); display: flex; justify-content: flex-end; gap: 10px; }

.info-banner { display: flex; align-items: flex-start; gap: 8px; padding: 10px 12px; background: rgba(245,158,11,.08); border: 1px solid rgba(245,158,11,.2); border-radius: var(--r-md); color: #f59e0b; font-size: 12px; line-height: 1.5; }
.info-banner svg { flex-shrink: 0; margin-top: 1px; }

.field { display: flex; flex-direction: column; gap: 7px; }
.field-label { font-size: 11px; font-weight: 700; color: var(--text4); text-transform: uppercase; letter-spacing: .06em; }
.inp { background: var(--surface2); border: 1px solid var(--border); border-radius: var(--r-md); padding: 10px 13px; color: var(--text1); font-size: 13px; width: 100%; transition: border-color .15s; }
.inp:focus { border-color: rgba(0,177,201,.4); }

.file-drop { border: 2px dashed var(--border2); border-radius: var(--r-lg); padding: 20px; display: flex; flex-direction: column; align-items: center; gap: 6px; cursor: pointer; transition: all .18s; text-align: center; }
.file-drop:hover { border-color: rgba(0,177,201,.45); background: rgba(0,177,201,.04); }
.drop-icon { color: var(--text4); }
.drop-text { font-size: 13px; color: var(--text3); }
.drop-text strong { color: var(--teal); }
.drop-hint { font-size: 11px; color: var(--text4); }

.preview-row { display: flex; align-items: center; gap: 12px; }
.photo-preview { width: 64px; height: 64px; border-radius: 50%; object-fit: cover; border: 1px solid var(--border2); }
.btn-rm-sm { background: var(--surface2); border: 1px solid var(--border); border-radius: var(--r-md); padding: 6px 12px; font-size: 12px; color: var(--text3); cursor: pointer; transition: all .15s; }
.btn-rm-sm:hover { background: var(--surface3); color: var(--text1); }

.voice-tabs { display: flex; gap: 6px; margin-bottom: 8px; }
.vtab { flex: 1; padding: 8px 12px; border-radius: var(--r-md); font-size: 12px; font-weight: 600; color: var(--text3); background: var(--surface2); border: 1px solid var(--border); cursor: pointer; transition: all .15s; }
.vtab.active { background: rgba(0,177,201,.1); color: var(--teal); border-color: rgba(0,177,201,.3); }

.record-box { background: var(--surface2); border: 1px solid var(--border); border-radius: var(--r-lg); padding: 16px; }
.record-controls { display: flex; align-items: center; gap: 14px; }
.rec-btn { width: 48px; height: 48px; border-radius: 50%; background: var(--red-l); color: var(--red); border: 1px solid rgba(248,113,113,.3); display: flex; align-items: center; justify-content: center; cursor: pointer; flex-shrink: 0; transition: all .15s; }
.rec-btn.recording { background: var(--red); color: #fff; animation: pulse-rec 1.5s infinite; }
@keyframes pulse-rec { 0%,100% { box-shadow: 0 0 0 0 rgba(248,113,113,.4); } 50% { box-shadow: 0 0 0 8px rgba(248,113,113,0); } }
.rec-hint { font-size: 12px; color: var(--text3); line-height: 1.5; }
.rec-min-hint { color: var(--text4); }
.audio-ready { display: flex; align-items: center; gap: 12px; }
.audio-player { flex: 1; height: 36px; }
.file-name { font-size: 13px; color: var(--text1); flex: 1; }

.upload-progress { display: flex; flex-direction: column; gap: 5px; }
.upload-bar-wrap { height: 3px; background: var(--border); border-radius: 3px; overflow: hidden; }
.upload-bar { height: 100%; background: var(--teal); border-radius: 3px; transition: width .3s; }
.upload-text { font-size: 12px; color: var(--teal); }

.spinner { width: 14px; height: 14px; border: 2px solid rgba(255,255,255,.3); border-top-color: #fff; border-radius: 50%; animation: spin .6s linear infinite; }
@keyframes spin { to { transform: rotate(360deg); } }
</style>
