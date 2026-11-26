import {
  craftClicks, fmt, matName, materialsFor, raidRows, raidTotals, toolsFor, toRaw, unknownCostParts, upkeepCounts, countByType,
} from './calc';
import { ABANDON_DAYS, DOOR_LIMIT, FUEL_PER_BOTTLE, MAX_LEVEL, TERRITORY_RADIUS } from './constants';
import { BREACHING_CHARGE_COST, CHAINSAW_TEAM_MIN, MATERIALS, PARTS, TOOLS, UPKEEP_CATS, type MatId } from './data';
import type { Settings } from './persist';
import type { Metric, RaidResult, RaidTarget } from './raidpath';
import type { Piece } from './store';

export const esc = (s: string) => s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!);

export const levelName = (l: number) => (l === 0 ? 'Erdgeschoss' : `Ebene ${l}`);

function matList(m: Map<MatId, number>) {
  if (!m.size) return '<div class="info">Noch keine Materialien – platziere Teile aus der Leiste unten.</div>';
  return `<div class="list">${[...m]
    .map(([k, v]) => `<div class="item"><span class="dot" style="background:${MATERIALS[k]?.color ?? '#888'}"></span><span class="name">${esc(matName(k))}</span><span class="qty">${fmt(v)}</span></div>`)
    .join('')}</div>`;
}

export function costLine(id: string) {
  const r = PARTS[id].recipe;
  if (!r) return null;
  return Object.entries(r)
    .map(([k, v]) => `${v} ${PARTS[k] ? PARTS[k].name + ' Kit' : matName(k as MatId)}`)
    .join(' · ');
}

/** Stairs whose exit is covered by a solid floor on the storey above. */
export function blockedStairs(pieces: Piece[]) {
  let n = 0;
  for (const s of pieces) {
    const d = PARTS[s.t];
    if (d.kind !== 'stairs' && d.kind !== 'spiral') continue;
    const above = pieces.find((f) => f.l === s.l + 1 && PARTS[f.t].kind === 'floor' && Math.hypot(f.x - s.x, f.z - s.z) < 0.5);
    if (above && (PARTS[above.t].hole ?? 'none') === 'none') n++;
  }
  return n;
}

export function renderMeters(pieces: Piece[], partLimit: number) {
  const doors = pieces.filter((p) => PARTS[p.t].countsAsDoor).length;
  const pole = pieces.some((p) => PARTS[p.t].kind === 'plotpole');
  const pct = (a: number, b: number) => Math.min(100, (a / b) * 100);
  return `
    <div class="meter"><div class="row"><span>Teile platziert</span><b>${fmt(pieces.length)} <span style="color:var(--dim)">/ ${fmt(partLimit)}</span></b></div>
      <div class="bar ${pieces.length >= partLimit ? 'full' : ''}"><i style="width:${pct(pieces.length, partLimit)}%"></i></div></div>
    <div class="meter"><div class="row"><span>Türen</span><b>${doors} <span style="color:var(--dim)">/ ${DOOR_LIMIT}</span></b></div>
      <div class="bar ${doors >= DOOR_LIMIT ? 'full' : ''}"><i style="width:${pct(doors, DOOR_LIMIT)}%"></i></div></div>
    ${doors >= DOOR_LIMIT ? '<div class="warn">Türlimit erreicht. Entferne eine Tür, um eine weitere zu platzieren.</div>' : ''}
    ${blockedStairs(pieces) ? `<div class="info box">⚠ ${blockedStairs(pieces)} Treppe${blockedStairs(pieces) > 1 ? 'n führen' : ' führt'} gegen eine geschlossene Decke. Setze darüber einen <b>Porthole</b>- oder <b>Floor-Door</b>-Boden.</div>` : ''}
    ${!pole && pieces.length ? `<div class="info box">Noch keine <b>Plot Pole</b>. Ohne sie kannst du im Spiel nicht bauen; erst mit ihr prüft der Planer den ${TERRITORY_RADIUS}-m-Radius.</div>` : ''}`;
}

export function renderMaterials(pieces: Piece[], s: Settings) {
  const mats = toRaw(materialsFor(pieces), { nailsFromScrap: s.rawNails, sheetFromScrap: s.rawSheet, planksFromLogs: s.rawPlanks });
  const unknown = unknownCostParts(pieces);
  const counts = [...countByType(pieces)].sort((a, b) => b[1] - a[1]);
  const tools = toolsFor(pieces);
  return `
    ${matList(mats)}
    <div class="opts">
      <label><input type="checkbox" data-opt="rawNails" ${s.rawNails ? 'checked' : ''}> Nägel als Scrap rechnen (1 → 15)</label>
      <label><input type="checkbox" data-opt="rawSheet" ${s.rawSheet ? 'checked' : ''}> Sheet Metal als Scrap rechnen (6 → 1)</label>
      <label>Planks als Logs <select data-opt="rawPlanks">
        <option value="" ${!s.rawPlanks ? 'selected' : ''}>nein</option>
        <option value="hand" ${s.rawPlanks === 'hand' ? 'selected' : ''}>Säge (4/Log)</option>
        <option value="saw" ${s.rawPlanks === 'saw' ? 'selected' : ''}>Kreissäge (5/Log)</option>
      </select></label>
    </div>
    ${unknown.size ? `<div class="info">Ohne Wiki-Rezept (nicht eingerechnet): ${[...unknown].map(([t, n]) => `${n}× ${esc(PARTS[t].name)}`).join(', ')}.</div>` : ''}
    ${pieces.length ? `<button class="btn" data-act="copy-list" style="width:100%;justify-content:center;margin-top:4px">Einkaufsliste kopieren</button>` : ''}
    <details class="section" ${counts.length && counts.length < 8 ? 'open' : ''}><summary>Teile-Übersicht <span>${counts.length}</span></summary>
      <div class="list">${counts
        .map(([t, n]) => `<div class="item" title="${esc(costLine(t) ?? 'Kosten nicht im Wiki')}"><span class="name">${esc(PARTS[t].name)}</span><span class="sub">${esc(PARTS[t].cat === 'furniture' ? 'Möbel' : '')}</span><span class="qty">${n}×</span></div>`)
        .join('') || '<div class="info">Leer.</div>'}</div>
    </details>
    <details class="section"><summary>Werkzeuge an der Werkbank <span>${tools.size}</span></summary>
      <div class="info">Rezepte zählen nur Werkzeuge in den Werkzeugplätzen der Werkbank, nicht im Inventar.</div>
      <div class="list">${[...tools]
        .map(([t, parts]) => `<div class="item" title="${esc(parts.join(', '))}"><span class="name">${TOOLS[t]}</span><span class="sub">${parts.length} Teil${parts.length > 1 ? 'e' : ''}</span></div>`)
        .join('') || '<div class="info">Keine.</div>'}</div>
      ${pieces.length ? `<div class="info">Ungefähr <b>${craftClicks(pieces)}</b> Crafting-Vorgänge an der Werkbank (max. 10 Stück pro Vorgang). Whetstones in der Werkbank reparieren den Werkzeugverschleiß.</div>` : ''}
    </details>`;
}

export function shoppingText(pieces: Piece[], s: Settings, name: string) {
  const mats = toRaw(materialsFor(pieces), { nailsFromScrap: s.rawNails, sheetFromScrap: s.rawSheet, planksFromLogs: s.rawPlanks });
  const lines = [`Einkaufsliste – ${name}`, ''];
  for (const [k, v] of mats) lines.push(`${fmt(v).padStart(7)}  ${matName(k)}`);
  lines.push('', 'Teile:');
  for (const [t, n] of [...countByType(pieces)].sort((a, b) => b[1] - a[1])) lines.push(`${String(n).padStart(4)}× ${PARTS[t].name}`);
  const tools = [...toolsFor(pieces).keys()].map((t) => TOOLS[t]);
  if (tools.length) lines.push('', 'Werkzeuge an der Werkbank: ' + tools.join(', '));
  return lines.join('\n');
}

export function renderPhases(pieces: Piece[]) {
  if (!pieces.length) return '<div class="info">Leer. Hier siehst du später, was du pro Ebene brauchst – praktisch, um in Etappen zu farmen.</div>';
  const out: string[] = [
    '<div class="info">Reihenfolge im Spiel: Werkbank (von Hand) → Plot Pole → Böden → Wände → Türen mit Codelock. Pro Ebene brauchst du:</div>',
  ];
  for (let l = 0; l <= MAX_LEVEL; l++) {
    const ps = pieces.filter((p) => p.l === l);
    if (!ps.length) continue;
    const m = materialsFor(ps);
    out.push(`<div class="lvl-card"><header><b>${levelName(l)}</b><span>${ps.length} Teile</span></header>
      <div class="chips">${[...m].map(([k, v]) => `<span class="chip">${fmt(v)} ${esc(matName(k))}</span>`).join('') || '<span class="chip">keine Rezeptkosten</span>'}</div></div>`);
  }
  return out.join('');
}

export function renderUpkeep(pieces: Piece[], s: Settings) {
  const counts = upkeepCounts(pieces);
  let total = 0;
  let priced = 0;
  const rows = UPKEEP_CATS.map((c) => {
    const n = counts.get(c.id) ?? 0;
    const price = s.upkeepPrices[c.id] ?? 0;
    total += n * price;
    if (price > 0) priced++;
    return `<tr><td>${c.name}</td><td class="r">${n}</td><td class="r"><input class="num" type="number" min="0" step="1" data-price="${c.id}" value="${price || ''}" placeholder="$/Tag"></td><td class="r">${price ? '$' + fmt(n * price) : '–'}</td></tr>`;
  }).join('');
  return `
    <div class="stats">
      <div class="stat"><b>${priced ? '$' + fmt(total) : '–'}</b><span>pro Tag</span></div>
      <div class="stat"><b>${priced ? '$' + fmt(total * ABANDON_DAYS) : '–'}</b><span>für ${ABANDON_DAYS} Tage</span></div>
    </div>
    <table class="t"><thead><tr><th>Kategorie</th><th class="r">Teile</th><th class="r">Preis/Teil</th><th class="r">Summe</th></tr></thead><tbody>${rows}</tbody></table>
    <div class="info box">Das Wiki nennt keine Preise. Lies sie im Spiel im Territoriumsmenü (<b>J</b>) ab und trage sie hier ein – sie werden lokal gespeichert.</div>
    <div class="info">Bezahlt wird immer die ganze Rechnung, in bar. Nach ${ABANDON_DAYS} Tagen ohne Zahlung wird die Basis aufgegeben: Türen werden zerstört, beim nächsten Restart wird sie gelöscht. Lager kostet mehr als Wände, ein Raid-Alarm am meisten.</div>`;
}

export interface RouteState {
  target: RaidTarget | null;
  metric: Metric;
  result: RaidResult | null;
  picking: boolean;
}

function renderRoute(r: RouteState) {
  const head = `<div class="h">Weg zum Loot-Raum</div>
    <div class="route-bar">
      <button class="btn ${r.picking ? 'primary' : ''}" data-act="raid-pick">${r.picking ? 'Klicke auf den Raum …' : r.target ? 'Ziel neu setzen' : 'Ziel setzen'}</button>
      <select data-opt="raidMetric" title="Wonach optimiert wird">
        <option value="charges" ${r.metric === 'charges' ? 'selected' : ''}>wenigste Ladungen</option>
        <option value="fuel" ${r.metric === 'fuel' ? 'selected' : ''}>wenigster Sprit</option>
      </select>
      ${r.target ? '<button class="tb" data-act="raid-clear" title="Ziel entfernen">✕</button>' : ''}
    </div>`;
  if (!r.target) return head + '<div class="info">Markiere den Raum mit deinem Loot. Der Planer sucht den günstigsten Weg von außen dorthin und zeigt ihn rot in der Ansicht.</div>';
  const res = r.result;
  if (!res || !res.reachable)
    return head + `<div class="info box" style="border-color:rgba(111,207,151,.35);background:rgba(111,207,151,.07);color:#bfe6cf">
      <b>Nicht erreichbar.</b> Ohne eine Wand zu zerstören kommt niemand hinein – und Wände, Böden und Treppen sind auf Aftermath nicht raidbar.</div>`;
  const doors = res.steps.filter((s) => s.kind === 'door' || s.kind === 'palisade');
  const weak = res.steps.filter((s) => s.kind === 'window' || s.kind === 'low');
  return head + `
    <div class="stats">
      <div class="stat"><b>${fmt(res.charges)}</b><span>Ladungen auf dem Weg</span></div>
      <div class="stat"><b>${fmt(res.fuel)}</b><span>Sprit (${(Math.round((res.fuel / FUEL_PER_BOTTLE) * 10) / 10).toLocaleString('de-DE')} Flaschen)</span></div>
    </div>
    ${weak.length ? `<div class="warn" style="margin:0 0 8px">⚠ Schwachstelle: ${weak.map((w) => `${esc(w.name)} (${levelName(w.level)}, ${w.kind === 'window' ? 'Fenster ohne Gitter' : 'überkletterbar'})`).join(', ')}</div>` : ''}
    ${doors.length ? `<div class="list">${doors.map((d, i) => `<div class="item"><span class="sub">${i + 1}.</span><span class="name">${esc(d.name)}</span><span class="sub">${levelName(d.level)}</span><span class="qty">${d.charges}× · ${fmt(d.fuel)}</span></div>`).join('')}</div>` : '<div class="info">Kein einziges Hindernis auf dem Weg – der Raum ist offen zugänglich.</div>'}
    <div class="info">Annahmen: Fenster ohne Gitter sind begehbar, Wände unter 1,6 m überkletterbar, Glas ist nicht zerstörbar, Treppen führen nur durch Portholes, Bodenluken oder offene Decken.</div>`;
}

export function renderRaid(pieces: Piece[], route: RouteState) {
  const rows = raidRows(pieces);
  if (!rows.length)
    return renderRoute(route) + '<div class="info">Noch nichts Raidbares. Auf Aftermath lassen sich nur <b>Türen</b> und <b>Palisaden</b> zerstören – normale Wände, Fenster, Böden und Treppen nicht.</div>';
  const t = raidTotals(rows);
  const weakest = rows[0];
  const anyAssumed = rows.some((r) => r.assumed);
  return renderRoute(route) + `
    <div class="h">Alle raidbaren Teile</div>
    <div class="stats">
      <div class="stat"><b>${fmt(t.charges)}</b><span>Breaching Charges für alles</span></div>
      <div class="stat"><b>${(Math.round(t.bottles * 10) / 10).toLocaleString('de-DE')}</b><span>Sprit-Flaschen (${fmt(t.fuel)})</span></div>
      <div class="stat"><b>${Math.round(t.soloMinutes)} min</b><span>Kettensäge allein</span></div>
      <div class="stat"><b>${esc(weakest.name)}</b><span>schwächster Zugang</span></div>
    </div>
    <table class="t"><thead><tr><th>Teil</th><th class="r">Anz.</th><th class="r">Ladungen</th><th class="r">Sprit</th></tr></thead><tbody>
      ${rows.map((r) => `<tr><td>${esc(r.name)}${r.assumed ? ' <span class="assumed">*</span>' : ''}</td><td class="r">${r.count}</td><td class="r">${r.charges}</td><td class="r">${fmt(r.fuel)}</td></tr>`).join('')}
    </tbody></table>
    ${anyAssumed ? '<div class="info"><span class="assumed">*</span> Wert nicht im Wiki, vom Planer geschätzt (wie die nächstähnliche Tür; Palisade ≈ 1/10 einer Holztür).</div>' : ''}
    <div class="h">Eine Breaching Charge kostet</div>
    <div class="chips">${BREACHING_CHARGE_COST.map(([n, q]) => `<span class="chip">${q} ${n}</span>`).join('')}</div>
    <div class="info">Für alle Türen: ${BREACHING_CHARGE_COST.map(([n, q]) => `${fmt(q * t.charges)} ${n}`).join(', ')}. Zünder 5 min, mit Pliers entschärfbar.</div>
    <div class="h">Kettensäge im Team (pro Tür)</div>
    <table class="t"><thead><tr><th>Sägen</th><th class="r">Holz</th><th class="r">Cinder</th></tr></thead><tbody>
      ${Object.entries(CHAINSAW_TEAM_MIN).map(([n, v]) => `<tr><td>${n}</td><td class="r">${String(v.wood).replace('.', ',')} min</td><td class="r">${String(v.cinder).replace('.', ',')} min</td></tr>`).join('')}
    </tbody></table>
    <div class="info">Eine Flasche hält ${fmt(FUEL_PER_BOTTLE)} Einheiten (≈ 10 min Sägen). Jede zerstörte Tür löst 30 min Raid-Block aus.</div>`;
}
