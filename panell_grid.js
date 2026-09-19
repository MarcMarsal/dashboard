// panell_grid.js — Panell FI Gridbots

import http from "http";
import { initDB, client } from "./db/client.js";

// 🟩 Llegir recomanacions FI
async function getGridRecommendations() {
  const q = await client.query(`
    SELECT *
    FROM grid_recommendations
    ORDER BY score DESC
    LIMIT 50
  `);

  return q.rows;
}

// 🟩 Render taula FI
function renderGridTable(rows) {
  let htmlRows = "";

  for (const r of rows) {
    const modeColor = r.mode === "USDT" ? "#00ff00" : "#00ccff";

    htmlRows += `
      <tr style="color:${modeColor}">
        <td>${r.symbol}</td>
        <td>${r.mode}</td>
        <td>${Number(r.score).toFixed(1)}</td>
        <td>${r.cells}</td>
        <td>${Number(r.cell_distance).toFixed(6)}</td>
        <td>${Number(r.range).toFixed(6)}</td>
        <td>${Number(r.atr).toFixed(6)}</td>
        <td>${Number(r.volume).toLocaleString("es-ES")}</td>
        <td>${new Date(r.updated_at).toLocaleString("es-ES")}</td>
      </tr>
    `;
  }

  return `
    <h2>Top 50 Criptos APTE — Grid FI</h2>

    <table>
      <thead>
        <tr>
          <th>Symbol</th>
          <th>Mode</th>
          <th>Score</th>
          <th>Cel·les</th>
          <th>Distància</th>
          <th>Rang FI</th>
          <th>ATR</th>
          <th>Volum</th>
          <th>Actualitzat</th>
        </tr>
      </thead>
      <tbody>
        ${htmlRows}
      </tbody>
    </table>
  `;
}

// 🟩 Servidor HTTP (igual que MicroPulse)
async function startPanel() {
  await initDB();

  http.createServer(async (req, res) => {

    if (req.url.startsWith("/")) {
      const rows = await getGridRecommendations();
      //const lastUpdate = new Date().toLocaleString("es-ES");
      const lastUpdate = new Date().toLocaleString("es-ES", { timeZone: "Europe/Madrid" });


      const html = `
      <html>
      <head>
        <meta charset="UTF-8">
        <meta http-equiv="refresh" content="10">
        <style>
          body {
            background-color: #000;
            color: #00ff00;
            font-family: Consolas, monospace;
            padding: 20px;
          }
          table {
            border-collapse: collapse;
            width: 100%;
            margin-bottom: 40px;
          }
          th, td {
            border: 1px solid #00ff00;
            padding: 6px;
            text-align: center;
          }
          th {
            background-color: #003300;
          }
        </style>
      </head>
      <body>
        <h1>Panell FI — Gridbots</h1>
        <p><b>Última actualització:</b> ${lastUpdate}</p>

        ${renderGridTable(rows)}

      </body>
      </html>
      `;

      res.writeHead(200, { "Content-Type": "text/html; charset=utf-8" });
      res.end(html);
      return;
    }

    res.writeHead(200);
    res.end("Panell FI Grid OK");
  }).listen(process.env.PORT || 3000);

  console.log("Panell FI Grid en marxa");
}

startPanel();
