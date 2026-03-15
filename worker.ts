/**
 * Cloudflare Worker — API 라우팅 + 정적 에셋 서빙
 *
 * GET /api/monsters  → D1에서 몬스터 데이터 조회
 * GET /api/items     → D1에서 아이템 데이터 조회
 * *                  → 정적 에셋(dist/) 서빙
 */

interface Env {
  DB:     D1Database;
  ASSETS: Fetcher;
}

interface MonsterRow {
  id: string; name: string; hp: number; exp: number;
  damage: number; body_color: number; shell_color: number;
}
interface DropRow {
  monster_id: string; item_id: string; chance: number;
}
interface ItemRow {
  id: string; name: string; description: string;
  body_color: number; gem_color: number;
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const { pathname } = new URL(request.url);

    if (pathname === '/api/monsters') {
      const [monstersRes, dropsRes] = await Promise.all([
        env.DB.prepare('SELECT * FROM monsters').all<MonsterRow>(),
        env.DB.prepare('SELECT monster_id, item_id, chance FROM monster_drops').all<DropRow>(),
      ]);
      const drops = dropsRes.results;
      const monsters = monstersRes.results.map(m => ({
        id: m.id, name: m.name, hp: m.hp, exp: m.exp, damage: m.damage,
        bodyColor: m.body_color, shellColor: m.shell_color,
        drops: drops
          .filter(d => d.monster_id === m.id)
          .map(d => ({ itemId: d.item_id, chance: d.chance })),
      }));
      return Response.json(monsters, {
        headers: { 'Cache-Control': 'public, max-age=300' },
      });
    }

    if (pathname === '/api/items') {
      const { results } = await env.DB.prepare('SELECT * FROM items').all<ItemRow>();
      const items = results.map(i => ({
        id: i.id, name: i.name, description: i.description,
        bodyColor: i.body_color, gemColor: i.gem_color,
      }));
      return Response.json(items, {
        headers: { 'Cache-Control': 'public, max-age=300' },
      });
    }

    // API 외 모든 요청 → 정적 에셋
    return env.ASSETS.fetch(request);
  },
};
