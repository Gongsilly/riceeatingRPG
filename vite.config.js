import { defineConfig } from 'vite';
import { readFileSync  } from 'fs';
import { resolve       } from 'path';
import { createHash    } from 'crypto';

export default defineConfig({
  build: {
    outDir: 'dist',
  },
  plugins: [
    {
      name: 'mock-d1-api',
      configureServer(server) {
        // 인벤토리 인메모리 스토어 (로컬 개발용)
        let mockInvId  = 0;
        const mockInventory = [];

        // ── 관리자 API (로컬 dev mock) ────────────────────────────────────
        const ADMIN_TOKEN_MOCK = 'riceadmin_2025_secure_token';

        server.middlewares.use('/api/admin', (req, res, next) => {
          // POST /api/admin/login
          if (req.url === '/login' && req.method === 'POST') {
            let body = '';
            req.on('data', c => { body += c; });
            req.on('end', () => {
              try {
                const { username, password } = JSON.parse(body);
                if (username === 'ADMIN' && password === '1') {
                  res.setHeader('Content-Type', 'application/json');
                  res.end(JSON.stringify({ token: ADMIN_TOKEN_MOCK }));
                } else {
                  res.statusCode = 401;
                  res.setHeader('Content-Type', 'application/json');
                  res.end(JSON.stringify({ error: '아이디 또는 비밀번호가 올바르지 않습니다.' }));
                }
              } catch { res.statusCode = 500; res.end('{}'); }
            });
            return;
          }

          // 인증 확인
          const auth = req.headers['authorization'] ?? '';
          if (auth !== `Bearer ${ADMIN_TOKEN_MOCK}`) {
            res.statusCode = 401;
            res.setHeader('Content-Type', 'application/json');
            res.end(JSON.stringify({ error: 'Unauthorized' }));
            return;
          }

          // GET /api/admin/data/:table
          const getMatch = req.url.match(/^\/data\/(\w+)$/);
          if (getMatch && req.method === 'GET') {
            const tableKey = getMatch[1];
            let data = [];
            try {
              if (tableKey === 'monsters') {
                data = JSON.parse(readFileSync(resolve(__dirname, 'src/assets/data/monsters.json'), 'utf-8'));
              } else if (tableKey === 'item_master') {
                data = JSON.parse(readFileSync(resolve(__dirname, 'src/assets/data/items.json'), 'utf-8'))
                  .map((item, i) => ({ item_id: i + 1, code: item.id, ...item }));
              } else if (tableKey === 'maps') {
                data = JSON.parse(readFileSync(resolve(__dirname, 'src/assets/data/maps.json'), 'utf-8'));
              } else if (tableKey === 'portals') {
                data = JSON.parse(readFileSync(resolve(__dirname, 'src/assets/data/portals.json'), 'utf-8'));
              } else if (tableKey === 'users') {
                data = mockUsers.map(u => ({ user_id: u.userId, username: u.username, created_at: '(dev)' }));
              } else if (tableKey === 'character_stats') {
                data = Object.values(mockCharStats).map(s => ({
                  user_id: s.userId, current_level: s.currentLevel, current_exp: s.currentExp,
                  hp: s.hp, mp: s.mp, str: s.str, dex: s.dex, int_stat: s.int, luk: s.luk,
                  map_id: s.mapId, pos_x: s.posX, pos_y: s.posY,
                }));
              } else if (tableKey === 'inventory') {
                data = mockInventory.map(i => ({
                  inv_id: i.invId, user_id: i.userId, item_id: i.master?.id ?? '',
                  quantity: i.quantity, equipped: i.equipped ? 1 : 0,
                }));
              }
            } catch (_e) {}
            res.setHeader('Content-Type', 'application/json');
            res.end(JSON.stringify(data));
            return;
          }

          // PUT /api/admin/data/:table (dev: 성공 응답만)
          const putMatch = req.url.match(/^\/data\/(\w+)$/);
          if (putMatch && req.method === 'PUT') {
            let body = '';
            req.on('data', c => { body += c; });
            req.on('end', () => {
              res.setHeader('Content-Type', 'application/json');
              res.end(JSON.stringify({ message: '업데이트 완료 (dev mock)' }));
            });
            return;
          }

          next();
        });

        server.middlewares.use('/api/monsters', (_req, res) => {
          res.setHeader('Content-Type', 'application/json');
          res.end(readFileSync(resolve(__dirname, 'src/assets/data/monsters.json')));
        });

        server.middlewares.use('/api/items', (_req, res) => {
          res.setHeader('Content-Type', 'application/json');
          res.end(readFileSync(resolve(__dirname, 'src/assets/data/items.json')));
        });

        server.middlewares.use('/api/maps', (_req, res) => {
          res.setHeader('Content-Type', 'application/json');
          res.end(readFileSync(resolve(__dirname, 'src/assets/data/maps.json')));
        });

        server.middlewares.use('/api/portals', (_req, res) => {
          res.setHeader('Content-Type', 'application/json');
          res.end(readFileSync(resolve(__dirname, 'src/assets/data/portals.json')));
        });

        // POST /api/auth/register  &  POST /api/auth/login
        let mockUserIdSeq = 0;
        const mockUsers = [];
        const mockCharStats = {};

        server.middlewares.use('/api/auth', (req, res, next) => {
          const isRegister = req.url === '/register' || req.url === '/register/';
          const isLogin    = req.url === '/login'    || req.url === '/login/';

          if ((isRegister || isLogin) && req.method === 'POST') {
            let body = '';
            req.on('data', chunk => { body += chunk; });
            req.on('end', () => {
              try {
                const parsed  = JSON.parse(body);
                const username = (parsed.username ?? '').trim().toLowerCase();
                const password = parsed.password ?? '';
                if (!username || !password) {
                  res.statusCode = 400;
                  res.setHeader('Content-Type', 'application/json');
                  res.end(JSON.stringify({ error: '아이디와 비밀번호를 입력해주세요.' }));
                  return;
                }

                if (isRegister) {
                  if (mockUsers.find(u => u.username === username)) {
                    res.statusCode = 409;
                    res.setHeader('Content-Type', 'application/json');
                    res.end(JSON.stringify({ error: '이미 사용 중인 아이디입니다.' }));
                    return;
                  }
                  const userId = ++mockUserIdSeq;
                  mockUsers.push({ userId, username, password });
                  mockCharStats[userId] = {
                    userId, currentLevel: 1, currentExp: 0,
                    hp: 50, mp: 50, str: 4, dex: 4, int: 4, luk: 4,
                    mapId: 100000000, posX: 1600, posY: 1200,
                  };
                  res.statusCode = 201;
                  res.setHeader('Content-Type', 'application/json');
                  res.end(JSON.stringify({ userId, username, message: '계정 생성 완료' }));
                } else {
                  // 관리자 처리
                  if (username === 'admin' && password === '1') {
                    res.setHeader('Content-Type', 'application/json');
                    res.end(JSON.stringify({ userId: 0, username: 'admin', isAdmin: true, token: ADMIN_TOKEN_MOCK }));
                    return;
                  }
                  const user = mockUsers.find(u => u.username === username && u.password === password);
                  if (!user) {
                    res.statusCode = 401;
                    res.setHeader('Content-Type', 'application/json');
                    res.end(JSON.stringify({ error: '아이디 또는 비밀번호가 올바르지 않습니다.' }));
                    return;
                  }
                  res.setHeader('Content-Type', 'application/json');
                  res.end(JSON.stringify({ userId: user.userId, username: user.username }));
                }
              } catch (e) {
                res.statusCode = 500;
                res.setHeader('Content-Type', 'application/json');
                res.end(JSON.stringify({ error: 'Server error' }));
              }
            });
            return;
          }
          next();
        });

        // GET /api/character  &  PUT /api/character
        server.middlewares.use('/api/character', (req, res, next) => {
          if (req.method === 'GET') {
            const userId = new URLSearchParams(req.url.split('?')[1] ?? '').get('user_id');
            const stats = mockCharStats[userId];
            if (!stats) {
              res.statusCode = 404;
              res.setHeader('Content-Type', 'application/json');
              res.end(JSON.stringify({ error: 'Character not found' }));
              return;
            }
            res.setHeader('Content-Type', 'application/json');
            res.end(JSON.stringify(stats));
            return;
          }

          if (req.method === 'PUT') {
            let body = '';
            req.on('data', chunk => { body += chunk; });
            req.on('end', () => {
              try {
                const data = JSON.parse(body);
                if (mockCharStats[data.user_id]) {
                  mockCharStats[data.user_id] = {
                    userId: data.user_id,
                    currentLevel: data.current_level,
                    currentExp:   data.current_exp,
                    hp: data.hp, mp: data.mp,
                    str: data.str, dex: data.dex, int: data.int, luk: data.luk,
                    mapId: data.map_id, posX: data.pos_x, posY: data.pos_y,
                  };
                }
                res.setHeader('Content-Type', 'application/json');
                res.end(JSON.stringify({ message: '저장 완료' }));
              } catch (e) {
                res.statusCode = 500;
                res.setHeader('Content-Type', 'application/json');
                res.end(JSON.stringify({ error: 'Server error' }));
              }
            });
            return;
          }
          next();
        });

        // POST /api/inventory/add  &  GET /api/inventory
        server.middlewares.use('/api/inventory', (req, res, next) => {
          const isAdd = req.url === '/add' || req.url === '/add/';

          if (isAdd && req.method === 'POST') {
            let body = '';
            req.on('data', chunk => { body += chunk; });
            req.on('end', () => {
              try {
                const { item_code, user_id: bodyUserId } = JSON.parse(body);
                const userId = bodyUserId ?? 'local';
                const allItems = JSON.parse(
                  readFileSync(resolve(__dirname, 'src/assets/data/items.json'), 'utf-8'),
                );
                const master = allItems.find(i => i.id === item_code);
                if (!master) {
                  res.statusCode = 404;
                  res.setHeader('Content-Type', 'application/json');
                  res.end(JSON.stringify({ error: 'Item not found' }));
                  return;
                }

                const inv_id = ++mockInvId;
                let equip = null;
                if (master.category === 'EQUIP') {
                  const rnd = (base) => base > 0 ? Math.floor(Math.random() * 3) : 0;
                  equip = {
                    equipId: inv_id,
                    invId:   inv_id,
                    strBonus: rnd(master.baseStr),
                    dexBonus: rnd(master.baseDex),
                    intBonus: rnd(master.baseInt),
                    lukBonus: rnd(master.baseLuk),
                    atkBonus: rnd(master.baseAtk),
                    defBonus: rnd(master.baseDef),
                    upgradeCount: 0,
                    upgradeSlots: master.maxUpgrade,
                  };
                }

                mockInventory.push({ invId: inv_id, userId, quantity: 1, equipped: false, master, equip });
                res.setHeader('Content-Type', 'application/json');
                res.end(JSON.stringify({ inv_id, master, equip }));
              } catch (e) {
                res.statusCode = 500;
                res.setHeader('Content-Type', 'application/json');
                res.end(JSON.stringify({ error: 'Server error' }));
              }
            });
            return;
          }

          if (req.method === 'GET') {
            const qUserId = new URLSearchParams(req.url.split('?')[1] ?? '').get('user_id') ?? 'local';
            const userInv = mockInventory.filter(i => String(i.userId) === String(qUserId));
            res.setHeader('Content-Type', 'application/json');
            res.end(JSON.stringify(userInv));
            return;
          }

          next();
        });

        // ── Arena WebSocket mock (로컬 개발용) ────────────────────────────
        const arenaSessions = new Map();

        function wsSend(sess, text) {
          const buf = Buffer.from(text, 'utf8');
          const header = buf.length < 126
            ? Buffer.from([0x81, buf.length])
            : Buffer.from([0x81, 126, buf.length >> 8, buf.length & 0xff]);
          try { sess.socket.write(Buffer.concat([header, buf])); } catch {}
        }

        function arenaBroadcastMsg(excludeSid, msg) {
          const str = JSON.stringify(msg);
          arenaSessions.forEach((s, id) => { if (id !== excludeSid) wsSend(s, str); });
        }

        server.httpServer?.on('upgrade', (req, socket) => {
          if (!req.url?.startsWith('/api/arena/ws')) return;

          const urlObj   = new URL(req.url, `http://${req.headers.host}`);
          const userId   = urlObj.searchParams.get('user_id')  ?? 'dev';
          const username = urlObj.searchParams.get('username') ?? '게스트';
          const hp       = Number(urlObj.searchParams.get('hp')     ?? 100);
          const maxHp    = Number(urlObj.searchParams.get('max_hp') ?? 100);
          const level    = Number(urlObj.searchParams.get('level')  ?? 1);
          const sid      = Math.random().toString(36).slice(2);

          const key    = req.headers['sec-websocket-key'];
          const accept = createHash('sha1')
            .update(key + '258EAFA5-E914-47DA-95CA-C5AB0DC85B11')
            .digest('base64');
          socket.write(
            'HTTP/1.1 101 Switching Protocols\r\n' +
            'Upgrade: websocket\r\nConnection: Upgrade\r\n' +
            `Sec-WebSocket-Accept: ${accept}\r\n\r\n`,
          );

          const sess = { socket, userId, username, x: 800, y: 600, hp, maxHp, level };

          // init: 기존 플레이어 목록 전송
          const others = [];
          arenaSessions.forEach(s => others.push({ userId: s.userId, username: s.username, x: s.x, y: s.y, hp: s.hp, maxHp: s.maxHp, level: s.level }));
          wsSend(sess, JSON.stringify({ type: 'init', players: others }));

          arenaSessions.set(sid, sess);
          arenaBroadcastMsg(sid, { type: 'join', userId, username, x: 800, y: 600, hp, maxHp, level });

          let buf = Buffer.alloc(0);
          socket.on('data', (chunk) => {
            buf = Buffer.concat([buf, chunk]);
            while (buf.length >= 2) {
              const opcode  = buf[0] & 0x0f;
              const masked  = (buf[1] & 0x80) !== 0;
              let pLen      = buf[1] & 0x7f;
              let off       = 2;
              if (pLen === 126) { if (buf.length < 4) break; pLen = buf.readUInt16BE(2); off = 4; }
              const total = off + (masked ? 4 : 0) + pLen;
              if (buf.length < total) break;
              const maskKey = masked ? buf.slice(off, off + 4) : null;
              if (masked) off += 4;
              const payload = Buffer.allocUnsafe(pLen);
              for (let i = 0; i < pLen; i++) payload[i] = maskKey ? buf[off + i] ^ maskKey[i % 4] : buf[off + i];
              buf = buf.slice(total);

              if (opcode === 8) { socket.destroy(); return; }
              if (opcode === 1 || opcode === 2) {
                try {
                  const msg = JSON.parse(payload.toString('utf8'));
                  if (msg.type === 'move') {
                    sess.x = Number(msg.x); sess.y = Number(msg.y);
                    arenaBroadcastMsg(sid, { type: 'move', userId, x: sess.x, y: sess.y });
                  } else if (msg.type === 'attack') {
                    const tId  = String(msg.targetUserId);
                    const dmg  = Math.min(Number(msg.damage) || 0, 9999);
                    let tSess  = null;
                    arenaSessions.forEach(s => { if (s.userId === tId) tSess = s; });
                    if (tSess) {
                      tSess.hp = Math.max(0, tSess.hp - dmg);
                      arenaBroadcastMsg(null, { type: 'hit', attackerId: userId, targetUserId: tId, damage: dmg, targetHp: tSess.hp });
                      if (tSess.hp <= 0) {
                        tSess.hp = tSess.maxHp;
                        arenaBroadcastMsg(null, { type: 'dead', userId: tId, attackerId: userId });
                        arenaBroadcastMsg(null, { type: 'hit', attackerId: '', targetUserId: tId, damage: 0, targetHp: tSess.hp });
                      }
                    }
                  } else if (msg.type === 'update_stats') {
                    sess.hp = Number(msg.hp) || sess.hp;
                    sess.maxHp = Number(msg.maxHp) || sess.maxHp;
                    sess.level = Number(msg.level) || sess.level;
                  }
                } catch {}
              }
            }
          });

          socket.on('close', () => {
            arenaSessions.delete(sid);
            arenaBroadcastMsg(null, { type: 'leave', userId });
          });
          socket.on('error', () => arenaSessions.delete(sid));
        });
      },
    },
  ],
});
