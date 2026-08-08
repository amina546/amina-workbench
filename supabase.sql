-- Amina Workbench - Supabase Setup SQL
-- 在 Supabase SQL Editor 中运行以下代码

-- 1. 创建数据表
CREATE TABLE IF NOT EXISTS workbench_data (
  key TEXT PRIMARY KEY,
  value TEXT,
  updated_at BIGINT DEFAULT (extract(epoch from now()) * 1000)::BIGINT
);

-- 2. 创建密码配置表
CREATE TABLE IF NOT EXISTS workbench_config (
  id TEXT PRIMARY KEY DEFAULT 'main',
  password_hash TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- 3. 启用行级安全 (RLS)
ALTER TABLE workbench_data ENABLE ROW LEVEL SECURITY;
ALTER TABLE workbench_config ENABLE ROW LEVEL SECURITY;

-- 4. 允许 anon key 读写 (个人应用，密码在前端验证)
DROP POLICY IF EXISTS "allow_all_data" ON workbench_data;
CREATE POLICY "allow_all_data" ON workbench_data FOR ALL USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "allow_all_config" ON workbench_config;
CREATE POLICY "allow_all_config" ON workbench_config FOR ALL USING (true) WITH CHECK (true);
