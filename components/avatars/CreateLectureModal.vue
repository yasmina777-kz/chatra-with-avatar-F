<template>
  <div class="overlay" @click.self="$emit('close')">
    <div class="modal anim-scale">
      <div class="modal-head">
        <div class="modal-head-l">
          <div class="modal-ico ico-lec">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="8" r="4"/><path d="M4 21v-1a8 8 0 0116 0v1"/></svg>
          </div>
          <div>
            <div class="modal-title">Создать лекцию аватара</div>
            <div class="modal-sub">Аватар прочитает презентацию вашим голосом</div>
          </div>
        </div>
        <button class="btn btn-icon btn-ghost" @click="$emit('close')">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M18 6L6 18M6 6l12 12"/></svg>
        </button>
      </div>

      <div class="modal-body">
        <div class="info-banner">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><line x1="12" y1="16" x2="12" y2="12"/><line x1="12" y1="8" x2="12.01" y2="8"/></svg>
          <span>Создание лекции расходует платные минуты озвучки и требует одобрения администратора.</span>
        </div>

        <div class="field">
          <label class="field-label">Название лекции *</label>
          <input v-model="title" class="inp" placeholder="Например: Function Approximation" autofocus />
        </div>

        <div class="field">
          <label class="field-label">Материалы (PDF или PPTX) *</label>
          <div v-if="!file" class="file-drop" @click="fileInput?.click()">
            <input type="file" ref="fileInput" style="display:none" accept=".pdf,.pptx" @change="onPick" />
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" class="drop-icon"><path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>
            <span class="drop-text">Загрузите презентацию <strong>(PDF или PPTX)</strong></span>
            <span class="drop-hint">Каждый слайд будет озвучен отдельно</span>
          </div>
          <div v-else class="audio-ready">
            <span class="file-emoji">{{ file.name.endsWith('.pdf') ? '📄' : '📋' }}</span>
            <span class="file-name">{{ file.name }}</span>
            <button class="btn-rm-sm" @click="file = null">Заменить</button>
          </div>
        </div>

        <div class="field">
          <label class="field-label">Длительность</label>
          <div class="duration-grid">
            <button
              v-for="d in durationPresets"
              :key="d"
              :class="['dur-chip', { active: duration === d && !customDuration }]"
              @click="selectDuration(d)"
            >{{ d }} минут</button>
            <button :class="['dur-chip', { active: customDuration }]" @click="customDuration = true">Своё значение</button>
          </div>
          <input
            v-if="customDuration"
            v-model.number="duration"
            type="number"
            min="5"
            max="180"
            class="inp"
            placeholder="Длительность в минутах (5-180)"
          />
        </div>

        <div class="field">
          <label class="field-label">Стиль объяснения</label>
          <div class="style-grid">
            <button
              v-for="s in styleOptions"
              :key="s.value"
              :class="['style-chip', { active: style === s.value }]"
              @click="style = s.value"
            >
              <span class="style-name">{{ s.label }}</span>
              <span class="style-hint">{{ s.hint }}</span>
            </button>
          </div>
        </div>

        <div class="checkbox-row" @click="autoSummary = !autoSummary">
          <div class="checkbox" :class="{ checked: autoSummary }">
            <svg v-if="autoSummary" width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3"><polyline points="20 6 9 17 4 12"/></svg>
          </div>
          <span>Создавать конспект автоматически (показывается студентам после лекции)</span>
        </div>

        <div v-if="uploading" class="upload-progress">
          <div class="upload-bar-wrap"><div class="upload-bar" :style="{ width: uploadPct + '%' }"></div></div>
          <span class="upload-text">{{ uploadStage }}</span>
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

const props = defineProps<{ classId: number }>()
const emit = defineEmits<{ close: []; created: [l: any] }>()

const toast = useToast()
const uploadSvc = useUploadSvc()
const avatarsSvc = useAvatarsSvc()

const title = ref('')
const fileInput = ref<HTMLInputElement | null>(null)
const file = ref<File | null>(null)
const onPick = (e: Event) => {
  const f = (e.target as HTMLInputElement).files?.[0]
  if (f) file.value = f
}

const durationPresets = [20, 40, 60, 80]
const duration = ref(40)
const customDuration = ref(false)
const selectDuration = (d: number) => { duration.value = d; customDuration.value = false }

const styleOptions = [
  { value: 'school', label: 'Школьный', hint: 'Просто, с примерами из жизни' },
  { value: 'university', label: 'Университетский', hint: 'Академический, со структурой' },
  { value: 'professional', label: 'Профессиональный', hint: 'Для экспертной аудитории' },
]
const style = ref('university')

const autoSummary = ref(true)

const canSubmit = computed(() => !!title.value.trim() && !!file.value && duration.value >= 5 && duration.value <= 180)

const loading = ref(false)
const uploading = ref(false)
const uploadPct = ref(0)
const uploadStage = ref('')

const submit = async () => {
  if (!canSubmit.value || !file.value) return
  loading.value = true
  uploading.value = true
  uploadPct.value = 15
  uploadStage.value = 'Загрузка презентации...'
  try {
    const { file_url } = await uploadSvc.upload(file.value)
    uploadPct.value = 60
    uploadStage.value = 'Анализ слайдов...'

    const lecture = await avatarsSvc.createLecture({
      class_id: props.classId,
      title: title.value.trim(),
      source_file_url: file_url,
      source_filename: file.value.name,
      duration_minutes: duration.value,
      style: style.value,
      auto_summary: autoSummary.value,
    })

    uploadPct.value = 100
    toast.ok('Лекция отправлена на одобрение администратору')
    emit('created', lecture)
  } catch (e: any) {
    toast.err(e?.response?.data?.detail || 'Не удалось создать лекцию')
  } finally {
    loading.value = false
    uploading.value = false
  }
}
</script>

<style scoped>
.modal { background: var(--surface); border: 1px solid var(--border2); border-radius: var(--r-2xl); width: 100%; max-width: 600px; max-height: 90vh; display: flex; flex-direction: column; box-shadow: var(--sh-lg); overflow: hidden; }

.modal-head { display: flex; align-items: center; justify-content: space-between; padding: 22px 24px 16px; border-bottom: 1px solid var(--border); flex-shrink: 0; }
.modal-head-l { display: flex; align-items: center; gap: 12px; }
.modal-ico { width: 38px; height: 38px; border-radius: var(--r-md); display: flex; align-items: center; justify-content: center; }
.ico-lec { background: rgba(0,177,201,.12); color: var(--teal); border: 1px solid rgba(0,177,201,.2); }
.modal-title { font-family: 'Outfit',sans-serif; font-size: 16px; font-weight: 800; color: var(--text1); }
.modal-sub { font-size: 12px; color: var(--text4); margin-top: 2px; }

.modal-body { padding: 20px 24px; overflow-y: auto; flex: 1; display: flex; flex-direction: column; gap: 18px; }
.modal-foot { padding: 14px 24px; border-top: 1px solid var(--border); display: flex; justify-content: flex-end; gap: 10px; }

.info-banner { display: flex; align-items: flex-start; gap: 8px; padding: 10px 12px; background: rgba(245,158,11,.08); border: 1px solid rgba(245,158,11,.2); border-radius: var(--r-md); color: #f59e0b; font-size: 12px; line-height: 1.5; }
.info-banner svg { flex-shrink: 0; margin-top: 1px; }

.field { display: flex; flex-direction: column; gap: 8px; }
.field-label { font-size: 11px; font-weight: 700; color: var(--text4); text-transform: uppercase; letter-spacing: .06em; }
.inp { background: var(--surface2); border: 1px solid var(--border); border-radius: var(--r-md); padding: 10px 13px; color: var(--text1); font-size: 13px; width: 100%; transition: border-color .15s; }
.inp:focus { border-color: rgba(0,177,201,.4); }

.file-drop { border: 2px dashed var(--border2); border-radius: var(--r-lg); padding: 20px; display: flex; flex-direction: column; align-items: center; gap: 6px; cursor: pointer; transition: all .18s; text-align: center; }
.file-drop:hover { border-color: rgba(0,177,201,.45); background: rgba(0,177,201,.04); }
.drop-icon { color: var(--text4); }
.drop-text { font-size: 13px; color: var(--text3); }
.drop-text strong { color: var(--teal); }
.drop-hint { font-size: 11px; color: var(--text4); }

.audio-ready { display: flex; align-items: center; gap: 10px; background: var(--surface2); border: 1px solid var(--border); border-radius: var(--r-md); padding: 10px 13px; }
.file-emoji { font-size: 16px; }
.file-name { font-size: 13px; color: var(--text1); flex: 1; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.btn-rm-sm { background: var(--surface3); border: 1px solid var(--border); border-radius: var(--r-md); padding: 6px 12px; font-size: 12px; color: var(--text3); cursor: pointer; transition: all .15s; flex-shrink: 0; }
.btn-rm-sm:hover { background: var(--surface3); color: var(--text1); }

.duration-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 8px; }
.dur-chip { padding: 10px; border-radius: var(--r-md); font-size: 13px; font-weight: 600; color: var(--text3); background: var(--surface2); border: 1px solid var(--border); cursor: pointer; transition: all .15s; text-align: center; }
.dur-chip.active { background: rgba(0,177,201,.1); color: var(--teal); border-color: rgba(0,177,201,.35); }
.dur-chip:hover { border-color: rgba(0,177,201,.3); }

.style-grid { display: flex; flex-direction: column; gap: 8px; }
.style-chip { display: flex; flex-direction: column; gap: 2px; padding: 10px 14px; border-radius: var(--r-md); background: var(--surface2); border: 1px solid var(--border); cursor: pointer; transition: all .15s; text-align: left; }
.style-chip.active { background: rgba(0,177,201,.08); border-color: rgba(0,177,201,.35); }
.style-name { font-size: 13px; font-weight: 700; color: var(--text1); }
.style-chip.active .style-name { color: var(--teal); }
.style-hint { font-size: 11px; color: var(--text4); }

.checkbox-row { display: flex; align-items: center; gap: 10px; cursor: pointer; font-size: 13px; color: var(--text2); }
.checkbox { width: 18px; height: 18px; border-radius: 5px; border: 1.5px solid var(--border2); display: flex; align-items: center; justify-content: center; flex-shrink: 0; transition: all .15s; color: #fff; }
.checkbox.checked { background: var(--teal); border-color: var(--teal); }

.upload-progress { display: flex; flex-direction: column; gap: 5px; }
.upload-bar-wrap { height: 3px; background: var(--border); border-radius: 3px; overflow: hidden; }
.upload-bar { height: 100%; background: var(--teal); border-radius: 3px; transition: width .3s; }
.upload-text { font-size: 12px; color: var(--teal); }

.spinner { width: 14px; height: 14px; border: 2px solid rgba(255,255,255,.3); border-top-color: #fff; border-radius: 50%; animation: spin .6s linear infinite; }
@keyframes spin { to { transform: rotate(360deg); } }
</style>
