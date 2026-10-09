# Project rules

- The welcome screen and homepage share a static intro recording; playback must never invoke paid generation APIs, to prevent recurring spend.
- Welcome-screen animation must be dismissible and time-bounded, with reduced-motion support, so it cannot block access to the application.
- Weekly homepage artwork rotates deterministically through bundled assets by UTC week, without scheduled AI or backend work, to avoid spend and layout disruption.
- Homepage visualization stays inside a fixed-size noninteractive canvas and preserves cross-origin playback fallback, so graphics cannot interfere with audio or controls.