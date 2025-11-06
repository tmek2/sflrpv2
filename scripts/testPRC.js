// Minimal PRC API diagnostic script
// Loads .env (lightweight) and checks key validity by calling /players and /commandlogs

const axios = require('axios');
const fs = require('fs');
const path = require('path');

function loadEnv() {
  try {
    const envPath = path.resolve(__dirname, '../.env');
    if (!fs.existsSync(envPath)) return;
    const lines = fs.readFileSync(envPath, 'utf8').split(/\r?\n/);
    for (const raw of lines) {
      const line = raw.trim();
      if (!line || line.startsWith('#')) continue;
      const eq = line.indexOf('=');
      if (eq === -1) continue;
      const key = line.slice(0, eq).trim();
      let val = line.slice(eq + 1).trim();
      const hash = val.indexOf('#');
      if (hash !== -1) val = val.slice(0, hash).trim();
      if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
        val = val.slice(1, -1);
      }
      if (!process.env[key]) process.env[key] = val;
    }
  } catch (err) {
    console.warn('Failed to load .env:', err.message);
  }
}

loadEnv();

const PRC_KEY = process.env.PRC_KEY || '';
if (!PRC_KEY) {
  console.error('PRC_KEY not set.');
  process.exit(2);
}

const api = axios.create({
  baseURL: 'https://api.policeroleplay.community/v1/server',
  headers: { 'server-key': PRC_KEY, Accept: '*/*' },
  timeout: 8000
});

async function checkEndpoint(name, path) {
  try {
    const res = await api.get(path);
    console.log(`[${name}] status=${res.status}`);
    const sample = Array.isArray(res.data) ? res.data.slice(0, 1) : res.data;
    console.log(`[${name}] sample=`, JSON.stringify(sample).slice(0, 200));
  } catch (e) {
    if (e.response) {
      console.log(`[${name}] status=${e.response.status}`);
      console.log(`[${name}] body=`, JSON.stringify(e.response.data).slice(0, 300));
      if (e.response.status === 401 || e.response.status === 403) {
        console.log(`[${name}] auth/ban suspected (status ${e.response.status}).`);
      }
    } else {
      console.log(`[${name}] error=`, e.message);
    }
  }
}

(async () => {
  await checkEndpoint('players', '/players');
  await checkEndpoint('commandlogs', '/commandlogs');
})();