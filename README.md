# Basis-Planer für Aftermath (inoffiziell)

3D-Planer für das Bausystem des DayZ-Servers **Aftermath**: Basis außerhalb des Spiels entwerfen, sofort sehen, was sie an Material, Werkzeug, Unterhalt und Raid-Schutz kostet, und in der Ego-Perspektive hindurchlaufen.

## Funktionen

- **Bauen in 3D** mit Einrasten wie im Spiel: Böden an Bodenkanten und auf Wänden darunter, Wände und Türen an Bodenkanten, Halb- und Drittelwände übereinander, Treppen auf Böden, Wendeltreppen übereinander, Palisaden an Palisaden, Fenstergitter an Fensterwänden. Mit `X` schaltest du auf freie Platzierung um.
- **Feinjustieren**: Das Teil in der Hand oder ein ausgewähltes Teil mit den Pfeiltasten (entlang des Bodens, passend zur Blickrichtung) und `Bild↑`/`Bild↓` (Höhe) in 5-cm-Schritten verschieben, mit `Shift` 25 cm, mit `Alt` 1 cm. `Alt`+`Q`/`E` dreht um 1°.
- **Freie Kamera** wie im Noclip: mit der Maus umsehen, `WASD` fliegen, `Leertaste` hoch, `C` oder `Strg` runter, `Shift` schneller.
- **Ebenen** (Erdgeschoss bis Ebene 7, Tasten `0`–`7`). Ebenen über der aktiven lassen sich ausblenden.
- **Regeln aus dem Wiki**: höchstens 15 Türen, Abstand zwischen Türen, Territorium mit 25 m Radius um die Plot Pole, nur eine Plot Pole.
- **Materialliste** mit Kit-Auflösung (Shutter-Türen brauchen ein Garage-Door-Kit). Wahlweise wird bis zu Scrap bzw. Logs heruntergerechnet.
- **Werkzeuge** für die Werkbank, **Crafting-Vorgänge**, **Bedarf pro Ebene** und eine **Einkaufsliste** zum Kopieren.
- **Unterhalt**: Teile pro Kostenkategorie. Die Preise trägst du selbst ein (das Wiki nennt keine).
- **Teile verschieben**: Ein platziertes Teil anklicken und ziehen. Es rastet neu ein, `Q`/`E` drehen, `Esc` bricht ab.
- **Raid-Analyse**: Breaching Charges, Sprit und Zeit mit der Kettensäge für alle Türen und Palisaden.
- **Raid-Pfad**: Loot-Raum markieren. Der Planer sucht den günstigsten Weg von außen (nach Ladungen oder Sprit), zeichnet ihn rot ein und meldet Schwachstellen wie Fenster ohne Gitter oder Wände, über die man klettern kann.
- **Laufmodus** (`V`): WASD, rennen, springen, ducken, hinlegen, Türen öffnen (`F`), No-Clip (`N`). Wände und Decken blockieren.
- **In DayZ ansehen:** Export als `.dze` für den DayZ Editor, mit den echten Aftermath-Klassennamen. Den Bauplatz übernimmst du aus einer Editor-Datei. Über das Pläne-Menü lassen sich Aftermath-Bauteile aus einer `.dze` auch zurück in den Planer importieren.
- **Gebäude aus DayZ** (Haus-Symbol): Ein einzelnes Gebäude aus den eigenen Spieldateien laden (z. B. `DayZ\Addons\structures_residential.pbo`) und darin oder daneben bauen. Die PBO wird nur im Browser gelesen, nichts wird hochgeladen. Türen öffnen sich im Laufmodus, Treppen sind begehbar. Im Plan stehen nur Name und Position des Gebäudes; das Modell wird lokal im Browser zwischengespeichert.
- **Pläne** werden im Browser gespeichert. Du kannst sie als JSON exportieren und importieren, per **Link teilen** (der Plan steckt komprimiert im Link) und als Screenshot speichern.

## Datenquelle

Rezepte, Werkzeuge und Raid-Werte stammen aus dem öffentlichen [Aftermath-Wiki](https://aftermath-gaming.com/wiki), Stand 14.11.2026, und liegen in [`src/data.ts`](src/data.ts). Ändert der Server Rezepte, reicht eine Anpassung dort.

Maße und Öffnungen (Raster 4,46 m, Wandhöhe 2,92 m, Türen, Fenster, Garagen- und Hangartore, rechteckiges Loch bei Porthole und Bodenluke) sind aus den Bauteil-Modellen der Aftermath-Mod ausgemessen. Die Texturen sind im Code nachgebaut und orientieren sich am Spiel; Spieldateien werden nicht mitgeliefert.

Annahmen des Planers:

- Teile-Limit 3000.
- Einige Raid-Werte; sie sind in der App mit `*` markiert.

## Browser

Der Planer braucht **WebGL**. LibreWolf (und Firefox mit `webgl.disabled`) schalten es ab. Die Seite zeigt dann eine Anleitung:

- **LibreWolf:** Einstellungen → LibreWolf → „Enable WebGL“ setzen, oder in `about:config` den Wert `webgl.disabled` auf `false` stellen.
- **Danach** die Seite neu laden.

„Resist Fingerprinting“ stört nicht. Höchstens der Screenshot-Knopf wird dann blockiert.

## Entwicklung

```bash
npm install
npm run dev     # http://localhost:5173
npm run build   # Ausgabe in dist/
```

Vite, TypeScript und Three.js, ohne Backend. Ein Push auf `main` baut die Seite und veröffentlicht sie über GitHub Pages (`.github/workflows/deploy.yml`).

## Hinweis

Fanprojekt ohne Verbindung zu Aftermath Gaming oder Bohemia Interactive. Alle Bauteile und Texturen werden im Code erzeugt. Das Repo und die Seite enthalten keine Spieldateien. Gebäude aus DayZ liest der Planer nur auf Wunsch aus den Spieldateien des Nutzers, lokal im Browser (Lesecode für das Modellformat nach der MIT-lizenzierten Vorlage [rvost/bis-file-formats](https://github.com/rvost/bis-file-formats)).
