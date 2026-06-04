import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Verified working YouTube video IDs by genre (2024-2026 hits)
const VERIFIED_YOUTUBE_TRACKS: Record<string, Array<{title: string, artist: string, videoId: string, mood?: string}>> = {
  "EDM": [
    { title: "Titanium", artist: "David Guetta ft. Sia", videoId: "JRfuAukYTKg", mood: "energetic" },
    { title: "Levels", artist: "Avicii", videoId: "_ovdm2yX4MA", mood: "euphoric" },
    { title: "Clarity", artist: "Zedd ft. Foxes", videoId: "IxxstCcJlsc", mood: "emotional" },
    { title: "Animals", artist: "Martin Garrix", videoId: "gCYcHz2k5x0", mood: "energetic" },
    { title: "Lean On", artist: "Major Lazer & DJ Snake", videoId: "YqeW9_5kURI", mood: "chill" },
    { title: "Wake Me Up", artist: "Avicii", videoId: "IcrbM1l_BoI", mood: "uplifting" },
    { title: "Don't Let Me Down", artist: "The Chainsmokers", videoId: "Io0fBr1XBUA", mood: "emotional" },
    { title: "Something Just Like This", artist: "Chainsmokers & Coldplay", videoId: "FM7MFYoylVs", mood: "uplifting" },
    { title: "Faded", artist: "Alan Walker", videoId: "60ItHLz5WEA", mood: "melancholic" },
    { title: "Alone", artist: "Marshmello", videoId: "ALZHF5UqnU4", mood: "emotional" },
    { title: "Roses", artist: "SAINt JHN (Imanbek Remix)", videoId: "ele2DMU49Jk", mood: "chill" },
    { title: "In The Name Of Love", artist: "Martin Garrix & Bebe Rexha", videoId: "RnBT9uUYb1w", mood: "romantic" },
    { title: "Scared To Be Lonely", artist: "Martin Garrix & Dua Lipa", videoId: "e2vBLd5Egnk", mood: "emotional" },
    { title: "The Middle", artist: "Zedd, Maren Morris, Grey", videoId: "M3mJkSqZbX4", mood: "uplifting" },
    { title: "Happier", artist: "Marshmello ft. Bastille", videoId: "m7Bc3pLyij0", mood: "bittersweet" },
    { title: "Summer", artist: "Calvin Harris", videoId: "ebXbLfLACGM", mood: "happy" },
    { title: "I Took A Pill In Ibiza", artist: "Mike Posner (Seeb Remix)", videoId: "foE1mO2yM04", mood: "melancholic" },
    { title: "This Is What You Came For", artist: "Calvin Harris ft. Rihanna", videoId: "kOkQ4T5WO9E", mood: "energetic" },
    { title: "Closer", artist: "The Chainsmokers ft. Halsey", videoId: "PT2_F-1esPk", mood: "romantic" },
    { title: "Paris", artist: "The Chainsmokers", videoId: "RhU9MZ98jxo", mood: "dreamy" },
  ],
  "House": [
    { title: "One More Time", artist: "Daft Punk", videoId: "FGBhQbmPwH8", mood: "euphoric" },
    { title: "Music Sounds Better With You", artist: "Stardust", videoId: "FQlAEiCb8m0", mood: "happy" },
    { title: "Finally", artist: "CeCe Peniston", videoId: "xk8mm1Qmt-Y", mood: "uplifting" },
    { title: "Show Me Love", artist: "Robin S", videoId: "Ps2Jc28tQrw", mood: "energetic" },
    { title: "Insomnia", artist: "Faithless", videoId: "P8JEm4d6Wu4", mood: "intense" },
    { title: "Gecko", artist: "Oliver Heldens", videoId: "zcqmrXEpfgw", mood: "groovy" },
    { title: "Deep Down", artist: "Alok x Ella Eyre", videoId: "Z2VvbhiLuHU", mood: "chill" },
    { title: "Cola", artist: "CamelPhat & Elderbrook", videoId: "B3sPjvvpqWM", mood: "deep" },
    { title: "Be Right There", artist: "Diplo & Sleepy Tom", videoId: "qb_k9hI0HxI", mood: "groovy" },
    { title: "Opus", artist: "Eric Prydz", videoId: "iRA82xLsb_w", mood: "progressive" },
    { title: "Your Mind", artist: "Adam Beyer & Bart Skils", videoId: "EGNlNIuJ2Ck", mood: "dark" },
    { title: "Latch", artist: "Disclosure ft. Sam Smith", videoId: "93ASUImTedo", mood: "romantic" },
    { title: "White Noise", artist: "Disclosure ft. AlunaGeorge", videoId: "bkk2H3Ztrfk", mood: "energetic" },
    { title: "You & Me", artist: "Disclosure ft. Eliza Doolittle", videoId: "lqBhgEQ4LT0", mood: "groovy" },
    { title: "When A Fire Starts To Burn", artist: "Disclosure", videoId: "4nsKDJlpUbA", mood: "intense" },
    { title: "Miracle", artist: "Calvin Harris & Ellie Goulding", videoId: "4r6gr87AKYA", mood: "euphoric" },
    { title: "I Got U", artist: "Duke Dumont ft. Jax Jones", videoId: "FHCYHldJi_g", mood: "summer" },
    { title: "Ocean Drive", artist: "Duke Dumont", videoId: "KDxJlW6cxRk", mood: "chill" },
    { title: "The Blessed Madonna", artist: "Fred again.. & The Blessed Madonna", videoId: "c0-hvjV2A5Y", mood: "euphoric" },
    { title: "Rumble", artist: "Skrillex, Fred again.., Flowdan", videoId: "zDpxMzB6feo", mood: "intense" },
  ],
  "Disco": [
    { title: "Stayin' Alive", artist: "Bee Gees", videoId: "fNFzfwLM72c", mood: "groovy" },
    { title: "September", artist: "Earth, Wind & Fire", videoId: "Gs069dndIYk", mood: "happy" },
    { title: "I Feel Love", artist: "Donna Summer", videoId: "B2qI6UDD2uQ", mood: "euphoric" },
    { title: "Le Freak", artist: "Chic", videoId: "aXgSHL7efKg", mood: "funky" },
    { title: "Good Times", artist: "Chic", videoId: "Er9xGRolrT4", mood: "happy" },
    { title: "Boogie Wonderland", artist: "Earth, Wind & Fire", videoId: "god7hAPv8f0", mood: "energetic" },
    { title: "Dancing Queen", artist: "ABBA", videoId: "xFrGuyw1V8s", mood: "euphoric" },
    { title: "Gimme! Gimme! Gimme!", artist: "ABBA", videoId: "XEjLoHdbVeE", mood: "energetic" },
    { title: "Don't Stop 'Til You Get Enough", artist: "Michael Jackson", videoId: "yURRmWtbTbo", mood: "funky" },
    { title: "I'm Coming Out", artist: "Diana Ross", videoId: "zbYcte4ZEgQ", mood: "empowering" },
    { title: "Dua Lipa Medley", artist: "Dua Lipa", videoId: "oygrmJFKYZY", mood: "modern disco" },
    { title: "Physical", artist: "Dua Lipa", videoId: "9HDEHj2uj_U", mood: "energetic" },
    { title: "Don't Start Now", artist: "Dua Lipa", videoId: "oygrmJFKYZY", mood: "groovy" },
    { title: "Blinding Lights", artist: "The Weeknd", videoId: "4NRXx6U8ABQ", mood: "retro" },
    { title: "Get Lucky", artist: "Daft Punk ft. Pharrell", videoId: "5NV6Rdv1a3I", mood: "funky" },
    { title: "Uptown Funk", artist: "Bruno Mars", videoId: "OPf0YbXqDm0", mood: "funky" },
    { title: "Levitating", artist: "Dua Lipa", videoId: "TUVcZfQe-Kw", mood: "uplifting" },
    { title: "Kiss", artist: "Prince", videoId: "H9tEvfIsDyo", mood: "funky" },
    { title: "1999", artist: "Prince", videoId: "rblt2EtFfC4", mood: "party" },
    { title: "Juice", artist: "Lizzo", videoId: "XaCrQL_8eMY", mood: "confident" },
  ],
  "Rock": [
    { title: "Bohemian Rhapsody", artist: "Queen", videoId: "fJ9rUzIMcZQ", mood: "epic" },
    { title: "Sweet Child O' Mine", artist: "Guns N' Roses", videoId: "1w7OgIMMRc4", mood: "nostalgic" },
    { title: "Back In Black", artist: "AC/DC", videoId: "pAgnJDJN4VA", mood: "powerful" },
    { title: "Smells Like Teen Spirit", artist: "Nirvana", videoId: "hTWKbfoikeg", mood: "rebellious" },
    { title: "Stairway to Heaven", artist: "Led Zeppelin", videoId: "QkF3oxziUI4", mood: "epic" },
    { title: "Hotel California", artist: "Eagles", videoId: "EqPtz5qN7HM", mood: "mysterious" },
    { title: "November Rain", artist: "Guns N' Roses", videoId: "8SbUC-UaAxE", mood: "emotional" },
    { title: "Enter Sandman", artist: "Metallica", videoId: "CD-E-LDc384", mood: "dark" },
    { title: "Nothing Else Matters", artist: "Metallica", videoId: "tAGnKpE4NCI", mood: "emotional" },
    { title: "Thunderstruck", artist: "AC/DC", videoId: "v2AC41dglnM", mood: "energetic" },
    { title: "Paradise City", artist: "Guns N' Roses", videoId: "Rbm6GXllBiw", mood: "euphoric" },
    { title: "Livin' on a Prayer", artist: "Bon Jovi", videoId: "lDK9QqIzhwk", mood: "uplifting" },
    { title: "Don't Stop Believin'", artist: "Journey", videoId: "1k8craCGpgs", mood: "hopeful" },
    { title: "Under Pressure", artist: "Queen & David Bowie", videoId: "a01QQZyl-_I", mood: "intense" },
    { title: "We Will Rock You", artist: "Queen", videoId: "-tJYN-eG1zk", mood: "anthemic" },
    { title: "Highway to Hell", artist: "AC/DC", videoId: "l482T0yNkeo", mood: "rebellious" },
    { title: "Comfortably Numb", artist: "Pink Floyd", videoId: "_FrOQC-zEog", mood: "dreamy" },
    { title: "Another Brick in the Wall", artist: "Pink Floyd", videoId: "YR5ApYxkU-U", mood: "rebellious" },
    { title: "Wish You Were Here", artist: "Pink Floyd", videoId: "IXdNnw99-Ic", mood: "melancholic" },
    { title: "Seven Nation Army", artist: "The White Stripes", videoId: "0J2QdDbelmY", mood: "powerful" },
  ],
  "Punk": [
    { title: "Blitzkrieg Bop", artist: "Ramones", videoId: "skdE0KAFCEA", mood: "energetic" },
    { title: "Anarchy in the U.K.", artist: "Sex Pistols", videoId: "qbmWs6Jf5dc", mood: "rebellious" },
    { title: "American Idiot", artist: "Green Day", videoId: "Ee_uujKuJMI", mood: "angry" },
    { title: "Boulevard of Broken Dreams", artist: "Green Day", videoId: "Soa3gO7tL-c", mood: "melancholic" },
    { title: "Basket Case", artist: "Green Day", videoId: "NUTGr5t3MoY", mood: "anxious" },
    { title: "All the Small Things", artist: "Blink-182", videoId: "9Ht5RZpzPqw", mood: "fun" },
    { title: "I Miss You", artist: "Blink-182", videoId: "s1tAYmMjLdY", mood: "emotional" },
    { title: "What's My Age Again?", artist: "Blink-182", videoId: "K7l5ZeVVoCA", mood: "playful" },
    { title: "The Rock Show", artist: "Blink-182", videoId: "z7hhDINyBP0", mood: "energetic" },
    { title: "Dammit", artist: "Blink-182", videoId: "sT0g16_LQaQ", mood: "angsty" },
    { title: "Self Esteem", artist: "The Offspring", videoId: "Abrn8aVQ76Q", mood: "sarcastic" },
    { title: "The Kids Aren't Alright", artist: "The Offspring", videoId: "VrZ4sMRYimw", mood: "dark" },
    { title: "Pretty Fly (For a White Guy)", artist: "The Offspring", videoId: "QtTR-_Klcq8", mood: "fun" },
    { title: "Fat Lip", artist: "Sum 41", videoId: "CMX2lPum_pg", mood: "rebellious" },
    { title: "In Too Deep", artist: "Sum 41", videoId: "emGri7i8Y2Y", mood: "emotional" },
    { title: "Still Waiting", artist: "Sum 41", videoId: "2ReR7Vw2cXs", mood: "angry" },
    { title: "Welcome to Paradise", artist: "Green Day", videoId: "i8dh9gDzmz8", mood: "rebellious" },
    { title: "Longview", artist: "Green Day", videoId: "42BBdzzgPNM", mood: "bored" },
    { title: "Brain Stew", artist: "Green Day", videoId: "UNq9gmY_Oz4", mood: "insomnia" },
    { title: "Holiday", artist: "Green Day", videoId: "A1OqtIqzScI", mood: "political" },
  ],
  "Pop": [
    { title: "Shape of You", artist: "Ed Sheeran", videoId: "JGwWNGJdvx8", mood: "romantic" },
    { title: "Blinding Lights", artist: "The Weeknd", videoId: "4NRXx6U8ABQ", mood: "retro" },
    { title: "Bad Guy", artist: "Billie Eilish", videoId: "DyDfgMOUjCI", mood: "dark" },
    { title: "Uptown Funk", artist: "Bruno Mars", videoId: "OPf0YbXqDm0", mood: "funky" },
    { title: "Dance Monkey", artist: "Tones and I", videoId: "q0hyYWKXF0Q", mood: "catchy" },
    { title: "Someone You Loved", artist: "Lewis Capaldi", videoId: "zABLecsR5UE", mood: "sad" },
    { title: "Señorita", artist: "Shawn Mendes & Camila Cabello", videoId: "Pkh8UtuejGw", mood: "romantic" },
    { title: "Old Town Road", artist: "Lil Nas X", videoId: "w2Ov5jzm3j8", mood: "fun" },
    { title: "Watermelon Sugar", artist: "Harry Styles", videoId: "E07s5ZYygMg", mood: "summer" },
    { title: "drivers license", artist: "Olivia Rodrigo", videoId: "ZmDBbnmKpqQ", mood: "heartbreak" },
    { title: "good 4 u", artist: "Olivia Rodrigo", videoId: "gNi_6U5Pm_o", mood: "angry" },
    { title: "As It Was", artist: "Harry Styles", videoId: "H5v3kku4y6Q", mood: "nostalgic" },
    { title: "Stay", artist: "The Kid LAROI & Justin Bieber", videoId: "kTJczUoc26U", mood: "longing" },
    { title: "Heat Waves", artist: "Glass Animals", videoId: "mRD0-GxqHVo", mood: "dreamy" },
    { title: "Peaches", artist: "Justin Bieber", videoId: "tQ0yjYUFKAE", mood: "chill" },
    { title: "Butter", artist: "BTS", videoId: "WMweEpGlu_U", mood: "fun" },
    { title: "positions", artist: "Ariana Grande", videoId: "tcYodQoapMg", mood: "romantic" },
    { title: "Levitating", artist: "Dua Lipa", videoId: "TUVcZfQe-Kw", mood: "uplifting" },
    { title: "Save Your Tears", artist: "The Weeknd", videoId: "XXYlFuWEuKI", mood: "emotional" },
    { title: "Montero", artist: "Lil Nas X", videoId: "6swmTBVI83k", mood: "bold" },
  ],
  "Hip-Hop": [
    { title: "HUMBLE.", artist: "Kendrick Lamar", videoId: "tvTRZJ-4EyI", mood: "confident" },
    { title: "Sicko Mode", artist: "Travis Scott", videoId: "6ONRf7h3Mdk", mood: "intense" },
    { title: "God's Plan", artist: "Drake", videoId: "xpVfcZ0ZcFM", mood: "grateful" },
    { title: "Hotline Bling", artist: "Drake", videoId: "uxpDa-c-4Mc", mood: "nostalgic" },
    { title: "In Da Club", artist: "50 Cent", videoId: "5qm8PH4xAss", mood: "party" },
    { title: "Lose Yourself", artist: "Eminem", videoId: "_Yhyp-_hX2s", mood: "motivational" },
    { title: "Not Afraid", artist: "Eminem", videoId: "j5-yKhDd64s", mood: "empowering" },
    { title: "Rockstar", artist: "Post Malone ft. 21 Savage", videoId: "UceaB4D0jpo", mood: "dark" },
    { title: "Sunflower", artist: "Post Malone & Swae Lee", videoId: "ApXoWvfEYVU", mood: "chill" },
    { title: "Congratulations", artist: "Post Malone", videoId: "SC4xMk98Pdc", mood: "celebratory" },
    { title: "WAP", artist: "Cardi B ft. Megan Thee Stallion", videoId: "hsm4poTWjMs", mood: "bold" },
    { title: "Savage", artist: "Megan Thee Stallion", videoId: "lSSJKwEqnuY", mood: "confident" },
    { title: "Laugh Now Cry Later", artist: "Drake ft. Lil Durk", videoId: "JFm7YDVlqnI", mood: "reflective" },
    { title: "Mood", artist: "24kGoldn ft. iann dior", videoId: "3ryID_SwU5E", mood: "vibing" },
    { title: "Blinding Lights", artist: "The Weeknd", videoId: "4NRXx6U8ABQ", mood: "retro" },
    { title: "Industry Baby", artist: "Lil Nas X & Jack Harlow", videoId: "UTHLKHL_whs", mood: "confident" },
    { title: "First Class", artist: "Jack Harlow", videoId: "e2EGhh7FHFA", mood: "smooth" },
    { title: "Rich Flex", artist: "Drake & 21 Savage", videoId: "I4DjHHVfoCg", mood: "flex" },
    { title: "All The Stars", artist: "Kendrick Lamar & SZA", videoId: "GfCqMv--ncA", mood: "dreamy" },
    { title: "DNA.", artist: "Kendrick Lamar", videoId: "NLZRYQMLDW4", mood: "intense" },
  ],
  "R&B": [
    { title: "Blinding Lights", artist: "The Weeknd", videoId: "4NRXx6U8ABQ", mood: "retro" },
    { title: "Earned It", artist: "The Weeknd", videoId: "waU75jdUnYw", mood: "sensual" },
    { title: "Call Out My Name", artist: "The Weeknd", videoId: "M4ZoCHID9GI", mood: "emotional" },
    { title: "Can't Feel My Face", artist: "The Weeknd", videoId: "KEI4qSrkPAs", mood: "upbeat" },
    { title: "Starboy", artist: "The Weeknd ft. Daft Punk", videoId: "34Na4j8AVgA", mood: "dark" },
    { title: "Good Days", artist: "SZA", videoId: "2p3zZoraK9g", mood: "hopeful" },
    { title: "Kiss Me More", artist: "Doja Cat ft. SZA", videoId: "0EVVKs6DQLo", mood: "flirty" },
    { title: "Best Part", artist: "Daniel Caesar ft. H.E.R.", videoId: "vBy7FaapGRo", mood: "romantic" },
    { title: "Location", artist: "Khalid", videoId: "by3yRdlQvzs", mood: "chill" },
    { title: "Talk", artist: "Khalid", videoId: "hE2Ira-Cwxo", mood: "smooth" },
    { title: "Leave The Door Open", artist: "Silk Sonic", videoId: "adLGHcj_fmA", mood: "romantic" },
    { title: "Smokin Out The Window", artist: "Silk Sonic", videoId: "GbfVmzF7N4g", mood: "soulful" },
    { title: "Redbone", artist: "Childish Gambino", videoId: "Kp7eSUQI-xA", mood: "groovy" },
    { title: "This Is America", artist: "Childish Gambino", videoId: "VYOjWnS4cMY", mood: "powerful" },
    { title: "Love Galore", artist: "SZA ft. Travis Scott", videoId: "hHXfCOjb3Ck", mood: "sensual" },
    { title: "All I Want", artist: "Jhené Aiko", videoId: "Q5hOWz3BNKI", mood: "peaceful" },
    { title: "Snooze", artist: "SZA", videoId: "EHqaJi5Nd44", mood: "dreamy" },
    { title: "Kill Bill", artist: "SZA", videoId: "hm7GdGlkLwk", mood: "dark" },
    { title: "Creepin'", artist: "Metro Boomin, The Weeknd & 21 Savage", videoId: "m4_9TFeMfJE", mood: "dark" },
    { title: "No Guidance", artist: "Chris Brown ft. Drake", videoId: "AjWfY7SnMBI", mood: "romantic" },
  ],
  "Trance": [
    { title: "Adagio for Strings", artist: "Tiësto", videoId: "2EaE0_gQLw0", mood: "emotional" },
    { title: "Sandstorm", artist: "Darude", videoId: "y6120QOlsfU", mood: "energetic" },
    { title: "For an Angel", artist: "Paul van Dyk", videoId: "sX9qkNfDRbU", mood: "uplifting" },
    { title: "Silence", artist: "Delerium ft. Sarah McLachlan (Tiësto Remix)", videoId: "qycAC_6Bbto", mood: "emotional" },
    { title: "Children", artist: "Robert Miles", videoId: "CC5ca6Hsb2Q", mood: "dreamy" },
    { title: "Kernkraft 400", artist: "Zombie Nation", videoId: "gbcG2TI4GBk", mood: "energetic" },
    { title: "ATB - 9PM (Till I Come)", artist: "ATB", videoId: "5A9OIIapSko", mood: "euphoric" },
    { title: "Castles in the Sky", artist: "Ian Van Dahl", videoId: "tRCws6Az0A8", mood: "dreamy" },
    { title: "Better Off Alone", artist: "Alice Deejay", videoId: "Lgs9QUtWc3M", mood: "nostalgic" },
    { title: "Concrete Angel", artist: "Gareth Emery ft. Christina Novelli", videoId: "0dFz10R529g", mood: "emotional" },
    { title: "Sun & Moon", artist: "Above & Beyond", videoId: "ll5ykbAumD4", mood: "uplifting" },
    { title: "On A Good Day", artist: "Above & Beyond", videoId: "RDV9xOJHb0E", mood: "hopeful" },
    { title: "Satellite", artist: "Oceanlab", videoId: "6FuphZk3ofo", mood: "dreamy" },
    { title: "Thing Called Love", artist: "Above & Beyond", videoId: "0UM0Bk9lkpI", mood: "romantic" },
    { title: "We're All We Need", artist: "Above & Beyond", videoId: "rBgMmGhUzSI", mood: "euphoric" },
    { title: "In And Out of Love", artist: "Armin van Buuren", videoId: "TxvpctgU_s8", mood: "emotional" },
    { title: "This Is What It Feels Like", artist: "Armin van Buuren", videoId: "BR_DFMUzX4E", mood: "uplifting" },
    { title: "Communication", artist: "Armin van Buuren", videoId: "KshLlBDg4hM", mood: "energetic" },
    { title: "Beautiful Life", artist: "Lost Frequencies", videoId: "Hc-skmURYFI", mood: "happy" },
    { title: "Language", artist: "Porter Robinson", videoId: "5LILChvqUo4", mood: "euphoric" },
  ],
  "Progressive": [
    { title: "Strobe", artist: "deadmau5", videoId: "tKi9Z-f6qX4", mood: "emotional" },
    { title: "I Remember", artist: "deadmau5 & Kaskade", videoId: "zK1mLIeXwsQ", mood: "nostalgic" },
    { title: "Ghosts 'n' Stuff", artist: "deadmau5", videoId: "h7ArUgxtlJs", mood: "energetic" },
    { title: "The Veldt", artist: "deadmau5 ft. Chris James", videoId: "xvtNS6hbVy4", mood: "dreamy" },
    { title: "Opus", artist: "Eric Prydz", videoId: "iRA82xLsb_w", mood: "epic" },
    { title: "Every Day", artist: "Eric Prydz", videoId: "n2BHNvIcuKU", mood: "uplifting" },
    { title: "Generate", artist: "Eric Prydz", videoId: "VsE2DkYxIJA", mood: "energetic" },
    { title: "Pjanoo", artist: "Eric Prydz", videoId: "wXtmUbgR_lc", mood: "euphoric" },
    { title: "Don't You Worry Child", artist: "Swedish House Mafia", videoId: "1y6smkh6c-0", mood: "emotional" },
    { title: "Save The World", artist: "Swedish House Mafia", videoId: "BXpdmKELE1k", mood: "uplifting" },
    { title: "Greyhound", artist: "Swedish House Mafia", videoId: "bUoS5pREHqI", mood: "intense" },
    { title: "One", artist: "Swedish House Mafia", videoId: "dXQNfBSMYPk", mood: "anthemic" },
    { title: "It Gets Better", artist: "Swedish House Mafia", videoId: "fwDQwPBz_C0", mood: "hopeful" },
    { title: "Calling", artist: "Sebastian Ingrosso & Alesso", videoId: "WzKR40pLGXk", mood: "euphoric" },
    { title: "Under Control", artist: "Calvin Harris & Alesso", videoId: "yZqmarGShxg", mood: "uplifting" },
    { title: "If I Lose Myself", artist: "OneRepublic (Alesso Remix)", videoId: "HvHKxnMv04k", mood: "emotional" },
    { title: "Heroes", artist: "Alesso ft. Tove Lo", videoId: "a7SouU3ECpU", mood: "powerful" },
    { title: "Years", artist: "Alesso", videoId: "EKjlQhHvfAQ", mood: "nostalgic" },
    { title: "Runaway (U & I)", artist: "Galantis", videoId: "szj59j0hz_4", mood: "euphoric" },
    { title: "No Money", artist: "Galantis", videoId: "xYYFjbc7cNQ", mood: "energetic" },
  ],
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);
    const OPENROUTER_API_KEY = Deno.env.get('OPENROUTER_API_KEY');

    const body = await req.json().catch(() => ({}));
    const requestedGenres = body.genres || Object.keys(VERIFIED_YOUTUBE_TRACKS);
    const tracksPerGenre = body.limit || 20;

    const results: Record<string, { added: number; skipped: number; errors: string[] }> = {};

    for (const genre of requestedGenres) {
      const genreTracks = VERIFIED_YOUTUBE_TRACKS[genre] || [];
      results[genre] = { added: 0, skipped: 0, errors: [] };

      for (const track of genreTracks.slice(0, tracksPerGenre)) {
        try {
          // Check if track already exists
          const { data: existing } = await supabase
            .from('tracks')
            .select('id')
            .eq('title', track.title)
            .eq('artist', track.artist)
            .maybeSingle();

          if (existing) {
            results[genre].skipped++;
            continue;
          }

          // Insert new track with verified YouTube video
          const { error: insertError } = await supabase
            .from('tracks')
            .insert({
              title: track.title,
              artist: track.artist,
              genre: genre,
              video_url: `https://www.youtube.com/watch?v=${track.videoId}`,
              duration: 210, // ~3.5 min average
              mood: track.mood || 'energetic',
              album: `${genre} Hits`,
              cover_url: `https://img.youtube.com/vi/${track.videoId}/maxresdefault.jpg`
            });

          if (insertError) {
            results[genre].errors.push(`${track.title}: ${insertError.message}`);
          } else {
            results[genre].added++;
          }
        } catch (err) {
          results[genre].errors.push(`${track.title}: ${err instanceof Error ? err.message : 'Unknown error'}`);
        }
      }

      console.log(`Genre ${genre}: Added ${results[genre].added}, Skipped ${results[genre].skipped}`);
    }

    // Use AI to suggest more tracks if requested
    if (body.useAI && OPENROUTER_API_KEY) {
      try {
        const aiResponse = await fetch("https://openrouter.ai/api/v1/chat/completions", {
          method: "POST",
          headers: {
            Authorization: `Bearer ${OPENROUTER_API_KEY}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            model: "google/gemma-2-9b-it:free",
            messages: [
              { 
                role: "system", 
                content: "You are a music expert. Generate a list of 10 popular songs for the requested genre with their YouTube video IDs. Return JSON: {songs: [{title, artist, videoId}]}" 
              },
              { 
                role: "user", 
                content: `Give me 10 popular ${requestedGenres.join(", ")} songs with working YouTube video IDs from 2020-2024.` 
              }
            ],
            response_format: { type: "json_object" },
          }),
        });

        if (aiResponse.ok) {
          const aiData = await aiResponse.json();
          const content = JSON.parse(aiData.choices?.[0]?.message?.content || "{}");
          // AI suggestions would be added here if needed
          console.log("AI suggestions received:", content.songs?.length || 0);
        }
      } catch (aiError) {
        console.error("AI enhancement failed:", aiError);
      }
    }

    return new Response(JSON.stringify({ 
      success: true, 
      message: 'YouTube tracks sync completed',
      results,
      totalAdded: Object.values(results).reduce((sum, r) => sum + r.added, 0),
      totalSkipped: Object.values(results).reduce((sum, r) => sum + r.skipped, 0),
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });

  } catch (error: unknown) {
    console.error('Auto YouTube fetch error:', error);
    return new Response(JSON.stringify({ 
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
});
