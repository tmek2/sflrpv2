// Minimal Mongo connectivity test (independent of Discord bot)
const mongoose = require('mongoose');
const fs = require('fs');
const path = require('path');

function loadEnv() {
  try {
    const envPath = path.resolve(__dirname, '..', '.env');
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

async function main() {
  loadEnv();
  const uri = process.env.MONGO_URI || '';
  const dbName = process.env.MONGO_DB_NAME || '';
  if (!uri) {
    console.error('MONGO_URI not set. Define it in .env');
    process.exit(1);
  }
  if (uri.includes('<') || uri.includes('>')) {
    console.error('MONGO_URI contains placeholder brackets <>. Replace with the actual password and remove <>.');
    process.exit(1);
  }
  const tlsEnv = String(process.env.MONGO_TLS || '').toLowerCase();
  const tlsOn = tlsEnv === 'true' || /mongodb\+srv:/i.test(uri) || /mongodb\.net/i.test(uri);
  const allowInvalid = String(process.env.MONGO_TLS_ALLOW_INVALID || 'false').toLowerCase() === 'true';
  const isSrv = /mongodb\+srv:/i.test(uri);
  console.log('Testing connection to MongoDB...');
  console.log(`Config summary: isSrv=${isSrv} tls=${tlsOn} allowInvalid=${allowInvalid} dbName=${dbName || '(none)'}`);
  try {
    const connOpts = {
      serverSelectionTimeoutMS: 8000,
      dbName: dbName || undefined,
      tls: tlsOn,
      ssl: tlsOn,
      tlsAllowInvalidCertificates: allowInvalid
    };
    if (!isSrv) connOpts.directConnection = true;
    await mongoose.connect(uri, connOpts);
    console.log('✅ Connected to MongoDB');
  } catch (err) {
    console.error('❌ Connection failed:', err.message);
    console.error('Hints:');
    console.error('- Ensure your password is correct and not wrapped with <>');
    console.error('- If your password has special chars (@:/?&), URL-encode them');
    console.error('- In MongoDB Atlas, add your IP to Network Access (or temporary 0.0.0.0/0)');
    console.error('- Confirm user tmek_db_user has readWrite on your database');
    console.error('- Try adding a database name: MONGO_DB_NAME=sflrp');
    console.error('- For SRV URIs, do NOT force directConnection');
    console.error('- If using self-signed certs, test with MONGO_TLS_ALLOW_INVALID=true');
    process.exit(1);
  } finally {
    await mongoose.disconnect();
  }
}

main();
