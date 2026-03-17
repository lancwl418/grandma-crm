-- GrandmaCRM Supabase Schema
-- 在 Supabase Dashboard → SQL Editor 中执行此脚本

-- ══════════════════════════════════════════════════
-- 1. clients 表
-- ══════════════════════════════════════════════════
CREATE TABLE clients (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT,
  remark_name TEXT NOT NULL,
  phone TEXT,
  wechat TEXT,
  birthday DATE,
  status TEXT NOT NULL DEFAULT '新客户',
  urgency TEXT NOT NULL DEFAULT 'medium'
    CHECK (urgency IN ('high', 'medium', 'low')),
  tags TEXT[] DEFAULT '{}',
  budget_min TEXT,
  budget_max TEXT,
  areas TEXT[] DEFAULT '{}',
  property_type TEXT,
  requirement_tags TEXT[] DEFAULT '{}',
  requirement_notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_clients_user_id ON clients(user_id);

-- updated_at 自动更新触发器
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_clients_updated_at
  BEFORE UPDATE ON clients
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- ══════════════════════════════════════════════════
-- 2. client_logs 表
-- ══════════════════════════════════════════════════
CREATE TABLE client_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id UUID NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
  date TIMESTAMPTZ NOT NULL,
  content TEXT NOT NULL,
  images TEXT[] DEFAULT '{}',
  next_action TEXT,
  next_action_todo TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_client_logs_client_id ON client_logs(client_id);
CREATE INDEX idx_client_logs_next_action ON client_logs(next_action)
  WHERE next_action IS NOT NULL;

-- ══════════════════════════════════════════════════
-- 3. RLS 策略
-- ══════════════════════════════════════════════════
ALTER TABLE clients ENABLE ROW LEVEL SECURITY;
ALTER TABLE client_logs ENABLE ROW LEVEL SECURITY;

-- clients: 用户只能操作自己的客户
CREATE POLICY "Users can view own clients"
  ON clients FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own clients"
  ON clients FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own clients"
  ON clients FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete own clients"
  ON clients FOR DELETE
  USING (auth.uid() = user_id);

-- client_logs: 用户只能操作自己客户的日志
CREATE POLICY "Users can view logs for own clients"
  ON client_logs FOR SELECT
  USING (EXISTS (
    SELECT 1 FROM clients
    WHERE clients.id = client_logs.client_id
    AND clients.user_id = auth.uid()
  ));

CREATE POLICY "Users can insert logs for own clients"
  ON client_logs FOR INSERT
  WITH CHECK (EXISTS (
    SELECT 1 FROM clients
    WHERE clients.id = client_logs.client_id
    AND clients.user_id = auth.uid()
  ));

CREATE POLICY "Users can update logs for own clients"
  ON client_logs FOR UPDATE
  USING (EXISTS (
    SELECT 1 FROM clients
    WHERE clients.id = client_logs.client_id
    AND clients.user_id = auth.uid()
  ));

CREATE POLICY "Users can delete logs for own clients"
  ON client_logs FOR DELETE
  USING (EXISTS (
    SELECT 1 FROM clients
    WHERE clients.id = client_logs.client_id
    AND clients.user_id = auth.uid()
  ));
