export const APP_SHELL_CSS = `
:root {
  --app-bg: #081326;
  --app-fg: #f8fafc;
  --app-muted: #cbd5e1;
  --app-panel: #111f38;
  --app-panel-2: #13233f;
  --app-inset: #0c172b;
  --app-border: #2a4063;
  --app-sidebar: #060d1d;
  --app-brand: #f97316;
  --app-brand-soft: #fdba74;
}

html, body {
  margin: 0;
  min-height: 100%;
  background: var(--app-bg);
  color: var(--app-fg);
  font-family: Arial, Helvetica, sans-serif;
  color-scheme: dark;
}

* { box-sizing: border-box; }

a { color: inherit; text-decoration: none; }

button, input, select, textarea { font: inherit; color: inherit; }

.app-shell {
  display: flex;
  min-height: 100vh;
  background: var(--app-bg);
  color: var(--app-fg);
}

.app-sidebar {
  display: none;
  width: 240px;
  flex-shrink: 0;
  flex-direction: column;
  background: var(--app-sidebar);
  border-right: 1px solid #1c2b45;
  color: #fff;
}

.app-brand {
  display: block;
  margin: 1rem;
  overflow: hidden;
  border: 1px solid #1e3152;
  border-radius: 0.75rem;
  background: linear-gradient(135deg, #1a2d4f, #080f21 60%, #3a1f0d);
  color: #fff;
}

.app-brand-inner { padding: 1rem; }
.app-brand-kicker {
  margin: 0;
  font-size: 10px;
  font-weight: 900;
  letter-spacing: 0.18em;
  text-transform: uppercase;
  color: #fdba74;
}
.app-brand-title {
  margin: 0.25rem 0 0;
  font-size: 1rem;
  font-weight: 900;
}

.app-nav {
  display: grid;
  gap: 0.2rem;
  padding: 0.75rem;
  overflow: auto;
}

.app-nav-link {
  display: flex;
  align-items: center;
  gap: 0.7rem;
  padding: 0.65rem 0.75rem;
  border-left: 2px solid transparent;
  border-radius: 0.4rem;
  color: #e2e8f0;
  font-size: 0.9rem;
  font-weight: 700;
}

.app-nav-link.is-active,
.app-nav-link[aria-current="page"] {
  border-left-color: var(--app-brand);
  background: rgba(249, 115, 22, 0.12);
  color: #fb923c;
}

.app-nav-link:hover { background: #111c31; color: #fff; }

.app-sidebar-foot {
  margin-top: auto;
  padding: 1rem;
  border-top: 1px solid #17243c;
  font-size: 0.8rem;
}

.app-content { flex: 1; min-width: 0; }

.app-mobile-bar {
  display: block;
  padding: 0.85rem 1rem;
  border-bottom: 1px solid #1c2b45;
  background: var(--app-sidebar);
}

.app-mobile-top {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 0.75rem;
}

.app-mobile-nav {
  display: flex;
  flex-wrap: wrap;
  gap: 0.45rem;
  margin-top: 0.75rem;
}

.app-chip {
  display: inline-flex;
  align-items: center;
  padding: 0.3rem 0.7rem;
  border-radius: 999px;
  background: #13213a;
  color: #f8fafc;
  font-size: 0.75rem;
  font-weight: 800;
}

.app-banner {
  padding: 0.75rem 1.25rem;
  border-bottom: 1px solid rgba(249, 115, 22, 0.25);
  background: rgba(249, 115, 22, 0.12);
  color: #fed7aa;
  font-size: 0.875rem;
  font-weight: 700;
}

.app-main { min-height: 100vh; padding: 1.25rem; background: #0b1629; }

.app-page { display: grid; gap: 1.25rem; max-width: 80rem; margin: 0 auto; }

.app-hero { display: grid; gap: 1rem; }
.app-kicker {
  margin: 0;
  font-size: 0.75rem;
  font-weight: 900;
  letter-spacing: 0.2em;
  text-transform: uppercase;
  color: #fdba74;
}
.app-title {
  margin: 0.35rem 0 0;
  font-size: 2rem;
  font-weight: 900;
  color: #fff;
}
.app-copy {
  margin: 0.5rem 0 0;
  max-width: 42rem;
  color: #e2e8f0;
  font-weight: 600;
}

.app-actions { display: flex; flex-wrap: wrap; gap: 0.5rem; }

.app-btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 0.45rem;
  border: 0;
  border-radius: 0.5rem;
  padding: 0.55rem 0.95rem;
  font-size: 0.875rem;
  font-weight: 800;
  cursor: pointer;
}

.app-btn-primary { background: #f97316; color: #0b1220; }
.app-btn-primary:hover { background: #fb923c; }
.app-btn-secondary {
  border: 1px solid #64748b;
  background: #1e293b;
  color: #fff;
}
.app-btn-link {
  border: 0;
  background: transparent;
  color: #fb923c;
  font-weight: 800;
  cursor: pointer;
  padding: 0;
}

.app-grid { display: grid; gap: 0.75rem; }
.app-grid-3 { display: grid; gap: 0.75rem; }
.app-grid-4 { display: grid; gap: 0.75rem; }
.app-grid-2 { display: grid; gap: 1.25rem; }

.app-card,
.app-source,
.app-queue,
.app-panel {
  display: block;
  border: 1px solid var(--app-border);
  border-radius: 0.75rem;
  background: var(--app-panel-2);
  color: inherit;
}

.app-source, .app-queue, .app-panel { background: var(--app-panel); }
.app-source { display: flex; align-items: center; gap: 0.75rem; padding: 1rem; }
.app-queue { padding: 1.1rem; }
.app-panel { overflow: hidden; }
.app-source:hover, .app-queue:hover, .app-card:hover { border-color: #fb923c; }

.app-icon {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 2.75rem;
  height: 2.75rem;
  border-radius: 0.6rem;
  background: var(--app-inset);
  color: #fdba74;
  flex-shrink: 0;
}

.app-label {
  margin: 0;
  font-size: 0.7rem;
  font-weight: 900;
  letter-spacing: 0.06em;
  text-transform: uppercase;
  color: #fed7aa;
}

.app-value {
  margin: 0.4rem 0 0;
  font-size: 1.75rem;
  font-weight: 900;
  color: #fff;
}

.app-badge {
  display: inline-flex;
  align-items: center;
  border-radius: 999px;
  padding: 0.15rem 0.5rem;
  font-size: 11px;
  font-weight: 900;
  text-transform: uppercase;
  background: #334155;
  color: #f8fafc;
}

.app-badge-ok { background: rgba(16, 185, 129, 0.2); color: #a7f3d0; }

.app-panel-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 0.75rem;
  padding: 0.9rem 1.1rem;
  border-bottom: 1px solid var(--app-border);
}

.app-panel-body { padding: 1.1rem; }

.app-row {
  display: block;
  padding: 0.85rem;
  border: 1px solid var(--app-border);
  border-radius: 0.75rem;
  background: var(--app-inset);
  color: inherit;
}

.app-row:hover { border-color: #fb923c; }

@media (min-width: 768px) {
  .app-sidebar {
    display: flex;
    position: sticky;
    top: 0;
    height: 100vh;
  }
  .app-mobile-bar { display: none; }
  .app-grid-4 { grid-template-columns: repeat(2, minmax(0, 1fr)); }
}

@media (min-width: 1024px) {
  .app-grid-3 { grid-template-columns: repeat(3, minmax(0, 1fr)); }
  .app-grid-4 { grid-template-columns: repeat(4, minmax(0, 1fr)); }
  .app-grid-2 { grid-template-columns: 0.8fr 1.7fr; }
  .app-hero {
    grid-template-columns: 1fr auto;
    align-items: end;
  }
  .app-main { padding: 2rem; }
}
`;

export function AppShellStyles() {
  return <style dangerouslySetInnerHTML={{ __html: APP_SHELL_CSS }} />;
}
