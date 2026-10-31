import { useEffect, useState } from 'react';
import { exportAll, importAll, loadSettings, localDateKey, resetAll, saveSettings } from '../storage/repo';

export default function Settings() {
  const [key, setKey] = useState('');
  const [status, setStatus] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    loadSettings()
      .then((s) => alive && setKey(s.usdaKey ?? ''))
      .catch((e: unknown) => console.error('Failed to load settings', e));
    return () => {
      alive = false;
    };
  }, []);

  const report = (ok: string | null, err: string | null = null) => {
    setStatus(ok);
    setError(err);
  };

  const onExport = async () => {
    try {
      const data = await exportAll();
      const url = URL.createObjectURL(new Blob([JSON.stringify(data, null, 1)], { type: 'application/json' }));
      const a = document.createElement('a');
      a.href = url;
      a.download = `diettracker-${localDateKey(new Date())}.json`;
      a.click();
      // iOS Safari reads the blob after click() returns; revoking at once can cancel the download.
      setTimeout(() => URL.revokeObjectURL(url), 30_000);
      report('Backup downloaded');
    } catch (e) {
      console.error('Backup export failed', e);
      report(null, 'Could not create the backup.');
    }
  };

  const onImport = async (file: File | undefined) => {
    if (!file) return;
    try {
      await importAll(JSON.parse(await file.text()));
      report('Backup restored');
    } catch (e) {
      console.warn('Backup import failed', e);
      report(null, e instanceof SyntaxError ? 'That file is not a backup (invalid JSON)' : (e as Error).message);
    }
  };

  return (
    <>
      <h1>Settings</h1>

      <form
        className="card"
        onSubmit={(e) => {
          e.preventDefault();
          saveSettings({ usdaKey: key.trim() || null })
            .then(() => report('Key saved'))
            .catch((e: unknown) => {
              console.error('Failed to save settings', e);
              report(null, 'Could not save the key.');
            });
        }}
      >
        <h2>Food search</h2>
        <label className="manual__field">
          USDA API key
          <input value={key} onChange={(e) => setKey(e.target.value)} autoComplete="off" spellCheck={false} />
        </label>
        <p className="muted">
          Free, and lifts the shared demo limit.{' '}
          <a href="https://fdc.nal.usda.gov/api-key-signup" target="_blank" rel="noreferrer">
            Get a key
          </a>
          . It is stored only on this phone.
        </p>
        <button type="submit" className="btn btn--primary">
          Save key
        </button>
      </form>

      <section className="card">
        <h2>Backup</h2>
        <p className="muted">Your data lives only on this phone. Export a backup now and then.</p>
        <div className="sheet__actions">
          <button type="button" className="btn" onClick={() => void onExport()}>
            Export backup
          </button>
          <label className="btn file-btn">
            Import backup
            <input
              type="file"
              accept="application/json,.json"
              aria-label="Import backup"
              onChange={(e) => {
                void onImport(e.target.files?.[0]);
                e.target.value = '';
              }}
            />
          </label>
        </div>
      </section>

      <section className="card">
        <h2>Reset</h2>
        <button
          type="button"
          className="btn btn--danger"
          onClick={() => {
            if (window.confirm('Delete all days and restore the original plan? Export a backup first if unsure.')) {
              resetAll()
                .then(() => window.location.reload())
                .catch((e: unknown) => {
                  console.error('Reset failed', e);
                  report(null, 'Could not reset your data.');
                });
            }
          }}
        >
          Reset all data
        </button>
      </section>

      {status && (
        <p role="status" className="toast">
          {status}
        </p>
      )}
      {error && (
        <p role="alert" className="error">
          {error}
        </p>
      )}
    </>
  );
}
