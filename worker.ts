/**
 * Cloudflare Worker — API 라우팅 + 정적 에셋 서빙
 *
 * GET  /api/monsters         → D1 monsters + drops
 * GET  /api/items            → D1 ITEM_MASTER
 * GET  /api/maps             → D1 MAP_MASTER
 * GET  /api/portals          → D1 MAP_PORTALS
 * POST /api/inventory/add    → D1 USER_INVENTORY + EQUIP_INSTANCE INSERT
 * GET  /api/inventory        → D1 USER_INVENTORY 조회
 * POST /api/auth/register    → USERS INSERT + CHARACTER_STATS 기본값 INSERT
 * POST /api/auth/login       → USERS 조회 (자격증명 확인)
 * GET  /api/character        → CHARACTER_STATS 조회
 * PUT  /api/character        → CHARACTER_STATS 저장
 * *                          → 정적 에셋(dist/) 서빙
 */

interface Env {
  DB:     D1Database;
  ASSETS: Fetcher;
  ARENA:  DurableObjectNamespace;
}

interface MonsterRow {
  id: string; name: string; hp: number; exp: number;
  damage: number; body_color: number; shell_color: number;
}
interface DropRow {
  monster_id: string; item_id: string; chance: number;
}
interface ItemMasterRow {
  item_id: number; code: string; name: string; description: string;
  category: string; sub_type: string; req_lv: number; sell_price: number;
  max_stack: number; body_color: number; gem_color: number;
  base_atk: number; base_str: number; base_dex: number; base_int: number;
  base_luk: number; base_def: number; max_upgrade: number;
  hp_recover: number; mp_recover: number;
}
interface MapRow {
  map_id: number; name: string; bg_key: string; is_town: number;
}
interface UserRow {
  user_id: number; username: string; password_hash: string; created_at: string;
}
interface CharStatsRow {
  user_id: number; current_level: number; current_exp: number;
  hp: number; mp: number;
  str: number; dex: number; int_stat: number; luk: number;
  ap: number;
  map_id: number; pos_x: number; pos_y: number;
}
interface PortalRow {
  portal_id: number; from_map_id: number; to_map_id: number;
  pos_x: number; pos_y: number; target_x: number; target_y: number;
}

// ── 관리자 인증 ────────────────────────────────────────────────────────────
const ADMIN_ID    = 'ADMIN';
const ADMIN_PW    = '1';
const ADMIN_TOKEN = 'riceadmin_2025_secure_token';

const isAdminAuthed = (req: Request) =>
  req.headers.get('Authorization') === `Bearer ${ADMIN_TOKEN}`;

// 관리자 테이블 화이트리스트 (SQL injection 방지)
const ADMIN_TABLES: Record<string, { sql: string; pk: string; table: string }> = {
  users:           { sql: 'SELECT user_id, username, created_at FROM USERS ORDER BY user_id',      pk: 'user_id',   table: 'USERS'           },
  character_stats: { sql: 'SELECT * FROM CHARACTER_STATS ORDER BY user_id',                         pk: 'user_id',   table: 'CHARACTER_STATS' },
  item_master:     { sql: 'SELECT * FROM ITEM_MASTER ORDER BY item_id',                             pk: 'item_id',   table: 'ITEM_MASTER'     },
  monsters:        { sql: 'SELECT * FROM monsters ORDER BY id',                                     pk: 'id',        table: 'monsters'        },
  maps:            { sql: 'SELECT * FROM MAP_MASTER ORDER BY map_id',                               pk: 'map_id',    table: 'MAP_MASTER'      },
  portals:         { sql: 'SELECT * FROM MAP_PORTALS ORDER BY portal_id',                           pk: 'portal_id', table: 'MAP_PORTALS'     },
  inventory:       { sql: 'SELECT inv_id, user_id, item_id, quantity, equipped FROM USER_INVENTORY ORDER BY inv_id', pk: 'inv_id', table: 'USER_INVENTORY' },
};

const masterToCamel = (r: ItemMasterRow) => ({
  id: r.code, name: r.name, description: r.description,
  category: r.category, subType: r.sub_type, reqLv: r.req_lv,
  sellPrice: r.sell_price, maxStack: r.max_stack,
  bodyColor: r.body_color, gemColor: r.gem_color,
  baseAtk: r.base_atk, baseStr: r.base_str, baseDex: r.base_dex,
  baseInt: r.base_int, baseLuk: r.base_luk, baseDef: r.base_def,
  maxUpgrade: r.max_upgrade, hpRecover: r.hp_recover, mpRecover: r.mp_recover,
});

// ── 투기장 Durable Object ──────────────────────────────────────────────────
interface ArenaSession {
  ws: WebSocket;
  userId: string;
  username: string;
  x: number;
  y: number;
  hp: number;
  maxHp: number;
  level: number;
}

export class ArenaRoom {
  sessions = new Map<string, ArenaSession>();

  constructor(public state: DurableObjectState, public env: Env) {}

  async fetch(request: Request): Promise<Response> {
    if (request.headers.get('Upgrade') !== 'websocket') {
      return new Response('Expected WebSocket', { status: 426 });
    }
    const url      = new URL(request.url);
    const userId   = url.searchParams.get('user_id')  ?? ('g_' + Math.random().toString(36).slice(2));
    const username = url.searchParams.get('username') ?? '게스트';
    const hp       = Number(url.searchParams.get('hp')      ?? 100);
    const maxHp    = Number(url.searchParams.get('max_hp')  ?? 100);
    const level    = Number(url.searchParams.get('level')   ?? 1);

    const { 0: client, 1: server } = new WebSocketPair();
    server.accept();

    const sessionId = crypto.randomUUID();
    const session: ArenaSession = { ws: server, userId, username, x: 800, y: 600, hp, maxHp, level };

    // Send existing players to newcomer
    const others: object[] = [];
    this.sessions.forEach(s => others.push({
      userId: s.userId, username: s.username,
      x: s.x, y: s.y, hp: s.hp, maxHp: s.maxHp, level: s.level,
    }));
    server.send(JSON.stringify({ type: 'init', players: others }));

    // Announce newcomer to others
    this._broadcast(null, { type: 'join', userId, username, x: 800, y: 600, hp, maxHp, level });
    this.sessions.set(sessionId, session);

    server.addEventListener('message', (event: MessageEvent) => {
      try {
        const msg = JSON.parse(event.data as string);
        if (msg.type === 'move') {
          session.x = Number(msg.x); session.y = Number(msg.y);
          this._broadcast(sessionId, { type: 'move', userId, x: session.x, y: session.y });
        } else if (msg.type === 'attack') {
          const targetId = String(msg.targetUserId);
          const damage   = Math.min(Number(msg.damage) || 0, 9999);
          let targetSess: ArenaSession | null = null;
          this.sessions.forEach(s => { if (s.userId === targetId) targetSess = s; });
          if (targetSess) {
            targetSess.hp = Math.max(0, targetSess.hp - damage);
            this._broadcast(null, { type: 'hit', attackerId: userId, targetUserId: targetId, damage, targetHp: targetSess.hp });
            if (targetSess.hp <= 0) {
              targetSess.hp = targetSess.maxHp;
              this._broadcast(null, { type: 'dead', userId: targetId, attackerId: userId });
              // Restore HP on server after death
              this._broadcast(null, { type: 'hit', attackerId: '', targetUserId: targetId, damage: 0, targetHp: targetSess.hp });
            }
          }
        } else if (msg.type === 'update_stats') {
          session.hp    = Number(msg.hp)    || session.hp;
          session.maxHp = Number(msg.maxHp) || session.maxHp;
          session.level = Number(msg.level) || session.level;
        }
      } catch {}
    });

    const onClose = () => {
      this.sessions.delete(sessionId);
      this._broadcast(null, { type: 'leave', userId });
    };
    server.addEventListener('close', onClose);
    server.addEventListener('error', onClose);

    return new Response(null, { status: 101, webSocket: client });
  }

  _broadcast(excludeId: string | null, msg: object) {
    const str = JSON.stringify(msg);
    this.sessions.forEach((s, id) => {
      if (id !== excludeId) try { s.ws.send(str); } catch {}
    });
  }
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url      = new URL(request.url);
    const pathname = url.pathname;

    // ── GET /api/monsters ──────────────────────────────────────────────────
    if (pathname === '/api/monsters') {
      const [monstersRes, dropsRes] = await Promise.all([
        env.DB.prepare('SELECT * FROM monsters').all<MonsterRow>(),
        env.DB.prepare('SELECT monster_id, item_id, chance FROM monster_drops').all<DropRow>(),
      ]);
      const drops    = dropsRes.results;
      const monsters = monstersRes.results.map(m => ({
        id: m.id, name: m.name, hp: m.hp, exp: m.exp, damage: m.damage,
        bodyColor: m.body_color, shellColor: m.shell_color,
        drops: drops
          .filter(d => d.monster_id === m.id)
          .map(d => ({ itemId: d.item_id, chance: d.chance })),
      }));
      return Response.json(monsters, { headers: { 'Cache-Control': 'public, max-age=300' } });
    }

    // ── GET /api/items ─────────────────────────────────────────────────────
    if (pathname === '/api/items') {
      const { results } = await env.DB.prepare('SELECT * FROM ITEM_MASTER').all<ItemMasterRow>();
      return Response.json(results.map(masterToCamel), {
        headers: { 'Cache-Control': 'public, max-age=300' },
      });
    }

    // ── GET /api/maps ──────────────────────────────────────────────────────
    if (pathname === '/api/maps') {
      const { results } = await env.DB.prepare('SELECT * FROM MAP_MASTER').all<MapRow>();
      return Response.json(results, { headers: { 'Cache-Control': 'public, max-age=300' } });
    }

    // ── GET /api/portals ───────────────────────────────────────────────────
    if (pathname === '/api/portals') {
      const { results } = await env.DB.prepare('SELECT * FROM MAP_PORTALS').all<PortalRow>();
      return Response.json(results, { headers: { 'Cache-Control': 'public, max-age=300' } });
    }

    // ── POST /api/inventory/add ────────────────────────────────────────────
    if (pathname === '/api/inventory/add' && request.method === 'POST') {
      const body      = await request.json<{ user_id?: string; item_code: string }>();
      const user_id   = body.user_id ?? 'local';
      const item_code = body.item_code;

      const masterRow = await env.DB.prepare('SELECT * FROM ITEM_MASTER WHERE code = ?')
        .bind(item_code).first<ItemMasterRow>();

      if (!masterRow) {
        return new Response(JSON.stringify({ error: 'Item not found' }), { status: 404 });
      }

      let inv_id: number;

      // 스택 가능 아이템 처리
      if (masterRow.category !== 'EQUIP' && masterRow.max_stack > 1) {
        const existing = await env.DB.prepare(
          'SELECT inv_id, quantity FROM USER_INVENTORY WHERE user_id = ? AND item_id = ? AND quantity < ? LIMIT 1',
        ).bind(user_id, masterRow.item_id, masterRow.max_stack)
          .first<{ inv_id: number; quantity: number }>();

        if (existing) {
          await env.DB.prepare('UPDATE USER_INVENTORY SET quantity = quantity + 1 WHERE inv_id = ?')
            .bind(existing.inv_id).run();
          inv_id = existing.inv_id;
        } else {
          const r = await env.DB.prepare(
            'INSERT INTO USER_INVENTORY (user_id, item_id, quantity, equipped) VALUES (?, ?, 1, 0)',
          ).bind(user_id, masterRow.item_id).run();
          inv_id = r.meta.last_row_id;
        }
      } else {
        const r = await env.DB.prepare(
          'INSERT INTO USER_INVENTORY (user_id, item_id, quantity, equipped) VALUES (?, ?, 1, 0)',
        ).bind(user_id, masterRow.item_id).run();
        inv_id = r.meta.last_row_id;
      }

      // 장비 랜덤 옵션 생성
      let equip: object | null = null;
      if (masterRow.category === 'EQUIP') {
        const rnd = (base: number) => base > 0 ? Math.floor(Math.random() * 3) : 0;
        const strB = rnd(masterRow.base_str);
        const dexB = rnd(masterRow.base_dex);
        const intB = rnd(masterRow.base_int);
        const lukB = rnd(masterRow.base_luk);
        const atkB = rnd(masterRow.base_atk);
        const defB = rnd(masterRow.base_def);

        const eqRes = await env.DB.prepare(
          `INSERT INTO EQUIP_INSTANCE
           (inv_id, str_bonus, dex_bonus, int_bonus, luk_bonus, atk_bonus, def_bonus, upgrade_count, upgrade_slots)
           VALUES (?, ?, ?, ?, ?, ?, ?, 0, ?)`,
        ).bind(inv_id, strB, dexB, intB, lukB, atkB, defB, masterRow.max_upgrade).run();

        equip = {
          equipId: eqRes.meta.last_row_id,
          invId: inv_id,
          strBonus: strB, dexBonus: dexB, intBonus: intB, lukBonus: lukB,
          atkBonus: atkB, defBonus: defB,
          upgradeCount: 0, upgradeSlots: masterRow.max_upgrade,
        };
      }

      return Response.json({ inv_id, master: masterToCamel(masterRow), equip });
    }

    // ── GET /api/inventory ─────────────────────────────────────────────────
    if (pathname === '/api/inventory' && request.method === 'GET') {
      const user_id = url.searchParams.get('user_id') ?? 'local';

      const rows = await env.DB.prepare(`
        SELECT ui.inv_id, ui.quantity, ui.equipped,
               im.item_id, im.code, im.name, im.description, im.category, im.sub_type,
               im.req_lv, im.sell_price, im.max_stack, im.body_color, im.gem_color,
               im.base_atk, im.base_str, im.base_dex, im.base_int, im.base_luk, im.base_def,
               im.max_upgrade, im.hp_recover, im.mp_recover,
               ei.equip_id, ei.str_bonus, ei.dex_bonus, ei.int_bonus, ei.luk_bonus,
               ei.atk_bonus, ei.def_bonus, ei.upgrade_count, ei.upgrade_slots
        FROM USER_INVENTORY ui
        JOIN ITEM_MASTER im ON ui.item_id = im.item_id
        LEFT JOIN EQUIP_INSTANCE ei ON ui.inv_id = ei.inv_id
        WHERE ui.user_id = ?
        ORDER BY ui.inv_id ASC
      `).bind(user_id).all();

      const inventory = (rows.results as Record<string, unknown>[]).map(r => ({
        invId:    r.inv_id,
        userId:   user_id,
        quantity: r.quantity,
        equipped: r.equipped === 1,
        master: {
          id: r.code, name: r.name, description: r.description,
          category: r.category, subType: r.sub_type, reqLv: r.req_lv,
          sellPrice: r.sell_price, maxStack: r.max_stack,
          bodyColor: r.body_color, gemColor: r.gem_color,
          baseAtk: r.base_atk, baseStr: r.base_str, baseDex: r.base_dex,
          baseInt: r.base_int, baseLuk: r.base_luk, baseDef: r.base_def,
          maxUpgrade: r.max_upgrade, hpRecover: r.hp_recover, mpRecover: r.mp_recover,
        },
        equip: r.equip_id ? {
          equipId: r.equip_id, invId: r.inv_id,
          strBonus: r.str_bonus, dexBonus: r.dex_bonus, intBonus: r.int_bonus,
          lukBonus: r.luk_bonus, atkBonus: r.atk_bonus, defBonus: r.def_bonus,
          upgradeCount: r.upgrade_count, upgradeSlots: r.upgrade_slots,
        } : undefined,
      }));

      return Response.json(inventory);
    }

    // ── POST /api/auth/register ────────────────────────────────────────────
    if (pathname === '/api/auth/register' && request.method === 'POST') {
      const body = await request.json<{ username: string; password: string }>();
      const username = (body.username ?? '').trim().toLowerCase();
      const password = body.password ?? '';
      if (!username || !password) {
        return Response.json({ error: '아이디와 비밀번호를 입력해주세요.' }, { status: 400 });
      }

      const exists = await env.DB.prepare('SELECT user_id FROM USERS WHERE username = ?')
        .bind(username).first<{ user_id: number }>();
      if (exists) {
        return Response.json({ error: '이미 사용 중인 아이디입니다.' }, { status: 409 });
      }

      const insertUser = await env.DB.prepare(
        'INSERT INTO USERS (username, password_hash) VALUES (?, ?)',
      ).bind(username, password).run();
      const userId = insertUser.meta.last_row_id;

      await env.DB.prepare(
        `INSERT INTO CHARACTER_STATS
         (user_id, current_level, current_exp, hp, mp, str, dex, int_stat, luk, map_id, pos_x, pos_y)
         VALUES (?, 1, 0, 50, 50, 4, 4, 4, 4, 100000000, 960, 720)`,
      ).bind(userId).run();

      return Response.json({ userId, username, message: '계정 생성 완료' }, { status: 201 });
    }

    // ── POST /api/auth/login ───────────────────────────────────────────────
    if (pathname === '/api/auth/login' && request.method === 'POST') {
      const body = await request.json<{ username: string; password: string }>();
      const username = (body.username ?? '').trim().toLowerCase();
      const password = body.password ?? '';

      // 관리자 계정 처리
      if (username === ADMIN_ID.toLowerCase() && password === ADMIN_PW) {
        return Response.json({ userId: 0, username: ADMIN_ID.toLowerCase(), isAdmin: true, token: ADMIN_TOKEN });
      }

      const user = await env.DB.prepare(
        'SELECT user_id, username, password_hash FROM USERS WHERE username = ?',
      ).bind(username).first<UserRow>();

      if (!user || user.password_hash !== password) {
        return Response.json({ error: '아이디 또는 비밀번호가 올바르지 않습니다.' }, { status: 401 });
      }

      return Response.json({ userId: user.user_id, username: user.username });
    }

    // ── GET /api/character ─────────────────────────────────────────────────
    if (pathname === '/api/character' && request.method === 'GET') {
      const userId = url.searchParams.get('user_id');
      if (!userId) return Response.json({ error: 'user_id required' }, { status: 400 });

      const stats = await env.DB.prepare('SELECT * FROM CHARACTER_STATS WHERE user_id = ?')
        .bind(userId).first<CharStatsRow>();
      if (!stats) return Response.json({ error: 'Character not found' }, { status: 404 });

      return Response.json({
        userId:       stats.user_id,
        currentLevel: stats.current_level,
        currentExp:   stats.current_exp,
        hp:  stats.hp,  mp:  stats.mp,
        str: stats.str, dex: stats.dex,
        int: stats.int_stat, luk: stats.luk,
        ap:  stats.ap ?? 0,
        mapId: stats.map_id, posX: stats.pos_x, posY: stats.pos_y,
      });
    }

    // ── PUT /api/character ─────────────────────────────────────────────────
    if (pathname === '/api/character' && request.method === 'PUT') {
      const body = await request.json<{
        user_id: number; current_level: number; current_exp: number;
        hp: number; mp: number; str: number; dex: number; int: number; luk: number;
        ap: number;
        map_id: number; pos_x: number; pos_y: number;
      }>();

      await env.DB.prepare(
        `UPDATE CHARACTER_STATS SET
          current_level = ?, current_exp = ?,
          hp = ?, mp = ?,
          str = ?, dex = ?, int_stat = ?, luk = ?,
          ap = ?,
          map_id = ?, pos_x = ?, pos_y = ?
         WHERE user_id = ?`,
      ).bind(
        body.current_level, body.current_exp,
        body.hp, body.mp,
        body.str, body.dex, body.int, body.luk,
        body.ap ?? 0,
        body.map_id, body.pos_x, body.pos_y,
        body.user_id,
      ).run();

      return Response.json({ message: '저장 완료' });
    }

    // ── POST /api/admin/login ──────────────────────────────────────────────
    if (pathname === '/api/admin/login' && request.method === 'POST') {
      const { username, password } = await request.json<{ username: string; password: string }>();
      if (username === ADMIN_ID && password === ADMIN_PW) {
        return Response.json({ token: ADMIN_TOKEN });
      }
      return Response.json({ error: '아이디 또는 비밀번호가 올바르지 않습니다.' }, { status: 401 });
    }

    // ── GET /api/admin/data/:table ─────────────────────────────────────────
    if (pathname.startsWith('/api/admin/data/') && request.method === 'GET') {
      if (!isAdminAuthed(request)) return Response.json({ error: 'Unauthorized' }, { status: 401 });
      const tableKey = pathname.slice('/api/admin/data/'.length);
      const info = ADMIN_TABLES[tableKey];
      if (!info) return Response.json({ error: 'Unknown table' }, { status: 400 });
      const { results } = await env.DB.prepare(info.sql).all();
      return Response.json(results);
    }

    // ── PUT /api/admin/data/:table ─────────────────────────────────────────
    if (pathname.startsWith('/api/admin/data/') && request.method === 'PUT') {
      if (!isAdminAuthed(request)) return Response.json({ error: 'Unauthorized' }, { status: 401 });
      const tableKey = pathname.slice('/api/admin/data/'.length);
      const info = ADMIN_TABLES[tableKey];
      if (!info) return Response.json({ error: 'Unknown table' }, { status: 400 });

      const { pk_value, updates } = await request.json<{ pk_value: unknown; updates: Record<string, unknown> }>();
      const cols = Object.keys(updates);
      if (cols.length === 0) return Response.json({ message: 'No updates' });

      // 컬럼명 화이트리스트: 영문자·숫자·언더스코어만 허용
      for (const c of cols) {
        if (!/^[a-zA-Z_][a-zA-Z0-9_]*$/.test(c)) {
          return Response.json({ error: `Invalid column: ${c}` }, { status: 400 });
        }
      }

      const setClause = cols.map(c => `${c} = ?`).join(', ');
      await env.DB.prepare(`UPDATE ${info.table} SET ${setClause} WHERE ${info.pk} = ?`)
        .bind(...Object.values(updates), pk_value)
        .run();

      return Response.json({ message: '업데이트 완료' });
    }

    // ── GET /api/arena/ws — 투기장 WebSocket ──────────────────────────────
    if (pathname === '/api/arena/ws') {
      const id   = env.ARENA.idFromName('global');
      const stub = env.ARENA.get(id);
      return stub.fetch(request);
    }

    // 정적 에셋
    return env.ASSETS.fetch(request);
  },
};
