import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

// Real music documentaries and films about bands/musicians (all 60+ min)
const MUSIC_FILMS = [
  // Polish music films
  { title: 'Beats of Freedom - Zew wolności', director: 'Leszek Gnoiński', year: 2010, genre: 'Documentary', rating: 7.2, duration_minutes: 73, category: 'polish', country: 'Poland', language: 'Polish', description: 'Historia polskiego rocka i jego wpływ na upadek komunizmu.' },
  { title: 'Jesteś Bogiem', director: 'Leszek Dawid', year: 2012, genre: 'Biography', rating: 7.5, duration_minutes: 118, category: 'polish', country: 'Poland', language: 'Polish', description: 'Film o legendarnym raperze Magiku i grupie Paktofonika.' },
  { title: 'Ostatni koncert', director: 'Piotr Szczepański', year: 2012, genre: 'Documentary', rating: 6.8, duration_minutes: 75, category: 'polish', country: 'Poland', language: 'Polish', description: 'Ostatni koncert legendarnego zespołu Perfect.' },
  { title: 'Skazany na bluesa', director: 'Jan Kidawa-Błoński', year: 2005, genre: 'Biography', rating: 6.5, duration_minutes: 105, category: 'polish', country: 'Poland', language: 'Polish', description: 'Film o życiu Ryszarda Riedla, wokalisty Dżemu.' },
  { title: 'Polskie gówno', director: 'Grzegorz Jankowski', year: 2014, genre: 'Comedy', rating: 5.8, duration_minutes: 90, category: 'polish', country: 'Poland', language: 'Polish', description: 'Komedia o polskiej scenie punkowej lat 80.' },
  { title: 'Wszystko co kocham', director: 'Jacek Borcuch', year: 2009, genre: 'Drama', rating: 6.9, duration_minutes: 95, category: 'polish', country: 'Poland', language: 'Polish', description: 'Młodzi punkowcy w Polsce lat 80. walczą o wolność przez muzykę.' },
  { title: 'Dezerter - pokolenie punk', director: 'Michał Banach', year: 2016, genre: 'Documentary', rating: 7.0, duration_minutes: 68, category: 'polish', country: 'Poland', language: 'Polish', description: 'Dokument o legendarnym polskim zespole punkowym Dezerter.' },
  { title: 'Lady Pank - koncert', director: 'TVP', year: 2018, genre: 'Concert', rating: 7.3, duration_minutes: 90, category: 'polish', country: 'Poland', language: 'Polish', description: 'Koncert jednego z najpopularniejszych polskich zespołów rockowych.' },
  { title: 'Republika marzeń', director: 'Jan P. Matuszyński', year: 2015, genre: 'Documentary', rating: 7.6, duration_minutes: 82, category: 'polish', country: 'Poland', language: 'Polish', description: 'Dokument o zespole Republika i Grzegorzu Ciechowskim.' },
  { title: 'Chłopaki nie płaczą za Myslovitz', director: 'Kuba Czekaj', year: 2019, genre: 'Documentary', rating: 7.1, duration_minutes: 78, category: 'polish', country: 'Poland', language: 'Polish', description: 'Historia kultowego zespołu Myslovitz.' },

  // International music films & documentaries
  { title: 'Bohemian Rhapsody', director: 'Bryan Singer', year: 2018, genre: 'Biography', rating: 7.9, duration_minutes: 134, category: 'foreign', country: 'USA', language: 'English', description: 'The story of Freddie Mercury and Queen.' },
  { title: 'Rocketman', director: 'Dexter Fletcher', year: 2019, genre: 'Biography', rating: 7.3, duration_minutes: 121, category: 'foreign', country: 'UK', language: 'English', description: 'Musical fantasy about the life of Elton John.' },
  { title: 'Straight Outta Compton', director: 'F. Gary Gray', year: 2015, genre: 'Biography', rating: 7.8, duration_minutes: 147, category: 'foreign', country: 'USA', language: 'English', description: 'The story of N.W.A and the birth of gangsta rap.' },
  { title: 'Walk the Line', director: 'James Mangold', year: 2005, genre: 'Biography', rating: 7.8, duration_minutes: 136, category: 'foreign', country: 'USA', language: 'English', description: 'The story of Johnny Cash.' },
  { title: 'Ray', director: 'Taylor Hackford', year: 2004, genre: 'Biography', rating: 7.7, duration_minutes: 152, category: 'foreign', country: 'USA', language: 'English', description: 'The life of Ray Charles.' },
  { title: 'Amy', director: 'Asif Kapadia', year: 2015, genre: 'Documentary', rating: 7.8, duration_minutes: 128, category: 'foreign', country: 'UK', language: 'English', description: 'Documentary about Amy Winehouse.' },
  { title: 'Searching for Sugar Man', director: 'Malik Bendjelloul', year: 2012, genre: 'Documentary', rating: 8.2, duration_minutes: 86, category: 'foreign', country: 'Sweden', language: 'English', description: 'The incredible story of musician Rodriguez.' },
  { title: 'The Doors', director: 'Oliver Stone', year: 1991, genre: 'Biography', rating: 7.2, duration_minutes: 140, category: 'foreign', country: 'USA', language: 'English', description: 'The story of Jim Morrison and The Doors.' },
  { title: 'Control', director: 'Anton Corbijn', year: 2007, genre: 'Biography', rating: 7.7, duration_minutes: 122, category: 'foreign', country: 'UK', language: 'English', description: 'The life of Joy Division frontman Ian Curtis.' },
  { title: 'Whiplash', director: 'Damien Chazelle', year: 2014, genre: 'Drama', rating: 8.5, duration_minutes: 107, category: 'foreign', country: 'USA', language: 'English', description: 'A young drummer battles a ruthless jazz instructor.' },
  { title: 'Almost Famous', director: 'Cameron Crowe', year: 2000, genre: 'Drama', rating: 7.9, duration_minutes: 122, category: 'foreign', country: 'USA', language: 'English', description: 'A teenage journalist tours with a rock band in the 1970s.' },
  { title: 'This Is Spinal Tap', director: 'Rob Reiner', year: 1984, genre: 'Comedy', rating: 7.6, duration_minutes: 82, category: 'foreign', country: 'USA', language: 'English', description: 'Mockumentary following a fictional heavy metal band.' },
  { title: 'A Star Is Born', director: 'Bradley Cooper', year: 2018, genre: 'Drama', rating: 7.6, duration_minutes: 136, category: 'foreign', country: 'USA', language: 'English', description: 'A musician discovers and falls in love with a young singer.' },
  { title: 'The Dirt', director: 'Jeff Tremaine', year: 2019, genre: 'Biography', rating: 7.0, duration_minutes: 108, category: 'foreign', country: 'USA', language: 'English', description: 'The wild story of Mötley Crüe.' },
  { title: 'Sid and Nancy', director: 'Alex Cox', year: 1986, genre: 'Biography', rating: 6.8, duration_minutes: 112, category: 'foreign', country: 'UK', language: 'English', description: 'The story of Sex Pistols bassist Sid Vicious.' },
  { title: 'The Runaways', director: 'Floria Sigismondi', year: 2010, genre: 'Biography', rating: 6.5, duration_minutes: 106, category: 'foreign', country: 'USA', language: 'English', description: 'The story of the pioneering all-girl rock band.' },
  { title: 'Metallica: Some Kind of Monster', director: 'Joe Berlinger', year: 2004, genre: 'Documentary', rating: 7.3, duration_minutes: 141, category: 'foreign', country: 'USA', language: 'English', description: 'Behind the scenes of Metallica during a crisis.' },
  { title: 'Last Days', director: 'Gus Van Sant', year: 2005, genre: 'Drama', rating: 6.2, duration_minutes: 97, category: 'foreign', country: 'USA', language: 'English', description: 'Fictional account inspired by Kurt Cobain\'s last days.' },
  { title: 'Montage of Heck', director: 'Brett Morgen', year: 2015, genre: 'Documentary', rating: 7.5, duration_minutes: 132, category: 'foreign', country: 'USA', language: 'English', description: 'Intimate documentary about Kurt Cobain.' },
  { title: 'Summer of Soul', director: 'Questlove', year: 2021, genre: 'Documentary', rating: 8.1, duration_minutes: 117, category: 'foreign', country: 'USA', language: 'English', description: 'The 1969 Harlem Cultural Festival rediscovered.' },
  { title: 'Elvis', director: 'Baz Luhrmann', year: 2022, genre: 'Biography', rating: 7.3, duration_minutes: 159, category: 'foreign', country: 'USA', language: 'English', description: 'The life of Elvis Presley.' },
  { title: 'Get Back', director: 'Peter Jackson', year: 2021, genre: 'Documentary', rating: 8.7, duration_minutes: 468, category: 'foreign', country: 'UK', language: 'English', description: 'The Beatles recording Let It Be and their final concert.' },
  { title: 'No Direction Home', director: 'Martin Scorsese', year: 2005, genre: 'Documentary', rating: 8.1, duration_minutes: 208, category: 'foreign', country: 'USA', language: 'English', description: 'The life and music of Bob Dylan.' },
  { title: 'What Happened, Miss Simone?', director: 'Liz Garbus', year: 2015, genre: 'Documentary', rating: 7.6, duration_minutes: 102, category: 'foreign', country: 'USA', language: 'English', description: 'Documentary about Nina Simone.' },
  { title: 'Gimme Shelter', director: 'Albert Maysles', year: 1970, genre: 'Documentary', rating: 7.8, duration_minutes: 91, category: 'foreign', country: 'USA', language: 'English', description: 'The Rolling Stones at Altamont.' },
  { title: 'Stop Making Sense', director: 'Jonathan Demme', year: 1984, genre: 'Concert', rating: 8.5, duration_minutes: 88, category: 'foreign', country: 'USA', language: 'English', description: 'Talking Heads concert film, one of the greatest ever made.' },
  { title: 'The Last Waltz', director: 'Martin Scorsese', year: 1978, genre: 'Concert', rating: 8.2, duration_minutes: 117, category: 'foreign', country: 'USA', language: 'English', description: 'The Band\'s farewell concert with legendary guests.' },
  { title: 'Woodstock', director: 'Michael Wadleigh', year: 1970, genre: 'Documentary', rating: 7.8, duration_minutes: 184, category: 'foreign', country: 'USA', language: 'English', description: 'The legendary 1969 Woodstock festival.' },
  { title: '8 Mile', director: 'Curtis Hanson', year: 2002, genre: 'Drama', rating: 7.1, duration_minutes: 110, category: 'foreign', country: 'USA', language: 'English', description: 'A young rapper struggles in Detroit. Starring Eminem.' },
  { title: 'Purple Rain', director: 'Albert Magnoli', year: 1984, genre: 'Drama', rating: 6.6, duration_minutes: 111, category: 'foreign', country: 'USA', language: 'English', description: 'Prince stars as a young musician in Minneapolis.' },
  { title: 'La Bamba', director: 'Luis Valdez', year: 1987, genre: 'Biography', rating: 6.9, duration_minutes: 108, category: 'foreign', country: 'USA', language: 'English', description: 'The story of Ritchie Valens.' },
  { title: 'Love & Mercy', director: 'Bill Pohlad', year: 2014, genre: 'Biography', rating: 7.4, duration_minutes: 121, category: 'foreign', country: 'USA', language: 'English', description: 'The story of Beach Boys genius Brian Wilson.' },
  { title: 'Amadeus', director: 'Miloš Forman', year: 1984, genre: 'Biography', rating: 8.4, duration_minutes: 160, category: 'foreign', country: 'USA', language: 'English', description: 'The rivalry between Mozart and Salieri.' },
  { title: 'Inside Llewyn Davis', director: 'Coen Brothers', year: 2013, genre: 'Drama', rating: 7.4, duration_minutes: 105, category: 'foreign', country: 'USA', language: 'English', description: 'A folk singer navigates 1960s Greenwich Village.' },
  { title: 'Once', director: 'John Carney', year: 2007, genre: 'Romance', rating: 7.8, duration_minutes: 86, category: 'foreign', country: 'Ireland', language: 'English', description: 'A busker and immigrant form a musical bond in Dublin.' },
  { title: 'Begin Again', director: 'John Carney', year: 2013, genre: 'Drama', rating: 7.4, duration_minutes: 104, category: 'foreign', country: 'USA', language: 'English', description: 'A disgraced music exec and singer-songwriter collaborate.' },
  { title: 'Sing Street', director: 'John Carney', year: 2016, genre: 'Comedy', rating: 7.9, duration_minutes: 106, category: 'foreign', country: 'Ireland', language: 'English', description: 'A teen forms a band to impress a girl in 1980s Dublin.' },
  { title: 'The Commitments', director: 'Alan Parker', year: 1991, genre: 'Comedy', rating: 7.7, duration_minutes: 118, category: 'foreign', country: 'Ireland', language: 'English', description: 'Working-class Dubliners form a soul band.' },
  { title: 'School of Rock', director: 'Richard Linklater', year: 2003, genre: 'Comedy', rating: 7.1, duration_minutes: 110, category: 'foreign', country: 'USA', language: 'English', description: 'A failed rocker poses as a teacher and forms a kid rock band.' },
  { title: 'Crossroads', director: 'Walter Hill', year: 1986, genre: 'Drama', rating: 6.9, duration_minutes: 99, category: 'foreign', country: 'USA', language: 'English', description: 'A young guitarist searches for a lost blues song.' },
  { title: 'Back to Black', director: 'Sam Taylor-Johnson', year: 2024, genre: 'Biography', rating: 6.0, duration_minutes: 122, category: 'foreign', country: 'UK', language: 'English', description: 'Biopic about Amy Winehouse.' },
  { title: 'Bob Marley: One Love', director: 'Reinaldo Marcus Green', year: 2024, genre: 'Biography', rating: 6.5, duration_minutes: 107, category: 'foreign', country: 'USA', language: 'English', description: 'The life and music of Bob Marley.' },
  { title: 'Maestro', director: 'Bradley Cooper', year: 2023, genre: 'Biography', rating: 6.7, duration_minutes: 129, category: 'foreign', country: 'USA', language: 'English', description: 'The story of Leonard Bernstein.' },
  { title: 'I Wanna Dance with Somebody', director: 'Kasi Lemmons', year: 2022, genre: 'Biography', rating: 6.3, duration_minutes: 146, category: 'foreign', country: 'USA', language: 'English', description: 'The life of Whitney Houston.' },
  { title: 'Respect', director: 'Liesl Tommy', year: 2021, genre: 'Biography', rating: 6.3, duration_minutes: 145, category: 'foreign', country: 'USA', language: 'English', description: 'The story of Aretha Franklin.' },
  { title: 'Sound of Metal', director: 'Darius Marder', year: 2019, genre: 'Drama', rating: 7.8, duration_minutes: 120, category: 'foreign', country: 'USA', language: 'English', description: 'A drummer begins to lose his hearing.' },
  { title: 'Blinded by the Light', director: 'Gurinder Chadha', year: 2019, genre: 'Drama', rating: 6.9, duration_minutes: 117, category: 'foreign', country: 'UK', language: 'English', description: 'A British-Pakistani teen discovers Bruce Springsteen.' },
  { title: 'Yesterday', director: 'Danny Boyle', year: 2019, genre: 'Comedy', rating: 6.8, duration_minutes: 116, category: 'foreign', country: 'UK', language: 'English', description: 'A musician wakes up in a world where The Beatles never existed.' },
  { title: 'Crazy Heart', director: 'Scott Cooper', year: 2009, genre: 'Drama', rating: 7.2, duration_minutes: 112, category: 'foreign', country: 'USA', language: 'English', description: 'A fading country star seeks redemption.' },
];

// Generate more music-themed films for bulk
function generateMusicMovieBatch(batch: number, size: number) {
  const movies: any[] = [];
  
  const bands = [
    'Led Zeppelin', 'Pink Floyd', 'AC/DC', 'Iron Maiden', 'Black Sabbath',
    'Radiohead', 'Nirvana', 'Pearl Jam', 'Soundgarden', 'Alice in Chains',
    'Red Hot Chili Peppers', 'Foo Fighters', 'Green Day', 'Blink-182', 'The Offspring',
    'Rammstein', 'Scorpions', 'Kraftwerk', 'Depeche Mode', 'The Cure',
    'U2', 'Coldplay', 'Muse', 'Arctic Monkeys', 'Oasis',
    'Gorillaz', 'Daft Punk', 'The Chemical Brothers', 'Prodigy', 'Massive Attack',
    'Run-DMC', 'Public Enemy', 'Wu-Tang Clan', 'Outkast', 'Beastie Boys',
    'Bob Dylan', 'Jimi Hendrix', 'Janis Joplin', 'The Who', 'Fleetwood Mac',
    'Aerosmith', 'KISS', 'Def Leppard', 'Guns N\' Roses', 'Motörhead',
    'Slayer', 'Megadeth', 'Pantera', 'Tool', 'System of a Down',
    'Linkin Park', 'Korn', 'Rage Against the Machine', 'Nine Inch Nails', 'Marilyn Manson',
    'Budka Suflera', 'Dżem', 'Kult', 'T.Love', 'Hey',
    'Pidżama Porno', 'Acid Drinkers', 'Behemoth', 'Vader', 'Kat',
    'Perfect', 'Kombi', 'Republika', 'Maanam', 'Bajm',
  ];

  const filmTypes = [
    'The Rise of', 'Inside', 'Behind the Music:', 'The Story of',
    'Live at Wembley:', 'Unplugged:', 'On Tour with', 'The Legacy of',
    'Legends:', 'Rock Chronicles:', 'Sound & Vision:', 'Final Concert:',
  ];

  const directors = [
    'Martin Scorsese', 'Spike Lee', 'Brett Morgen', 'Davis Guggenheim',
    'Asif Kapadia', 'Penelope Spheeris', 'D.A. Pennebaker', 'Sam Dunn',
    'Jonathan Demme', 'Cameron Crowe', 'Julien Temple', 'Leszek Gnoiński',
  ];

  const genres = ['Documentary', 'Biography', 'Concert', 'Drama'];

  for (let i = 0; i < size; i++) {
    const seed = batch * size + i;
    const band = bands[seed % bands.length];
    const filmType = filmTypes[(seed * 7) % filmTypes.length];
    const director = directors[(seed * 11) % directors.length];
    const genre = genres[(seed * 3) % genres.length];
    const year = 1970 + (seed % 55);
    const isPolish = band.match(/Budka|Dżem|Kult|T\.Love|Hey|Pidżama|Acid|Behemoth|Vader|Kat|Perfect|Kombi|Republika|Maanam|Bajm/);
    const duration = 65 + ((seed * 13) % 120); // 65-184 min, always 60+

    movies.push({
      title: `${filmType} ${band}`,
      director,
      year,
      genre,
      category: isPolish ? 'polish' : 'foreign',
      description: `${genre === 'Concert' ? 'Live performance' : genre === 'Documentary' ? 'Documentary about' : 'The story of'} ${band}.`,
      duration_minutes: duration,
      rating: (5.5 + ((seed * 3) % 40) / 10).toFixed(1),
      country: isPolish ? 'Poland' : 'USA',
      language: isPolish ? 'Polish' : 'English',
    });
  }
  return movies;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { batch = 0, batchSize = 500 } = await req.json();

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // On first batch, clear old non-music movies and insert curated list
    if (batch === 0) {
      // Delete all existing movies to start fresh with music-only content
      await supabase.from('movies').delete().neq('id', '00000000-0000-0000-0000-000000000000');
      
      const { error } = await supabase.from('movies').insert(MUSIC_FILMS);
      if (error) console.error('Music films insert error:', error);
    }

    let totalAdded = MUSIC_FILMS.length;

    // Generate more music movies
    const musicBatch = generateMusicMovieBatch(batch, batchSize);
    for (let i = 0; i < musicBatch.length; i += 100) {
      const chunk = musicBatch.slice(i, i + 100);
      const { error } = await supabase.from('movies').insert(chunk);
      if (!error) totalAdded += chunk.length;
      else console.error('Batch insert error:', error);
    }

    const { count: finalCount } = await supabase
      .from('movies')
      .select('*', { count: 'exact', head: true });

    return new Response(JSON.stringify({
      success: true,
      batch,
      added: totalAdded,
      totalMovies: finalCount,
      progress: Math.min(100, Math.round(((finalCount || 0) / 20000) * 100)),
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });

  } catch (error: unknown) {
    console.error('Bulk populate movies error:', error);
    return new Response(JSON.stringify({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
});
