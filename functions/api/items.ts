interface Env {
  DB: D1Database;
}

interface ItemRow {
  id:          string;
  name:        string;
  description: string;
  body_color:  number;
  gem_color:   number;
}

export const onRequestGet: PagesFunction<Env> = async ({ env }) => {
  const { results } = await env.DB.prepare('SELECT * FROM items').all<ItemRow>();

  const items = results.map(i => ({
    id:          i.id,
    name:        i.name,
    description: i.description,
    bodyColor:   i.body_color,
    gemColor:    i.gem_color,
  }));

  return Response.json(items, {
    headers: { 'Cache-Control': 'public, max-age=300' },
  });
};
