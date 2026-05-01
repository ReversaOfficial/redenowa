CREATE OR REPLACE FUNCTION public.handle_new_user()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  base_handle TEXT;
  final_handle TEXT;
  suffix INT := 0;
BEGIN
  base_handle := lower(regexp_replace(
    coalesce(
      NEW.raw_user_meta_data->>'handle',
      split_part(NEW.email, '@', 1),
      'user'
    ),
    '[^a-z0-9_]', '', 'g'
  ));
  IF char_length(base_handle) < 2 THEN
    base_handle := 'user' || substr(NEW.id::text, 1, 6);
  END IF;
  IF char_length(base_handle) > 20 THEN
    base_handle := substr(base_handle, 1, 20);
  END IF;

  final_handle := base_handle;
  WHILE EXISTS (SELECT 1 FROM public.profiles WHERE handle = final_handle) LOOP
    suffix := suffix + 1;
    final_handle := base_handle || suffix::text;
  END LOOP;

  INSERT INTO public.profiles (id, handle, display_name, avatar_url, city, state, country, date_of_birth)
  VALUES (
    NEW.id,
    final_handle,
    coalesce(
      NEW.raw_user_meta_data->>'display_name',
      NEW.raw_user_meta_data->>'full_name',
      NEW.raw_user_meta_data->>'name',
      final_handle
    ),
    NEW.raw_user_meta_data->>'avatar_url',
    NEW.raw_user_meta_data->>'city',
    NEW.raw_user_meta_data->>'state',
    NEW.raw_user_meta_data->>'country',
    CASE 
      WHEN NEW.raw_user_meta_data->>'date_of_birth' IS NOT NULL 
      THEN (NEW.raw_user_meta_data->>'date_of_birth')::date 
      ELSE NULL 
    END
  );
  RETURN NEW;
END;
$function$;