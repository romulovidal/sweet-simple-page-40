-- 1. Verificar UUID do admin
SELECT id, email FROM auth.users WHERE email = 'aragao@atalaias.online';

-- 2. Verificar registros na user_roles para este UUID
SELECT * FROM public.user_roles WHERE user_id = '5850679f-697b-4ec2-a47c-47b88a96bffa';

-- 3. Testar a função has_role manualmente como postgres
SELECT public.has_role('5850679f-697b-4ec2-a47c-47b88a96bffa', 'admin');

-- 4. Listar todas as roles deste usuário
SELECT role FROM public.user_roles WHERE user_id = '5850679f-697b-4ec2-a47c-47b88a96bffa';
