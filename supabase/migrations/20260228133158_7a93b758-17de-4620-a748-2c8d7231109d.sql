
-- Delete related records first (cascading cleanup)
DELETE FROM playlist_tracks WHERE track_id IN (
  SELECT id FROM tracks WHERE artist ILIKE '%bensound%' OR artist ILIKE '%kevin macleod%' OR artist ILIKE '%scott buckley%' OR artist ILIKE '%purple planet%' OR artist ILIKE '%audionautix%'
);

DELETE FROM liked_songs WHERE track_id IN (
  SELECT id FROM tracks WHERE artist ILIKE '%bensound%' OR artist ILIKE '%kevin macleod%' OR artist ILIKE '%scott buckley%' OR artist ILIKE '%purple planet%' OR artist ILIKE '%audionautix%'
);

DELETE FROM listening_history WHERE track_id IN (
  SELECT id FROM tracks WHERE artist ILIKE '%bensound%' OR artist ILIKE '%kevin macleod%' OR artist ILIKE '%scott buckley%' OR artist ILIKE '%purple planet%' OR artist ILIKE '%audionautix%'
);

-- Delete the tracks themselves
DELETE FROM tracks WHERE artist ILIKE '%bensound%' OR artist ILIKE '%kevin macleod%' OR artist ILIKE '%scott buckley%' OR artist ILIKE '%purple planet%' OR artist ILIKE '%audionautix%';
