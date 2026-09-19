// server.js
const http = require("http");
const { initDB, client } = require("./db/client");
const { recalcGridRecommendations } = require("./core/recalc");

async function start() {
  await initDB();
  console.log("Dashboard FI connectat a PostgreSQL");

  // Primer càlcul en arrencar
  await recalcGridRecommendations();
  console.log("Primer càlcul FI complet");

  const server = http.createServer(async (req, res) => {
    if (req.url === "/dashboard/grid") {
      const rows = await client.query(`
        SELECT * FROM grid_recommendations
        ORDER BY score DESC
      `);

      res.writeHead(200, { "Content-Type": "application/json" });
      return res.end(JSON.stringify(rows.rows));
    }

    // Default
    res.writeHead(200, { "Content-Type": "text/plain" });
    res.end("Dashboard FI en funcionament");
  });

  const port = process.env.PORT || 3000;
  server.listen(port, () => {
    console.log("Dashboard FI escoltant al port", port);
  });
}

start();
