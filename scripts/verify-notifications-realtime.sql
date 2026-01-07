-- Check if notifications table exists in Supabase realtime publication
SELECT 
    schemaname,
    tablename
FROM pg_publication_tables 
WHERE pubname = 'supabase_realtime'
ORDER BY tablename;

-- If notifications is NOT listed, run this to add it:
-- ALTER PUBLICATION supabase_realtime ADD TABLE notifications;

-- Check table exists
SELECT EXISTS (
    SELECT FROM information_schema.tables 
    WHERE table_schema = 'public' 
    AND table_name = 'notifications'
) as notifications_table_exists;

-- Check RLS is enabled
SELECT 
    schemaname,
    tablename,
    rowsecurity 
FROM pg_tables 
WHERE schemaname = 'public' 
AND tablename = 'notifications';
