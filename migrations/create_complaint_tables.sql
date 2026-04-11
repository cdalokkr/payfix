-- ============================================
-- Complaint & Ticket Management System Migration
-- Run this in Supabase SQL Editor
-- ============================================

-- Enums
DO $$ BEGIN
  CREATE TYPE ticket_status AS ENUM ('open', 'in_progress', 'resolved', 'closed', 'cancelled');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE ticket_priority AS ENUM ('low', 'medium', 'high', 'critical');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE call_log_status AS ENUM ('done', 'pending', 'cancelled');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE complaint_category AS ENUM ('billing', 'technical', 'service', 'product', 'general');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- Clients (CRM-style)
CREATE TABLE IF NOT EXISTS clients (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_name TEXT NOT NULL,
  contact_person TEXT,
  email TEXT,
  phone VARCHAR(20),
  alt_phone VARCHAR(20),
  gst_number VARCHAR(20),
  pan_number VARCHAR(15),
  website TEXT,
  industry TEXT,
  address_line1 TEXT,
  address_line2 TEXT,
  city TEXT,
  state TEXT,
  pincode VARCHAR(10),
  country TEXT DEFAULT 'India',
  contacts JSONB DEFAULT '[]',
  notes TEXT,
  status TEXT DEFAULT 'active',
  created_by UUID REFERENCES profiles(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Complaints
CREATE TABLE IF NOT EXISTS complaints (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  complaint_number VARCHAR(20) NOT NULL UNIQUE,
  client_id UUID REFERENCES clients(id) ON DELETE SET NULL,
  subject TEXT NOT NULL,
  description TEXT,
  category complaint_category DEFAULT 'general',
  priority ticket_priority DEFAULT 'medium',
  status ticket_status DEFAULT 'open',
  source TEXT DEFAULT 'email',
  sla_hours INTEGER DEFAULT 48,
  resolved_at TIMESTAMPTZ,
  closed_at TIMESTAMPTZ,
  created_by UUID REFERENCES profiles(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Tickets
CREATE TABLE IF NOT EXISTS tickets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ticket_number VARCHAR(20) NOT NULL UNIQUE,
  complaint_id UUID REFERENCES complaints(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  description TEXT,
  priority ticket_priority DEFAULT 'medium',
  status ticket_status DEFAULT 'open',
  due_date DATE,
  estimated_hours NUMERIC(6,2),
  actual_hours NUMERIC(6,2),
  created_by UUID REFERENCES profiles(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Ticket Assignments (multi-member)
CREATE TABLE IF NOT EXISTS ticket_assignments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ticket_id UUID NOT NULL REFERENCES tickets(id) ON DELETE CASCADE,
  assigned_to UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  assigned_by UUID REFERENCES profiles(id) ON DELETE SET NULL,
  role TEXT DEFAULT 'assignee',
  is_primary BOOLEAN DEFAULT false,
  assigned_at TIMESTAMPTZ DEFAULT now()
);

-- Ticket Resolutions
CREATE TABLE IF NOT EXISTS ticket_resolutions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ticket_id UUID NOT NULL REFERENCES tickets(id) ON DELETE CASCADE,
  resolved_by UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  resolution_text TEXT NOT NULL,
  remarks TEXT,
  hours_spent NUMERIC(6,2),
  status_after ticket_status DEFAULT 'in_progress',
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Call Logs
CREATE TABLE IF NOT EXISTS call_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ticket_id UUID REFERENCES tickets(id) ON DELETE CASCADE,
  complaint_id UUID REFERENCES complaints(id) ON DELETE CASCADE,
  client_id UUID REFERENCES clients(id) ON DELETE SET NULL,
  called_by UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  contact_name TEXT,
  contact_phone VARCHAR(20),
  call_type TEXT DEFAULT 'outbound',
  duration_minutes INTEGER,
  notes TEXT,
  remarks TEXT,
  status call_log_status DEFAULT 'pending',
  next_follow_up TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_complaints_client_id ON complaints(client_id);
CREATE INDEX IF NOT EXISTS idx_complaints_status ON complaints(status);
CREATE INDEX IF NOT EXISTS idx_complaints_priority ON complaints(priority);
CREATE INDEX IF NOT EXISTS idx_complaints_created_by ON complaints(created_by);
CREATE INDEX IF NOT EXISTS idx_complaints_created_at ON complaints(created_at);

CREATE INDEX IF NOT EXISTS idx_tickets_complaint_id ON tickets(complaint_id);
CREATE INDEX IF NOT EXISTS idx_tickets_status ON tickets(status);
CREATE INDEX IF NOT EXISTS idx_tickets_priority ON tickets(priority);
CREATE INDEX IF NOT EXISTS idx_tickets_due_date ON tickets(due_date);

CREATE INDEX IF NOT EXISTS idx_ticket_assignments_ticket_id ON ticket_assignments(ticket_id);
CREATE INDEX IF NOT EXISTS idx_ticket_assignments_assigned_to ON ticket_assignments(assigned_to);

CREATE INDEX IF NOT EXISTS idx_ticket_resolutions_ticket_id ON ticket_resolutions(ticket_id);
CREATE INDEX IF NOT EXISTS idx_ticket_resolutions_resolved_by ON ticket_resolutions(resolved_by);

CREATE INDEX IF NOT EXISTS idx_call_logs_ticket_id ON call_logs(ticket_id);
CREATE INDEX IF NOT EXISTS idx_call_logs_complaint_id ON call_logs(complaint_id);
CREATE INDEX IF NOT EXISTS idx_call_logs_status ON call_logs(status);
CREATE INDEX IF NOT EXISTS idx_call_logs_called_by ON call_logs(called_by);
CREATE INDEX IF NOT EXISTS idx_call_logs_created_at ON call_logs(created_at);

CREATE INDEX IF NOT EXISTS idx_clients_status ON clients(status);
CREATE INDEX IF NOT EXISTS idx_clients_company_name ON clients(company_name);

-- RLS Policies
ALTER TABLE clients ENABLE ROW LEVEL SECURITY;
ALTER TABLE complaints ENABLE ROW LEVEL SECURITY;
ALTER TABLE tickets ENABLE ROW LEVEL SECURITY;
ALTER TABLE ticket_assignments ENABLE ROW LEVEL SECURITY;
ALTER TABLE ticket_resolutions ENABLE ROW LEVEL SECURITY;
ALTER TABLE call_logs ENABLE ROW LEVEL SECURITY;

-- Allow authenticated users to read all (role-based filtering done in app layer)
CREATE POLICY "Allow authenticated read" ON clients FOR SELECT TO authenticated USING (true);
CREATE POLICY "Allow authenticated read" ON complaints FOR SELECT TO authenticated USING (true);
CREATE POLICY "Allow authenticated read" ON tickets FOR SELECT TO authenticated USING (true);
CREATE POLICY "Allow authenticated read" ON ticket_assignments FOR SELECT TO authenticated USING (true);
CREATE POLICY "Allow authenticated read" ON ticket_resolutions FOR SELECT TO authenticated USING (true);
CREATE POLICY "Allow authenticated read" ON call_logs FOR SELECT TO authenticated USING (true);

-- Allow authenticated users to insert/update (role checking done in app)
CREATE POLICY "Allow authenticated insert" ON clients FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Allow authenticated update" ON clients FOR UPDATE TO authenticated USING (true);
CREATE POLICY "Allow authenticated insert" ON complaints FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Allow authenticated update" ON complaints FOR UPDATE TO authenticated USING (true);
CREATE POLICY "Allow authenticated insert" ON tickets FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Allow authenticated update" ON tickets FOR UPDATE TO authenticated USING (true);
CREATE POLICY "Allow authenticated insert" ON ticket_assignments FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Allow authenticated update" ON ticket_assignments FOR UPDATE TO authenticated USING (true);
CREATE POLICY "Allow authenticated delete" ON ticket_assignments FOR DELETE TO authenticated USING (true);
CREATE POLICY "Allow authenticated insert" ON ticket_resolutions FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Allow authenticated insert" ON call_logs FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Allow authenticated update" ON call_logs FOR UPDATE TO authenticated USING (true);

-- Service role full access
CREATE POLICY "Service role full access" ON clients FOR ALL TO service_role USING (true);
CREATE POLICY "Service role full access" ON complaints FOR ALL TO service_role USING (true);
CREATE POLICY "Service role full access" ON tickets FOR ALL TO service_role USING (true);
CREATE POLICY "Service role full access" ON ticket_assignments FOR ALL TO service_role USING (true);
CREATE POLICY "Service role full access" ON ticket_resolutions FOR ALL TO service_role USING (true);
CREATE POLICY "Service role full access" ON call_logs FOR ALL TO service_role USING (true);
