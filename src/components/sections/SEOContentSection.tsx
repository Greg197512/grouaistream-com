import { Link } from "react-router-dom";

export const SEOContentSection = () => {
  return (
    <section className="px-6 py-12 max-w-4xl mx-auto">
      <div className="prose prose-invert max-w-none text-muted-foreground text-sm leading-relaxed space-y-6">
        <h2 className="text-xl md:text-2xl font-bold text-foreground">
          What is GrouAI Stream?
        </h2>
        <p>
          GrouAI Stream is an AI-powered music streaming platform designed for creators and listeners who demand authenticity. 
          Unlike traditional streaming services plagued by fake streams and bot manipulation, GrouAI Stream uses advanced 
          verified human stream technology to ensure every play counts. Our anti-fraud system detects and blocks artificial 
          listening patterns, so artists earn real revenue from real fans. Whether you're an independent musician looking for 
          fair monetization or a listener seeking genuine music discovery, GrouAI Stream delivers an honest, transparent 
          streaming experience.
        </p>

        <h2 className="text-xl md:text-2xl font-bold text-foreground">
          AI Mood Detection – Music That Understands You
        </h2>
        <p>
          GrouAI Stream features cutting-edge AI mood detection that analyzes your emotional state through your device's 
          camera and adapts your listening experience in real time. Feeling energetic? The AI DJ serves up high-BPM bangers. 
          Going through a melancholic moment at 3 AM? It finds that perfect ambient track to accompany your thoughts. 
          Our mood detection AI supports face emotion recognition, voice command analysis, and behavioral pattern learning. 
          Over time, it builds a personalized music profile that understands your daily rhythms, weekly patterns, and 
          seasonal preferences. You can even view your mood history charts and receive AI-generated psychological reports 
          about your emotional patterns through music.
        </p>

        <h2 className="text-xl md:text-2xl font-bold text-foreground">
          Zero Bots, Verified Human Streams
        </h2>
        <p>
          The music industry loses billions to stream fraud every year. GrouAI Stream takes a stand against this with our 
          proprietary verified human streams system. Every stream event is validated through multi-factor authentication, 
          behavioral analysis, and duration tracking. We record stream events with precise duration data and use intelligent 
          algorithms to distinguish genuine listening from automated playback. This means artists on GrouAI Stream earn 
          fair compensation for real engagement. Our creator earnings dashboard provides transparent analytics showing 
          exactly how much each track earns, with detailed breakdowns by stream count, region, and time period. 
          No inflated numbers, no bot farms – just real music reaching real ears.
        </p>

        <h2 className="text-xl md:text-2xl font-bold text-foreground">
          AI Music Generation with Suno Integration
        </h2>
        <p>
          GrouAI Stream integrates directly with Suno AI to let you create original music from text prompts. Describe the 
          song you imagine – its genre, mood, lyrics, tempo – and our AI generates a complete track in seconds. Choose from 
          15+ genres including EDM, House, Trance, Rock, Punk, Pop, Hip-Hop, R&B, Disco, Lo-Fi, Jazz, Ambient, Classical, 
          and more. The Suno Studio provides a full creation environment with waveform visualization, generation history, 
          favorites management, and direct publishing to the GrouAI Stream library. Created tracks can be monetized 
          immediately through our creator earnings program, turning your AI-generated ideas into revenue.
        </p>

        <h2 className="text-xl md:text-2xl font-bold text-foreground">
          Earn Real Money as a Music Creator
        </h2>
        <p>
          GrouAI Stream offers a transparent monetization system for independent artists and AI music creators. Upload your 
          tracks, enable monetization, and start earning from verified streams. Our platform supports track boosting to 
          increase visibility, with analytics dashboards showing impressions, stream counts, and earnings in real time. 
          Artists can request payouts once they reach the minimum threshold, with payments processed through secure channels. 
          The creator earnings system tracks every stream event with precision, ensuring you receive compensation for 
          genuine engagement only. Combined with our anti-bot technology, this creates the fairest streaming economy available today.
        </p>

        <h2 className="text-xl md:text-2xl font-bold text-foreground">
          Live Radio, DJ Sessions & Party Mode
        </h2>
        <p>
          GrouaRadio broadcasts 24/7 with curated playlists, live chat, real-time likes, and community voting. 
          Host your own DJ sessions with QR code access for guests, crowd emotion detection via camera, and real-time 
          genre and BPM voting. Our Party Mode transforms any gathering into an interactive music experience where everyone 
          participates. Import playlists from YouTube and Spotify, browse the community server with thousands of tracks, 
          or discover new music through AI-curated recommendations based on your listening patterns.
        </p>

        <h2 className="text-xl md:text-2xl font-bold text-foreground">
          Available Features & Quick Links
        </h2>
        <nav className="flex flex-wrap gap-3 text-sm" aria-label="Site navigation">
          <Link to="/radio" className="text-primary hover:text-primary/80 underline underline-offset-4">
            🎙️ Live Radio 24/7
          </Link>
          <Link to="/radio-live" className="text-primary hover:text-primary/80 underline underline-offset-4">
            📻 GrouaRadio Live
          </Link>
          <Link to="/upload" className="text-primary hover:text-primary/80 underline underline-offset-4">
            ⬆️ Upload Your Music
          </Link>
          <Link to="/suno" className="text-primary hover:text-primary/80 underline underline-offset-4">
            🤖 AI Music Studio (Suno)
          </Link>
          <Link to="/earn" className="text-primary hover:text-primary/80 underline underline-offset-4">
            💰 Earn With Us
          </Link>
          <Link to="/earnings" className="text-primary hover:text-primary/80 underline underline-offset-4">
            📊 Creator Earnings
          </Link>
          <Link to="/search" className="text-primary hover:text-primary/80 underline underline-offset-4">
            🔍 Search Music
          </Link>
          <Link to="/library" className="text-primary hover:text-primary/80 underline underline-offset-4">
            📚 My Library
          </Link>
          <Link to="/movies" className="text-primary hover:text-primary/80 underline underline-offset-4">
            🎬 Movies
          </Link>
          <Link to="/mood-history" className="text-primary hover:text-primary/80 underline underline-offset-4">
            😊 Mood History
          </Link>
          <Link to="/settings" className="text-primary hover:text-primary/80 underline underline-offset-4">
            ⚙️ Settings
          </Link>
          <Link to="/server" className="text-primary hover:text-primary/80 underline underline-offset-4">
            🌐 Community Server
          </Link>
          <Link to="/album-creator" className="text-primary hover:text-primary/80 underline underline-offset-4">
            💿 Album Creator
          </Link>
          <Link to="/local-player" className="text-primary hover:text-primary/80 underline underline-offset-4">
            🎧 Local Player
          </Link>
          <Link to="/auth" className="text-primary hover:text-primary/80 underline underline-offset-4">
            🔐 Sign Up / Log In
          </Link>
          <Link to="/legal" className="text-primary hover:text-primary/80 underline underline-offset-4">
            📜 Legal & Terms
          </Link>
        </nav>

        <p className="text-xs text-muted-foreground/60">
          GrouAI Stream – AI-powered music streaming with verified human streams, mood detection, live radio, 
          AI DJ sessions, music generation, and fair artist monetization. No bots, real vibes. 
          Available in Polish, English, Dutch, and Ukrainian.
        </p>
      </div>
    </section>
  );
};
