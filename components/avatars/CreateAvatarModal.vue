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
            <div class="modal-sub">Он будет читать лекции выбранным голосом</div>
          </div>
        </div>
        <button class="btn btn-icon btn-ghost" @click="$emit('close')">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M18 6L6 18M6 6l12 12"/></svg>
        </button>
      </div>

      <div class="modal-body">
        <div class="info-banner">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><line x1="12" y1="16" x2="12" y2="12"/><line x1="12" y1="8" x2="12.01" y2="8"/></svg>
          <span>Создание аватара требует одобрения администратора. Обычно решение принимается в течение дня.</span>
        </div>

        <div class="field">
          <label class="field-label">Имя для отображения</label>
          <input v-model="displayName" class="inp" placeholder="Например: Айгерим Сериковна" />
        </div>

        <!-- Видео/фото учителя для Wav2Lip -->
        <div class="field">
          <label class="field-label">Видео или фото для аватара *</label>
          <div v-if="!mediaFile && !mediaUrl" class="file-drop" @click="mediaInput?.click()">
            <input type="file" ref="mediaInput" style="display:none" accept="video/mp4,video/webm,image/png,image/jpeg,image/webp" @change="onMediaPick" />
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" class="drop-icon"><rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="9" cy="9" r="2"/><path d="M21 15l-5-5L5 21"/></svg>
            <span class="drop-text">Загрузите короткое видео лица <strong>(30–60 сек, смотрите прямо в камеру)</strong></span>
            <span class="drop-hint">MP4, WEBM или фото (JPG/PNG). Видео даёт естественные движения — губы аватар подстроит под речь.</span>
          </div>
          <div v-else class="preview-row">
            <video v-if="isVideo" :src="mediaPreview" class="photo-preview" muted playsinline />
            <img v-else :src="mediaPreview" class="photo-preview" />
            <button class="btn-rm-sm" @click="resetMedia">Заменить</button>
          </div>
        </div>

        <!-- Выбор голоса Azure -->
        <div class="field">
          <label class="field-label">Голос аватара *</label>
          <select v-model="selectedVoice" class="inp">
            <option v-for="v in VOICES" :key="v.id" :value="v.id">{{ v.label }}</option>
          </select>
          <span class="drop-hint">Голос, которым аватар будет читать лекции</span>
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
import { ref, computed } from 'vue'
import { useToast } from '~/composables/useToast'
import { useUploadSvc } from '~/services/uploads'
import { useAvatarsSvc } from '~/services/avatars'

const emit = defineEmits<{ close: []; created: [a: any] }>()

const toast = useToast()
const uploadSvc = useUploadSvc()
const avatarsSvc = useAvatarsSvc()

const displayName = ref('')

// Русские голоса Azure
const VOICES = [
  { id: 'ru-RU-DmitryNeural',   label: 'Дмитрий (мужской)' },
  { id: 'ru-RU-SvetlanaNeural', label: 'Светлана (женский)' },
  { id: 'ru-RU-DariyaNeural',   label: 'Дария (женский)' },
]
const selectedVoice = ref(VOICES[0].id)

const mediaInput = ref<HTMLInputElement | null>(null)
const mediaFile = ref<File | null>(null)
const mediaUrl = ref('')
const isVideo = computed(() => {
  if (mediaFile.value) return mediaFile.value.type.startsWith('video')
  return /\.(mp4|webm|mov)(\?|$)/i.test(mediaUrl.value)
})
const mediaPreview = computed(() => mediaFile.value ? URL.createObjectURL(mediaFile.value) : mediaUrl.value)
const onMediaPick = (e: Event) => {
  const f = (e.target as HTMLInputElement).files?.[0]
  if (f) mediaFile.value = f
}
const resetMedia = () => { mediaFile.value = null; mediaUrl.value = '' }

const canSubmit = computed(() => !!(mediaFile.value || mediaUrl.value) && !!selectedVoice.value)

const loading = ref(false)
const uploading = ref(false)
const uploadPct = ref(0)

const submit = async () => {
  if (!canSubmit.value) return
  loading.value = true
  uploading.value = true
  uploadPct.value = 15
  try {
    let finalMediaUrl = mediaUrl.value
    if (mediaFile.value) {
      const { file_url } = await uploadSvc.upload(mediaFile.value)
      finalMediaUrl = file_url
    }
    uploadPct.value = 80

    const avatar = await avatarsSvc.create({
      display_name: displayName.value || undefined,
      photo_url: finalMediaUrl,          // сюда теперь может лечь видео или фото
      voice: selectedVoice.value,
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

.upload-progress { display: flex; flex-direction: column; gap: 5px; }
.upload-bar-wrap { height: 3px; background: var(--border); border-radius: 3px; overflow: hidden; }
.upload-bar { height: 100%; background: var(--teal); border-radius: 3px; transition: width .3s; }
.upload-text { font-size: 12px; color: var(--teal); }

.spinner { width: 14px; height: 14px; border: 2px solid rgba(255,255,255,.3); border-top-color: #fff; border-radius: 50%; animation: spin .6s linear infinite; }
@keyframes spin { to { transform: rotate(360deg); } }
</style>