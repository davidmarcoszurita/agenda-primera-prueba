require('dotenv').config();
const express = require('express');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;

// Railway inyecta PORT automáticamente. SUPABASE_URL y SUPABASE_ANON_KEY
// se configuran como variables de entorno del servicio.
app.get('/config.js', (req, res) => {
  const url = process.env.SUPABASE_URL || '';
  const anonKey = process.env.SUPABASE_ANON_KEY || '';

  if (!url || !anonKey) {
    console.warn('Falta SUPABASE_URL o SUPABASE_ANON_KEY en las variables de entorno.');
  }

  res.type('application/javascript');
  res.send(
    `window.__SUPABASE_CONFIG__ = ${JSON.stringify({ url, anonKey })};`
  );
});

app.use(express.static(path.join(__dirname, 'public')));

app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.listen(PORT, () => {
  console.log(`Agenda corriendo en el puerto ${PORT}`);
});
