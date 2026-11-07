import { saveSettings, settings } from '../store';
import { $, esc } from '../util';

export function mount(root: HTMLElement): () => void {
  const s = settings();
  root.innerHTML = `<div class="page"><div class="page-head"><h1>Instellingen</h1></div><section class="card">
    <h3>Je accounts</h3>
    <label>Chess.com gebruikersnaam <input id="cc" value="${esc(s.chesscom)}" /></label>
    <label>Lichess gebruikersnaam <input id="li" value="${esc(s.lichess)}" /></label>
    <label>Standaard analysediepte <select id="dp">${[12, 14, 16, 18, 20].map((d) => `<option ${d === s.depth ? 'selected' : ''}>${d}</option>`).join('')}</select></label>
    <button class="primary" id="save">Opslaan</button> <span id="m" class="muted"></span>
    <p class="muted">Met je gebruikersnaam wordt het bord automatisch vanuit jouw kleur getoond.</p>
  </section>
  <section class="card"><h3>Back-up</h3>
    <p class="muted">Alles (repertoire, puzzels, analyses) staat in je browser. Maak af en toe een back-up.</p>
    <button id="exp">Exporteer naar bestand</button>
    <input type="file" id="imp" accept=".json" />
  </section></div>`;
  $(root, '#save').onclick = () => {
    saveSettings({
      chesscom: ($(root, '#cc') as HTMLInputElement).value.trim(),
      lichess: ($(root, '#li') as HTMLInputElement).value.trim(),
      depth: +($(root, '#dp') as HTMLSelectElement).value,
    });
    $(root, '#m').textContent = 'Opgeslagen ✓';
  };
  $(root, '#exp').onclick = () => {
    const data: Record<string, string> = {};
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i)!;
      if (k.startsWith('rc.')) data[k] = localStorage.getItem(k)!;
    }
    const a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob([JSON.stringify(data)], { type: 'application/json' }));
    a.download = 'rutger-schaak-backup.json';
    a.click();
  };
  $(root, '#imp').onchange = async (e) => {
    const f = (e.target as HTMLInputElement).files?.[0];
    if (!f) return;
    const data = JSON.parse(await f.text()) as Record<string, string>;
    for (const [k, v] of Object.entries(data)) if (k.startsWith('rc.')) localStorage.setItem(k, v);
    $(root, '#m').textContent = 'Back-up teruggezet ✓';
  };
  return () => {};
}
