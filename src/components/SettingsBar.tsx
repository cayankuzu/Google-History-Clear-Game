import type { GameSettings } from "../types/game";

type SettingsBarProps = {
  settings: GameSettings;
  onChange: (settings: GameSettings) => void;
  compact?: boolean;
};

export function SettingsBar({
  settings,
  onChange,
  compact = false,
}: SettingsBarProps) {
  return (
    <div className={`settings-bar ${compact ? "is-compact" : ""}`}>
      <button
        type="button"
        aria-pressed={settings.sound}
        onClick={() => onChange({ ...settings, sound: !settings.sound })}
      >
        <span aria-hidden="true">{settings.sound ? "◖))" : "◖×"}</span>
        {settings.sound ? "Ses açık" : "Ses kapalı"}
      </button>
    </div>
  );
}
