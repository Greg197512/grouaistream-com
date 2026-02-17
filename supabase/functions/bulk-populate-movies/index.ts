import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

// 50 best Polish films
const POLISH_FILMS = [
  { title: 'Ida', director: 'Paweł Pawlikowski', year: 2013, genre: 'Drama', rating: 7.4, duration_minutes: 82 },
  { title: 'Zimna wojna', original_title: 'Cold War', director: 'Paweł Pawlikowski', year: 2018, genre: 'Drama', rating: 7.6, duration_minutes: 89 },
  { title: 'Katyń', director: 'Andrzej Wajda', year: 2007, genre: 'Drama', rating: 7.0, duration_minutes: 121 },
  { title: 'Człowiek z marmuru', director: 'Andrzej Wajda', year: 1977, genre: 'Drama', rating: 7.6, duration_minutes: 165 },
  { title: 'Człowiek z żelaza', director: 'Andrzej Wajda', year: 1981, genre: 'Drama', rating: 7.1, duration_minutes: 156 },
  { title: 'Popiół i diament', director: 'Andrzej Wajda', year: 1958, genre: 'Drama', rating: 7.8, duration_minutes: 103 },
  { title: 'Nóż w wodzie', director: 'Roman Polański', year: 1962, genre: 'Thriller', rating: 7.5, duration_minutes: 94 },
  { title: 'Dekalog', director: 'Krzysztof Kieślowski', year: 1989, genre: 'Drama', rating: 9.1, duration_minutes: 572 },
  { title: 'Trzy kolory: Niebieski', director: 'Krzysztof Kieślowski', year: 1993, genre: 'Drama', rating: 7.9, duration_minutes: 94 },
  { title: 'Trzy kolory: Biały', director: 'Krzysztof Kieślowski', year: 1994, genre: 'Comedy', rating: 7.5, duration_minutes: 91 },
  { title: 'Trzy kolory: Czerwony', director: 'Krzysztof Kieślowski', year: 1994, genre: 'Drama', rating: 8.1, duration_minutes: 99 },
  { title: 'Podwójne życie Weroniki', director: 'Krzysztof Kieślowski', year: 1991, genre: 'Drama', rating: 7.7, duration_minutes: 98 },
  { title: 'Rękopis znaleziony w Saragossie', director: 'Wojciech Has', year: 1965, genre: 'Adventure', rating: 7.9, duration_minutes: 182 },
  { title: 'Saragossa Manuscript', director: 'Wojciech Has', year: 1965, genre: 'Fantasy', rating: 7.9, duration_minutes: 182 },
  { title: 'Eroica', director: 'Andrzej Munk', year: 1958, genre: 'Drama', rating: 7.4, duration_minutes: 87 },
  { title: 'Kanał', director: 'Andrzej Wajda', year: 1957, genre: 'War', rating: 7.5, duration_minutes: 91 },
  { title: 'Pianista', original_title: 'The Pianist', director: 'Roman Polański', year: 2002, genre: 'Drama', rating: 8.5, duration_minutes: 150 },
  { title: 'Kler', director: 'Wojciech Smarzowski', year: 2018, genre: 'Drama', rating: 7.2, duration_minutes: 133 },
  { title: 'Wesele', director: 'Wojciech Smarzowski', year: 2004, genre: 'Drama', rating: 7.3, duration_minutes: 106 },
  { title: 'Wołyń', director: 'Wojciech Smarzowski', year: 2016, genre: 'War', rating: 7.1, duration_minutes: 150 },
  { title: 'Dzień świra', director: 'Marek Koterski', year: 2002, genre: 'Comedy', rating: 7.7, duration_minutes: 93 },
  { title: 'Nic śmiesznego', director: 'Marek Koterski', year: 1995, genre: 'Comedy', rating: 7.3, duration_minutes: 91 },
  { title: 'Miś', director: 'Stanisław Bareja', year: 1981, genre: 'Comedy', rating: 8.1, duration_minutes: 117 },
  { title: 'Co mi zrobisz, jak mnie złapiesz', director: 'Stanisław Bareja', year: 1978, genre: 'Comedy', rating: 7.5, duration_minutes: 102 },
  { title: 'Brunet wieczorową porą', director: 'Stanisław Bareja', year: 1976, genre: 'Comedy', rating: 7.2, duration_minutes: 90 },
  { title: 'Seksmisja', director: 'Juliusz Machulski', year: 1984, genre: 'Sci-Fi', rating: 7.6, duration_minutes: 116 },
  { title: 'Vabank', director: 'Juliusz Machulski', year: 1981, genre: 'Crime', rating: 7.8, duration_minutes: 108 },
  { title: 'Vabank II', director: 'Juliusz Machulski', year: 1985, genre: 'Crime', rating: 7.3, duration_minutes: 95 },
  { title: 'Kingsajz', director: 'Juliusz Machulski', year: 1988, genre: 'Fantasy', rating: 7.4, duration_minutes: 107 },
  { title: 'Killer', director: 'Juliusz Machulski', year: 1997, genre: 'Comedy', rating: 7.1, duration_minutes: 103 },
  { title: 'Chłopi', director: 'Jan Rybkowski', year: 1973, genre: 'Drama', rating: 7.0, duration_minutes: 175 },
  { title: 'Potop', director: 'Jerzy Hoffman', year: 1974, genre: 'Historical', rating: 7.8, duration_minutes: 315 },
  { title: 'Ogniem i mieczem', director: 'Jerzy Hoffman', year: 1999, genre: 'Historical', rating: 6.8, duration_minutes: 175 },
  { title: 'Pan Tadeusz', director: 'Andrzej Wajda', year: 1999, genre: 'Historical', rating: 6.6, duration_minutes: 150 },
  { title: 'Quo Vadis', director: 'Jerzy Kawalerowicz', year: 2001, genre: 'Historical', rating: 5.5, duration_minutes: 170 },
  { title: 'Faraon', director: 'Jerzy Kawalerowicz', year: 1966, genre: 'Historical', rating: 7.5, duration_minutes: 175 },
  { title: 'Krótki film o miłości', director: 'Krzysztof Kieślowski', year: 1988, genre: 'Drama', rating: 8.0, duration_minutes: 87 },
  { title: 'Krótki film o zabijaniu', director: 'Krzysztof Kieślowski', year: 1988, genre: 'Drama', rating: 8.0, duration_minutes: 84 },
  { title: 'Psy', director: 'Władysław Pasikowski', year: 1992, genre: 'Action', rating: 7.5, duration_minutes: 104 },
  { title: 'Psy 2', director: 'Władysław Pasikowski', year: 1994, genre: 'Action', rating: 6.9, duration_minutes: 104 },
  { title: 'Dług', director: 'Krzysztof Krauze', year: 1999, genre: 'Thriller', rating: 7.5, duration_minutes: 94 },
  { title: 'Boże Ciało', original_title: 'Corpus Christi', director: 'Jan Komasa', year: 2019, genre: 'Drama', rating: 7.5, duration_minutes: 115 },
  { title: 'Ostatnia rodzina', director: 'Jan P. Matuszyński', year: 2016, genre: 'Biography', rating: 7.5, duration_minutes: 123 },
  { title: 'Bogowie', director: 'Łukasz Palkowski', year: 2014, genre: 'Biography', rating: 7.6, duration_minutes: 116 },
  { title: 'Drogówka', director: 'Wojciech Smarzowski', year: 2013, genre: 'Crime', rating: 6.9, duration_minutes: 119 },
  { title: 'Wałęsa. Człowiek z nadziei', director: 'Andrzej Wajda', year: 2013, genre: 'Biography', rating: 5.8, duration_minutes: 127 },
  { title: 'Jack Strong', director: 'Władysław Pasikowski', year: 2014, genre: 'Thriller', rating: 7.0, duration_minutes: 128 },
  { title: 'Sala samobójców', director: 'Jan Komasa', year: 2011, genre: 'Drama', rating: 6.8, duration_minutes: 115 },
  { title: 'Córki dancingu', original_title: 'The Lure', director: 'Agnieszka Smoczyńska', year: 2015, genre: 'Musical', rating: 6.4, duration_minutes: 92 },
  { title: '365 dni', director: 'Barbara Białowąs', year: 2020, genre: 'Romance', rating: 3.3, duration_minutes: 116 },
];

// Genre templates for foreign movies
const FOREIGN_GENRES = [
  { genre: 'Action', directors: ['Christopher Nolan', 'James Cameron', 'Michael Bay', 'Ridley Scott', 'Denis Villeneuve'], moods: ['exciting', 'intense'] },
  { genre: 'Drama', directors: ['Martin Scorsese', 'Steven Spielberg', 'David Fincher', 'Quentin Tarantino', 'Coen Brothers'], moods: ['emotional', 'thought-provoking'] },
  { genre: 'Comedy', directors: ['Wes Anderson', 'Edgar Wright', 'Judd Apatow', 'Adam McKay', 'Taika Waititi'], moods: ['funny', 'light'] },
  { genre: 'Horror', directors: ['Jordan Peele', 'Ari Aster', 'James Wan', 'Mike Flanagan', 'Robert Eggers'], moods: ['scary', 'suspenseful'] },
  { genre: 'Sci-Fi', directors: ['Denis Villeneuve', 'Alex Garland', 'Ridley Scott', 'Neill Blomkamp', 'Christopher Nolan'], moods: ['futuristic', 'mind-bending'] },
  { genre: 'Thriller', directors: ['David Fincher', 'Alfred Hitchcock', 'Denis Villeneuve', 'Park Chan-wook', 'Bong Joon-ho'], moods: ['tense', 'suspenseful'] },
  { genre: 'Romance', directors: ['Richard Linklater', 'Nancy Meyers', 'Wong Kar-wai', 'Sofia Coppola', 'Greta Gerwig'], moods: ['romantic', 'heartwarming'] },
  { genre: 'Animation', directors: ['Hayao Miyazaki', 'Pete Docter', 'Brad Bird', 'Makoto Shinkai', 'Isao Takahata'], moods: ['imaginative', 'emotional'] },
  { genre: 'Documentary', directors: ['Werner Herzog', 'Ken Burns', 'Morgan Neville', 'Asif Kapadia', 'Alex Gibney'], moods: ['informative', 'inspiring'] },
  { genre: 'Crime', directors: ['Martin Scorsese', 'Quentin Tarantino', 'Guy Ritchie', 'Bong Joon-ho', 'Cary Fukunaga'], moods: ['gritty', 'intense'] },
];

const COUNTRIES = ['USA', 'UK', 'France', 'Germany', 'Japan', 'South Korea', 'Spain', 'Italy', 'India', 'Brazil', 'Australia', 'Canada', 'Mexico', 'Sweden', 'Denmark', 'Norway'];

function generateForeignMovieBatch(batch: number, size: number) {
  const movies: any[] = [];
  const adjectives = ['The Last', 'Dark', 'Silent', 'Eternal', 'Hidden', 'Lost', 'Broken', 'Golden', 'Crimson', 'Shadow', 'Iron', 'Midnight', 'Frozen', 'Burning', 'Rising', 'Falling', 'Sacred', 'Wild', 'Savage', 'Hollow'];
  const nouns = ['Storm', 'Legacy', 'Kingdom', 'Empire', 'Horizon', 'Journey', 'Dream', 'Night', 'Dawn', 'Echo', 'Flame', 'Tide', 'Raven', 'Wolf', 'Serpent', 'Crown', 'Blade', 'Phantom', 'Oracle', 'Cipher'];
  const suffixes = ['', ' Returns', ' Reborn', ' Unleashed', ': Redemption', ': Origins', ': Awakening', ' Rising', ': The Beginning', ' Chronicles'];

  for (let i = 0; i < size; i++) {
    const seed = batch * size + i;
    const genreConf = FOREIGN_GENRES[seed % FOREIGN_GENRES.length];
    const adj = adjectives[(seed * 7 + 3) % adjectives.length];
    const noun = nouns[(seed * 13 + 5) % nouns.length];
    const suffix = suffixes[(seed * 3) % suffixes.length];
    const director = genreConf.directors[(seed * 11) % genreConf.directors.length];
    const country = COUNTRIES[(seed * 17) % COUNTRIES.length];
    const year = 1970 + (seed % 55);

    movies.push({
      title: `${adj} ${noun}${suffix}`,
      director,
      year,
      genre: genreConf.genre,
      category: 'foreign',
      description: `A ${genreConf.genre.toLowerCase()} film directed by ${director}.`,
      duration_minutes: 80 + ((seed * 7) % 80),
      rating: (5 + ((seed * 3) % 45) / 10).toFixed(1),
      country,
      language: country === 'USA' || country === 'UK' || country === 'Australia' || country === 'Canada' ? 'English' : country,
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

    const { count: existingCount } = await supabase
      .from('movies')
      .select('*', { count: 'exact', head: true });

    console.log(`Current movies: ${existingCount}. Batch: ${batch}`);

    let totalAdded = 0;

    // First batch: insert Polish films
    if (batch === 0) {
      const polishData = POLISH_FILMS.map(f => ({
        ...f,
        category: 'polish',
        country: 'Poland',
        language: 'Polish',
        description: `Reżyseria: ${f.director}. ${f.genre}, ${f.year}.`,
      }));

      const { error } = await supabase.from('movies').insert(polishData);
      if (!error) totalAdded += polishData.length;
      else console.error('Polish insert error:', error);
    }

    // Generate foreign movies
    const foreignBatch = generateForeignMovieBatch(batch, batchSize);
    for (let i = 0; i < foreignBatch.length; i += 100) {
      const chunk = foreignBatch.slice(i, i + 100);
      const { error } = await supabase.from('movies').insert(chunk);
      if (!error) totalAdded += chunk.length;
      else console.error('Foreign insert error:', error);
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
