-- 기존 D1 DB에 ap 컬럼 추가 (신규 DB는 auth_schema.sql로 자동 포함)
-- Cloudflare 대시보드 또는 wrangler d1 execute 로 실행할 것
ALTER TABLE CHARACTER_STATS ADD COLUMN ap INTEGER NOT NULL DEFAULT 0;
