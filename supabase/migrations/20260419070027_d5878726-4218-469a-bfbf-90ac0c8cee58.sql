UPDATE public.tiktok_stories
SET audio_url = REPLACE(audio_url, 'https://aa982512413f6d8c792ce6285ffe3df4.r2.cloudflarestorage.com/grouaistream-tracks', 'https://pub-46ecdc3a5ae341fcb16454d732eb9bcd.r2.dev'),
    image_urls = (
      SELECT jsonb_agg(
        to_jsonb(REPLACE(value::text, 'https://aa982512413f6d8c792ce6285ffe3df4.r2.cloudflarestorage.com/grouaistream-tracks', 'https://pub-46ecdc3a5ae341fcb16454d732eb9bcd.r2.dev'))
      )
      FROM jsonb_array_elements_text(image_urls) AS value
    )
WHERE audio_url LIKE '%r2.cloudflarestorage.com%';