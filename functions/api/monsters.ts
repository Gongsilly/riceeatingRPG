interface Env {
  DB: D1Database;
}

interface MonsterRow {
  id:          string;
  name:        string;
  hp:          number;
  exp:         number;
  damage:      number;
  body_color:  number;
  shell_color: number;
}

interface DropRow {
  monster_id: string;
  item_id:    string;
  chance:     number;
}

export const onRequestGet: PagesFunction<Env> = async ({ env }) => {
  const [monstersResult, dropsResult] = await Promise.all([
    env.DB.prepare('SELECT * FROM monsters').all<MonsterRow>(),
    env.DB.prepare('SELECT monster_id, item_id, chance FROM monster_drops').all<DropRow>(),
  ]);

  const drops = dropsResult.results;

  const monsters = monstersResult.results.map(m => ({
    id:         m.id,
    name:       m.name,
    hp:         m.hp,
    exp:        m.exp,
    damage:     m.damage,
    bodyColor:  m.body_color,
    shellColor: m.shell_color,
    drops: drops
      .filter(d => d.monster_id === m.id)
      .map(d => ({ itemId: d.item_id, chance: d.chance })),
  }));

  return Response.json(monsters, {
    headers: { 'Cache-Control': 'public, max-age=300' },
  });
};
