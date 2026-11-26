# Basis-Planer für Aftermath (inoffiziell)

3D-Planer für das Bausystem des DayZ-Servers **Aftermath**: Basis außerhalb des Spiels entwerfen, sofort sehen, was sie an Material, Werkzeug, Unterhalt und Raid-Schutz kostet, und in der Ego-Perspektive hindurchlaufen.

## Funktionen

- **Bauen in 3D** mit Einrasten wie im Spiel: Böden an Bodenkanten und auf Wänden darunter, Wände und Türen an Bodenkanten, Halb- und Drittelwände übereinander, Treppen auf Böden, Wendeltreppen übereinander, Palisaden an Palisaden, Fenstergitter an Fensterwänden. Mit `X` schaltest du auf freie Platzierung um.
- **Ebenen** (Erdgeschoss bis Ebene 7). Ebenen über der aktiven lassen sich ausblenden.
- **Regeln aus dem Wiki**: höchstens 15 Türen, Abstand zwischen Türen, Territorium mit 25 m Radius um die Plot Pole, nur eine Plot Pole.
- **Materialliste** mit Kit-Auflösung (Shutter-Türen brauchen ein Garage-Door-Kit). Wahlweise wird bis zu Scrap bzw. Logs heruntergerechnet.
- **Werkzeuge** für die Werkbank, **Crafting-Vorgänge**, **Bedarf pro Ebene** und eine **Einkaufsliste** zum Kopieren.
- **Unterhalt**: Teile pro Kostenkategorie. Die Preise trägst du selbst ein (das Wiki nennt keine).
- **Raid-Analyse**: Breaching Charges, Sprit und Zeit mit der Kettensäge für alle Türen und Palisaden.
- **Laufmodus** (`V`): WASD, rennen, springen, ducken, hinlegen, Türen öffnen (`F`), No-Clip (`N`).
- **Pläne** werden im Browser gespeichert. Du kannst sie als JSON exportieren und importieren, per **Link teilen** (der Plan steckt komprimiert im Link) und als Screenshot speichern.

## Datenquelle

Rezepte, Werkzeuge und Raid-Werte stammen aus dem öffentlichen [Aftermath-Wiki](https://aftermath-gaming.com/wiki), Stand 14.11.2026, und liegen in [`src/data.ts`](src/data.ts). Ändert der Server Rezepte, reicht eine Anpassung dort.

Annahmen des Planers:

- 3-m-Raster und 3 m pro Ebene, weil das Wiki keine Maße nennt.
- Teile-Limit 3000.
- Einige Raid-Werte; sie sind in der App mit `*` markiert.

## Entwicklung

```bash
npm install
npm run dev     # http://localhost:5173
npm run build   # Ausgabe in dist/
```

Vite, TypeScript und Three.js, ohne Backend. Ein Push auf `main` baut die Seite und veröffentlicht sie über GitHub Pages (`.github/workflows/deploy.yml`).

## Hinweis

Fanprojekt ohne Verbindung zu Aftermath Gaming oder Bohemia Interactive. Alle Modelle und Texturen werden im Code erzeugt, es werden keine Spieldateien verwendet.
