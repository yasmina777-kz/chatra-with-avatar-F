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
            <div class="modal-sub">3D-аватар будет читать лекции выбранным голосом</div>
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

        <!-- Шаг 1: выбрать аватара из библиотеки -->
        <div class="field">
          <label class="field-label"><span class="step-badge">1</span> Выберите аватара</label>
          <div class="avatar-gallery">
            <button
              v-for="a in AVATAR_LIBRARY"
              :key="a.id"
              class="gallery-card"
              :class="{ active: selectedLibraryId === a.id }"
              type="button"
              @click="pickFromLibrary(a)"
            >
              <div class="gallery-thumb">
                <img v-if="a.preview" :src="a.preview" :alt="a.name" />
                <VrmAvatar v-else :vrm-url="a.url" :speaking="false" />
              </div>
              <span class="gallery-name">{{ a.name }}</span>
            </button>
          </div>

          <!-- Живой 3D-превью выбранного -->
          <div v-if="previewUrl" class="vrm-preview">
            <VrmAvatar :vrm-url="previewUrl" :speaking="false" />
          </div>

          <!-- Свой файл -->
          <div class="own-file-row">
            <input type="file" ref="vrmInput" style="display:none" accept=".vrm" @change="onVrmPick" />
            <button class="btn-own" type="button" @click="vrmInput?.click()">
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/></svg>
              Загрузить свой .vrm
            </button>
            <span v-if="vrmFile" class="own-file-name">{{ vrmFile.name }}</span>
            <a href="https://vroid.com/en/studio" target="_blank" rel="noopener" class="link-teal own-hint">
              Создать свою модель
            </a>
          </div>
        </div>

        <!-- Выбор голоса Azure -->
        <div class="field">
          <label class="field-label"><span class="step-badge">2</span> Голос аватара *</label>
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
import VrmAvatar from './VrmAvatar.vue'

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

// ── Библиотека готовых аватаров ────────────────────────────────
// Файлы .vrm лежат в public/avatars/, превью-картинки (опционально) — там же.
const AVATAR_LIBRARY = [
  { id: 'allo21',   name: 'Алло',            url: '/avatars/allo21.vrm',   preview: '' },
  { id: 'teacher1', name: 'Преподаватель 1', url: '/avatars/teacher2.vrm', preview: '' },
  // Добавляй сюда следующих преподавателей:
  // { id: 'teacher2', name: 'Айгерим', url: '/avatars/teacher2.vrm', preview: '/avatars/teacher2.png' },
]

const selectedLibraryId = ref<string | null>(null)
const selectedLibraryUrl = ref<string>('')

const vrmInput = ref<HTMLInputElement | null>(null)
const vrmFile = ref<File | null>(null)

const pickFromLibrary = (a: { id: string; url: string }) => {
  selectedLibraryId.value = a.id
  selectedLibraryUrl.value = a.url
  vrmFile.value = null            // выбор из библиотеки отменяет свой файл
}

const onVrmPick = (e: Event) => {
  const f = (e.target as HTMLInputElement).files?.[0]
  if (f) {
    vrmFile.value = f
    selectedLibraryId.value = null // свой файл отменяет выбор из библиотеки
    selectedLibraryUrl.value = ''
  }
}

// живой превью: свой файл (blob) или модель из библиотеки
const previewUrl = computed(() =>
  vrmFile.value ? URL.createObjectURL(vrmFile.value) : selectedLibraryUrl.value || ''
)

const canSubmit = computed(() => (!!vrmFile.value || !!selectedLibraryUrl.value) && !!selectedVoice.value)

const loading = ref(false)
const uploading = ref(false)
const uploadPct = ref(0)

const submit = async () => {
  if (!canSubmit.value) return
  loading.value = true
  uploading.value = true
  uploadPct.value = 15
  try {
    let finalVrmUrl: string | undefined = selectedLibraryUrl.value || undefined
    if (vrmFile.value) {
      const { file_url } = await uploadSvc.upload(vrmFile.value)
      finalVrmUrl = file_url
    }
    uploadPct.value = 85

    const avatar = await avatarsSvc.create({
      display_name: displayName.value || undefined,
      voice: selectedVoice.value,
      vrm_url: finalVrmUrl,
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

.avatar-gallery { display: grid; grid-template-columns: repeat(auto-fill, minmax(104px, 1fr)); gap: 10px; }
.gallery-card { background: var(--surface2); border: 2px solid var(--border); border-radius: var(--r-lg); padding: 8px 6px; cursor: pointer; display: flex; flex-direction: column; align-items: center; gap: 6px; transition: all .15s; }
.gallery-card:hover { border-color: rgba(0,177,201,.45); }
.gallery-card.active { border-color: var(--teal); background: rgba(0,177,201,.08); }
.gallery-thumb { width: 100%; aspect-ratio: 1; border-radius: var(--r-md); overflow: hidden; background: var(--surface3); display: flex; align-items: center; justify-content: center; pointer-events: none; }
.gallery-thumb img { width: 100%; height: 100%; object-fit: cover; }
.gallery-thumb-ph { font-size: 26px; }
.gallery-name { font-size: 11px; font-weight: 600; color: var(--text2); }

.vrm-preview { height: 200px; margin-top: 10px; border: 1px solid var(--border); border-radius: var(--r-lg); background: var(--surface2); overflow: hidden; }

.own-file-row { display: flex; align-items: center; gap: 10px; margin-top: 10px; flex-wrap: wrap; }
.btn-own { display: inline-flex; align-items: center; gap: 6px; padding: 7px 12px; border-radius: var(--r-md); background: var(--surface2); border: 1px solid var(--border); color: var(--text2); font-size: 12px; font-weight: 600; cursor: pointer; transition: all .15s; }
.btn-own:hover { background: var(--surface3); color: var(--text1); }
.own-file-name { font-size: 12px; color: var(--teal); }
.own-hint { font-size: 11px; margin-left: auto; }

.step-card { background: var(--surface2); border: 1px solid var(--border); border-radius: var(--r-lg); padding: 14px 16px; }
.step-row { display: flex; gap: 12px; align-items: flex-start; }
.step-num { width: 24px; height: 24px; border-radius: 50%; background: var(--teal); color: #fff; font-size: 12px; font-weight: 800; display: flex; align-items: center; justify-content: center; flex-shrink: 0; }
.step-body { flex: 1; }
.step-title { font-size: 13px; font-weight: 700; color: var(--text1); }
.step-sub { font-size: 12px; color: var(--text4); margin: 3px 0 10px; line-height: 1.5; }
.step-badge { display: inline-flex; align-items: center; justify-content: center; width: 17px; height: 17px; border-radius: 50%; background: var(--teal); color: #fff; font-size: 10px; font-weight: 800; margin-right: 5px; }
.btn-open-creator { display: inline-flex; align-items: center; gap: 7px; padding: 8px 14px; border-radius: var(--r-md); background: var(--teal); color: #fff; font-size: 12px; font-weight: 700; text-decoration: none; transition: opacity .15s; }
.btn-open-creator:hover { opacity: .88; }

.link-teal { color: var(--teal); text-decoration: underline; }
.file-name { font-size: 13px; color: var(--text1); flex: 1; }

.upload-progress { display: flex; flex-direction: column; gap: 5px; }
.upload-bar-wrap { height: 3px; background: var(--border); border-radius: 3px; overflow: hidden; }
.upload-bar { height: 100%; background: var(--teal); border-radius: 3px; transition: width .3s; }
.upload-text { font-size: 12px; color: var(--teal); }

.spinner { width: 14px; height: 14px; border: 2px solid rgba(255,255,255,.3); border-top-color: #fff; border-radius: 50%; animation: spin .6s linear infinite; }
@keyframes spin { to { transform: rotate(360deg); } }
</style>