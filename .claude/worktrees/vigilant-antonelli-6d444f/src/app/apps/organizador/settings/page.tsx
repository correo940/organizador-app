'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Input } from '@/components/ui/input';
import { ArrowLeft, Check, Save } from 'lucide-react';
import { toast } from 'sonner';
import {
  getSecretarySettings, saveSecretarySettings, SECRETARY_AVATARS,
  DEFAULT_SECRETARY_SETTINGS, PERSONALITY_TEXTS,
  type SecretarySettings, type SecretaryPersonality, type SecretaryAvatarId
} from '@/lib/secretary-settings';

// ─── Secretary Settings Page ───────────────────────────────────────────────────

const PERSONALITIES: { id: SecretaryPersonality; label: string; emoji: string; desc: string }[] = [
  { id: 'friendly', label: 'Amistosa', emoji: '😊', desc: 'Cálida, cercana y motivadora.' },
  { id: 'formal', label: 'Formal', emoji: '💼', desc: 'Profesional y directa al grano.' },
  { id: 'sergeant', label: 'Sargento', emoji: '🎖️', desc: 'Sin rodeos. Hazte cargo.' },
];

export default function SecretarySettingsPage() {
  const router = useRouter();
  const [settings, setSettings] = useState<SecretarySettings>(DEFAULT_SECRETARY_SETTINGS);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    setSettings(getSecretarySettings());
  }, []);

  const update = (patch: Partial<SecretarySettings>) =>
    setSettings(prev => ({ ...prev, ...patch }));

  const updateModule = (key: keyof SecretarySettings['modules'], val: boolean) =>
    setSettings(prev => ({ ...prev, modules: { ...prev.modules, [key]: val } }));

  const updateWeeklySync = (patch: Partial<SecretarySettings['weeklySync']>) =>
    setSettings(prev => ({ ...prev, weeklySync: { ...prev.weeklySync, ...patch } }));

  const updateMonthlySync = (patch: Partial<SecretarySettings['monthlySync']>) =>
    setSettings(prev => ({ ...prev, monthlySync: { ...prev.monthlySync, ...patch } }));

  const handleSave = () => {
    saveSecretarySettings(settings);
    // Trigger notification reschedule
    window.dispatchEvent(new Event('secretarySettingsChanged'));
    toast.success('Ajustes guardados');
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  return (
    <div className="min-h-screen bg-background text-foreground flex flex-col">

      {/* Header */}
      <div className="flex items-center gap-3 p-4 border-b border-border">
        <button onClick={() => router.back()} className="text-muted-foreground hover:text-foreground transition-colors">
          <ArrowLeft className="w-5 h-5" />
        </button>
        <h1 className="font-bold flex-1">Configurar Organizador</h1>
        <Button
          size="sm"
          onClick={handleSave}
          className={`rounded-xl transition-all ${saved ? 'bg-green-500 hover:bg-green-800 text-white' : ''}`}
        >
          {saved ? <Check className="w-4 h-4 mr-1.5" /> : <Save className="w-4 h-4 mr-1.5" />}
          {saved ? 'Guardado' : 'Guardar'}
        </Button>
      </div>

      <div className="flex-1 overflow-y-auto p-5 space-y-7">

        {/* Enable / Disable */}
        <Section title="Estado" emoji="🔌">
          <Toggle
            label="Organizador activo"
            sub="Activa el asistente y sus notificaciones"
            value={settings.enabled}
            onChange={v => update({ enabled: v })}
          />
        </Section>

        {/* Avatar */}
        <Section title="Asistente" emoji="🤖">
          <div className="space-y-4">

            <div className="grid grid-cols-2 gap-2">
              {SECRETARY_AVATARS.map(avatar => (
                <button
                  key={avatar.id}
                  onClick={() => update({ avatarId: avatar.id as SecretaryAvatarId })}
                  className={`flex items-center gap-3 p-3 rounded-xl border transition-all text-left ${settings.avatarId === avatar.id
                    ? 'bg-green-500/10 border-green-500/50'
                    : 'bg-muted/50 border-border hover:bg-muted'
                    }`}
                >
                  <span className="text-2xl">{avatar.emoji}</span>
                  <div>
                    <p className="text-sm font-semibold">{avatar.label}</p>
                    <p className="text-muted-foreground text-xs">{avatar.description}</p>
                  </div>
                  {settings.avatarId === avatar.id && (
                    <Check className="w-4 h-4 text-green-500 dark:text-green-400 ml-auto flex-shrink-0" />
                  )}
                </button>
              ))}
            </div>
          </div>
        </Section>

        {/* Personality */}
        <Section title="Personalidad" emoji="🎭">
          <div className="space-y-2">
            {PERSONALITIES.map(p => (
              <button
                key={p.id}
                onClick={() => update({ personality: p.id })}
                className={`w-full flex items-center gap-3 p-4 rounded-xl border transition-all text-left ${settings.personality === p.id
                  ? 'bg-green-500/10 border-green-500/50'
                  : 'bg-muted/50 border-border hover:bg-muted'
                  }`}
              >
                <span className="text-2xl">{p.emoji}</span>
                <div className="flex-1">
                  <p className="font-semibold text-sm">{p.label}</p>
                  <p className="text-muted-foreground text-xs">{p.desc}</p>
                </div>
                {settings.personality === p.id && (
                  <Check className="w-4 h-4 text-green-500 dark:text-green-400 flex-shrink-0" />
                )}
              </button>
            ))}
          </div>
        </Section>

        {/* Schedule — Daily */}
        <Section title="Horarios diarios" emoji="⏰">
          <div className="space-y-4">
            <TimeField
              label="Sync nocturno"
              sub="Cuándo planificas el día siguiente"
              emoji="🌙"
              value={settings.syncTime}
              onChange={v => update({ syncTime: v })}
            />
            <TimeField
              label="Briefing matutino"
              sub="Cuándo recibes el resumen del día"
              emoji="☀️"
              value={settings.briefingTime}
              onChange={v => update({ briefingTime: v })}
            />
          </div>
        </Section>

        {/* Schedule — Weekly */}
        <Section title="Sync semanal" emoji="📅">
          <Toggle
            label="Activar sync semanal"
            sub="Revisión de los próximos 7 días"
            value={settings.weeklySync?.enabled ?? false}
            onChange={v => updateWeeklySync({ enabled: v })}
          />
          {settings.weeklySync?.enabled && (
            <div className="space-y-3 mt-2">
              <div className="flex items-center justify-between p-3 rounded-xl bg-muted/50 border border-border">
                <div className="flex items-center gap-2.5">
                  <span>📆</span>
                  <div>
                    <p className="text-sm font-medium">Día de la semana</p>
                    <p className="text-muted-foreground text-xs">¿Cuándo haces la revisión semanal?</p>
                  </div>
                </div>
                <select
                  value={settings.weeklySync?.dayOfWeek ?? 0}
                  onChange={e => updateWeeklySync({ dayOfWeek: Number(e.target.value) })}
                  className="bg-muted border border-border text-foreground rounded-xl text-sm px-2 py-1 focus:outline-none focus:border-green-500"
                >
                  {['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado'].map((d, i) => (
                    <option key={i} value={i} className="bg-background">{d}</option>
                  ))}
                </select>
              </div>
              <TimeField
                label="Hora del sync semanal"
                sub="Hora en que se dispara la notificación"
                emoji="🕙"
                value={settings.weeklySync?.time ?? '21:00'}
                onChange={v => updateWeeklySync({ time: v })}
              />
            </div>
          )}
        </Section>

        {/* Schedule — Monthly */}
        <Section title="Sync mensual" emoji="📆">
          <Toggle
            label="Activar sync mensual"
            sub="Resumen y planificación al inicio de mes"
            value={settings.monthlySync?.enabled ?? false}
            onChange={v => updateMonthlySync({ enabled: v })}
          />
          {settings.monthlySync?.enabled && (
            <div className="space-y-3 mt-2">
              <div className="flex items-center justify-between p-3 rounded-xl bg-muted/50 border border-border">
                <div className="flex items-center gap-2.5">
                  <span>🗓️</span>
                  <div>
                    <p className="text-sm font-medium">Día del mes</p>
                    <p className="text-muted-foreground text-xs">¿Qué día del mes haces la revisión?</p>
                  </div>
                </div>
                <input
                  type="number" min={1} max={28}
                  value={settings.monthlySync?.dayOfMonth ?? 1}
                  onChange={e => updateMonthlySync({ dayOfMonth: Number(e.target.value) })}
                  className="w-16 bg-muted border border-border text-foreground text-center rounded-xl text-sm px-2 py-1 focus:outline-none focus:border-green-500"
                />
              </div>
              <TimeField
                label="Hora del sync mensual"
                sub="Hora en que se dispara la notificación"
                emoji="🕙"
                value={settings.monthlySync?.time ?? '21:00'}
                onChange={v => updateMonthlySync({ time: v })}
              />
            </div>
          )}
        </Section>

        {/* Modules */}
        <Section title="Módulos activos" emoji="🧩">
          <div className="space-y-1">
            <Toggle label="Agenda & Turnos" sub="Turnos de trabajo y tareas" emoji="💼"
              value={settings.modules.shifts} onChange={v => updateModule('shifts', v)} />
            <Toggle label="Tareas" sub="Lista de tareas pendientes" emoji="✅"
              value={settings.modules.tasks} onChange={v => updateModule('tasks', v)} />
            <Toggle label="Lista de compra" sub="Ítems pendientes de comprar" emoji="🛒"
              value={settings.modules.shopping} onChange={v => updateModule('shopping', v)} />
            <Toggle label="Finanzas" sub="Saldo y control de gastos" emoji="💶"
              value={settings.modules.finances} onChange={v => updateModule('finances', v)} />
            <Toggle label="Medicación" sub="Tomas y recordatorios de salud" emoji="💊"
              value={settings.modules.medicines} onChange={v => updateModule('medicines', v)} />
          </div>
        </Section>

        {/* Preview */}
        <Section title="Vista previa de mensajes" emoji="💬">
          {(() => {
            const avatar = SECRETARY_AVATARS.find(a => a.id === settings.avatarId) ?? SECRETARY_AVATARS[0];
            const texts = PERSONALITY_TEXTS[settings.personality];
            return (
              <div className="space-y-2">
                <PreviewBubble emoji={avatar.emoji} text={texts.syncWelcome('Usuario')} label="Sync" color="indigo" />
                <PreviewBubble emoji={avatar.emoji} text={texts.briefingGreeting('Usuario')} label="Briefing" color="amber" />
                <PreviewBubble emoji={avatar.emoji} text={texts.victoriesPrompt} label="Victorias" color="yellow" />
              </div>
            );
          })()}
        </Section>

        <div className="h-4" />
      </div>
    </div>
  );
}

// ── Helpers ────────────────────────────────────────────────────────────────────

function Section({ title, emoji, children }: { title: string; emoji: string; children: React.ReactNode }) {
  return (
    <div className="space-y-3">
      <p className="text-xs font-bold uppercase tracking-widest text-muted-foreground/50 flex items-center gap-1.5">
        <span>{emoji}</span>{title}
      </p>
      {children}
    </div>
  );
}

function Toggle({ label, sub, emoji, value, onChange }: {
  label: string; sub?: string; emoji?: string; value: boolean; onChange: (v: boolean) => void;
}) {
  return (
    <div className="flex items-center justify-between p-3 rounded-xl bg-muted/50 border border-border">
      <div className="flex items-center gap-2.5">
        {emoji && <span>{emoji}</span>}
        <div>
          <p className="text-sm font-medium">{label}</p>
          {sub && <p className="text-muted-foreground text-xs">{sub}</p>}
        </div>
      </div>
      <Switch
        checked={value}
        onCheckedChange={onChange}
        className="data-[state=checked]:bg-green-500"
      />
    </div>
  );
}

function TimeField({ label, sub, emoji, value, onChange }: {
  label: string; sub: string; emoji: string; value: string; onChange: (v: string) => void;
}) {
  return (
    <div className="flex items-center justify-between p-3 rounded-xl bg-muted/50 border border-border">
      <div className="flex items-center gap-2.5">
        <span>{emoji}</span>
        <div>
          <p className="text-sm font-medium">{label}</p>
          <p className="text-muted-foreground text-xs">{sub}</p>
        </div>
      </div>
      <Input
        type="time"
        value={value}
        onChange={e => onChange(e.target.value)}
        className="w-24 bg-muted border-border text-foreground text-center rounded-xl text-sm p-1 h-8 focus-visible:ring-green-500"
      />
    </div>
  );
}

function PreviewBubble({ emoji, text, label, color }: {
  emoji: string; text: string; label: string;
  color: 'indigo' | 'amber' | 'yellow';
}) {
  const colorMap = {
    indigo: 'bg-green-500/10 border-green-500/20 text-green-800 dark:text-green-400',
    amber: 'bg-amber-500/10 border-amber-500/20 text-amber-600 dark:text-amber-400',
    yellow: 'bg-yellow-500/10 border-yellow-500/20 text-yellow-600 dark:text-yellow-400',
  };
  return (
    <div className={`p-3 rounded-xl border ${colorMap[color]} text-sm`}>
      <div className="flex items-start gap-2">
        <span className="text-lg flex-shrink-0">{emoji}</span>
        <div>
          <Badge className="text-[9px] mb-1 bg-muted/50 text-muted-foreground border-border">{label}</Badge>
          <p>"{text}"</p>
        </div>
      </div>
    </div>
  );
}

