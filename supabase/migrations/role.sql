-- Ažuriraj role za korisnike na osnovu email-a
UPDATE public.profiles 
SET role = 'admin' 
WHERE email = 'admin@gse.control';

UPDATE public.profiles 
SET role = 'engineer' 
WHERE email = 'engineer@gse.control';

UPDATE public.profiles 
SET role = 'operator' 
WHERE email = 'operator@gse.control';

-- Ako profile ne postoji za admin korisnika, kreiraj ga ručno:
INSERT INTO public.profiles (id, email, full_name, card_id, role, department)
SELECT 
  au.id, 
  au.email, 
  COALESCE(au.raw_user_meta_data->>'full_name', 'Admin'),
  COALESCE(au.raw_user_meta_data->>'card_id', 'EMP-1005'),
  'admin',
  'Operations'
FROM auth.users au
WHERE au.email = 'admin@gse.control'
AND NOT EXISTS (
  SELECT 1 FROM public.profiles p WHERE p.id = au.id
);

-- Isto za engineer-a:
INSERT INTO public.profiles (id, email, full_name, card_id, role, department)
SELECT 
  au.id, 
  au.email, 
  COALESCE(au.raw_user_meta_data->>'full_name', 'Engineer'),
  COALESCE(au.raw_user_meta_data->>'card_id', 'EMP-1004'),
  'engineer',
  'Maintenance'
FROM auth.users au
WHERE au.email = 'engineer@gse.control'
AND NOT EXISTS (
  SELECT 1 FROM public.profiles p WHERE p.id = au.id
);

-- Isto za operator-a:
INSERT INTO public.profiles (id, email, full_name, card_id, role, department)
SELECT 
  au.id, 
  au.email, 
  COALESCE(au.raw_user_meta_data->>'full_name', 'Operator'),
  COALESCE(au.raw_user_meta_data->>'card_id', 'EMP-1001'),
  'operator',
  'Ramp'
FROM auth.users au
WHERE au.email = 'operator@gse.control'
AND NOT EXISTS (
  SELECT 1 FROM public.profiles p WHERE p.id = au.id
);

-- Provjeri rezultat:
SELECT p.email, p.role, p.full_name, p.card_id 
FROM public.profiles p 
ORDER BY p.role;