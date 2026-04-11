
UPDATE auth.users 
SET 
  confirmation_token = '',
  recovery_token = '',
  email_change_token_new = '',
  email_change_token_current = '',
  reauthentication_token = '',
  is_sso_user = false,
  phone = '',
  phone_change_token = '',
  phone_change = '',
  email_change = '',
  banned_until = NULL
WHERE email = 'contato@vidalweb.com.br';
