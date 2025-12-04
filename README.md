# BlockBlast

Ein kleines Browser-Block-Breakout-Spiel (Vanilla JS + Canvas). Fertig zum Hochladen auf GitHub und Veröffentlichen via GitHub Pages.

**Features**
- Paddle, Ball, mehrere Brick-Reihen
- Level-Fortschritt (mehr Reihen pro Level)
- Score, Lives, HUD
- Pause / Restart
- Responsive Canvas (skaliert zur Breite)
- Keine externen Abhängigkeiten — läuft überall (Chrome, Firefox, Edge)

## Dateien
- `index.html` — Spielseite
- `style.css` — Styling
- `game.js` — Spiel-Logik
- `README.md` — dieses File

## Deployment (GitHub Pages)
1. Erstelle ein neues Repository (z. B. `blockblast`).
2. Füge die Dateien (`index.html`, `style.css`, `game.js`, `README.md`) in den `main` Branch.
3. In GitHub: `Settings` → `Pages` → wähle Branch `main` und root `/` → Save.
4. Nach kurzer Zeit ist die Seite verfügbar unter `https://<dein-username>.github.io/<repo-name>/`.

## Lokales Testen
Öffne `index.html` im Browser (lokales File funktioniert), oder starte einen kleinen HTTP-Server:
```bash
# mit Python 3
python -m http.server 8000
# dann öffnen: http://localhost:8000
