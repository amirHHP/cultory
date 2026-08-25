import { createApp } from "./app.js";

const PORT = process.env.PORT || 4000;
createApp().listen(PORT, () =>
  console.log(`🏛️  Cultory API listening on http://localhost:${PORT}`)
);
