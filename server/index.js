import express from 'express';
import multer from 'multer';
import { mkdtemp, rm } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { equal, sessionToken, validSession, limiter } from './security.js';
import { extractMedia, mediaReady, recognize, PublicError } from './recognition.js';

const publicDir = fileURLToPath(new URL('../public/', import.meta.url));
export function createApp({env = process.env, mediaAvailable = false, extract = extractMedia, identify = recognize} = {}) {
  const app = express();
  app.disable('x-powered-by');
  // Render terminates TLS at a single trusted ingress. Do not trust arbitrary X-Forwarded-For.
  if (env.NODE_ENV === 'production') app.set('trust proxy', 1);
  const authReady = (env.BETA_ACCESS_CODE?.length >= 16 && env.SESSION_SECRET?.length >= 32);
  const configured = Boolean(env.OPENAI_API_KEY && env.TMDB_READ_ACCESS_TOKEN && mediaAvailable && authReady);
  const loginLimit = limiter(10, 15*60000), usageLimit = limiter(5,3600000);
  const dailyLimit = limiter(Math.max(1,Number(env.MAX_RECOGNITIONS_PER_DAY) || 50),86400000);
  let active = 0;
  app.use((req,res,next) => {
    res.set({ 'X-Content-Type-Options':'nosniff','Referrer-Policy':'no-referrer','X-Frame-Options':'DENY',
      'Permissions-Policy':'camera=(), microphone=(), geolocation=()',
      'Content-Security-Policy':"default-src 'self'; script-src 'self'; style-src 'self'; img-src 'self' https://image.tmdb.org data: blob:; media-src 'self' blob:; connect-src 'self'; worker-src 'self'; frame-ancestors 'none'; base-uri 'none'; form-action 'self'" });
    if (env.NODE_ENV === 'production') res.set('Strict-Transport-Security','max-age=31536000');
    if (req.path.startsWith('/api/')) res.set('Cache-Control','no-store');
    if (['POST','PUT','PATCH','DELETE'].includes(req.method)) {
      const origin = req.get('origin');
      if (req.get('sec-fetch-site') === 'cross-site' || (origin && origin !== `${req.protocol}://${req.get('host')}`)) return res.status(403).json({error:'BAD_ORIGIN'});
    }
    next();
  });
  app.use(express.json({limit:'4kb'}));
  const authenticated = req => {
    const cookie = (req.headers.cookie || '').split(';').map(s => s.trim()).find(s => s.startsWith('kf_session='))?.slice(11);
    return authReady && validSession(cookie,env.SESSION_SECRET,env.BETA_ACCESS_CODE);
  };
  const cookieOptions = {httpOnly:true, sameSite:'strict', secure:env.NODE_ENV === 'production', path:'/', maxAge:7*86400000};
  app.get('/api/health', (_req,res) => res.json({status:'ok'}));
  app.get('/api/status', (req,res) => res.json({authenticated:authenticated(req), authReady, recognitionReady:configured, mode:'live', maxSeconds:60, maxMB:60}));
  app.post('/api/login', (req,res) => {
    if (!loginLimit(req.ip)) return res.status(429).json({error:'RATE_LIMIT'});
    if (!authReady) return res.status(503).json({error:'BETA_NOT_CONFIGURED'});
    if (typeof req.body?.code !== 'string' || !equal(req.body.code,env.BETA_ACCESS_CODE)) return res.status(401).json({error:'BAD_CODE'});
    res.cookie('kf_session',sessionToken(env.SESSION_SECRET,env.BETA_ACCESS_CODE),cookieOptions).json({ok:true});
  });
  app.post('/api/logout', (_req,res) => res.clearCookie('kf_session',cookieOptions).json({ok:true}));
  app.post('/api/recognize', async (req,res,next) => {
    if (!authenticated(req)) return res.status(401).json({error:'LOGIN_REQUIRED'});
    if (!configured) return res.status(503).json({error:'RECOGNITION_NOT_CONFIGURED'});
    if (active >= 1) return res.status(429).json({error:'BUSY'});
    if (!usageLimit(req.ip) || !dailyLimit('global')) return res.status(429).json({error:'RATE_LIMIT'});
    active++;
    let directory;
    const controller = new AbortController();
    const abort = () => controller.abort();
    const timer = setTimeout(abort,180000);
    req.once('aborted',abort);
    res.once('close',abort);
    try {
      directory = await mkdtemp(path.join(os.tmpdir(),'kinofinder-'));
      const upload = multer({dest:directory, limits:{fileSize:60*1024*1024, files:1, fields:1, parts:2, fieldSize:8},
        fileFilter:(_req,file,cb) => cb(null,/^video\//.test(file.mimetype) || file.mimetype === 'application/octet-stream')}).single('video');
      await new Promise((resolve,reject) => upload(req,res,err => err ? reject(err) : resolve()));
      if (!req.file || controller.signal.aborted) throw new PublicError('INVALID_VIDEO');
      const media = await extract(req.file.path,directory,env,controller.signal);
      const lang = ['uz','ru','en'].includes(req.body?.language) ? req.body.language : 'uz';
      const result = await identify(media,lang,env,controller.signal);
      res.json({...result, id:crypto.randomUUID(), createdAt:new Date().toISOString()});
    } catch(err) { next(err); }
    finally {
      clearTimeout(timer);
      req.off('aborted',abort);
      res.off('close',abort);
      if (directory) await rm(directory,{recursive:true,force:true}).catch(() => console.error('Temporary upload cleanup failed'));
      active--;
    }
  });
  app.use(express.static(publicDir,{index:'index.html',setHeaders(res,file) { if (file.endsWith('sw.js') || file.endsWith('index.html')) res.set('Cache-Control','no-cache'); }}));
  app.use('/api',(_req,res) => res.status(404).json({error:'NOT_FOUND'}));
  app.use((err,_req,res,_next) => {
    if (res.headersSent) return;
    const code = err instanceof PublicError ? err.code : err instanceof multer.MulterError ? (err.code === 'LIMIT_FILE_SIZE' ? 'FILE_TOO_LARGE' : 'INVALID_UPLOAD') : err.type === 'entity.too.large' ? 'INVALID_UPLOAD' : 'SERVER_ERROR';
    res.status(err instanceof PublicError ? err.status : err instanceof multer.MulterError || err.type === 'entity.too.large' ? 400 : 500).json({error:code});
  });
  return app;
}
if (process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1])) {
  const mediaAvailable = await mediaReady();
  const app = createApp({mediaAvailable});
  const server = app.listen(Number(process.env.PORT) || 3000,'0.0.0.0',() => console.log(`KinoFinder listening on ${Number(process.env.PORT) || 3000}; media=${mediaAvailable}`));
  server.requestTimeout = 200000;
  server.headersTimeout = 15000;
}
