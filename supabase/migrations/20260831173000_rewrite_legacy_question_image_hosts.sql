-- Question/mark-point images were uploaded under the legacy project host
-- (cbycwfhczyvzzhthpgsw). Files already live on the current project storage;
-- rewrite public URLs so student UI can load diagrams again.

update public.questions
set image_url = replace(
  image_url,
  'https://cbycwfhczyvzzhthpgsw.supabase.co',
  'https://hemcttqmhptwgxxrtolh.supabase.co'
)
where image_url like '%cbycwfhczyvzzhthpgsw.supabase.co%';

update public.mark_points
set image_url = replace(
  image_url,
  'https://cbycwfhczyvzzhthpgsw.supabase.co',
  'https://hemcttqmhptwgxxrtolh.supabase.co'
)
where image_url like '%cbycwfhczyvzzhthpgsw.supabase.co%';
