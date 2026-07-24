# N8N Integration Guide - GrouAI Stream

Kompletna integracja n8n do automatyzacji procesów w GrouAI Stream.

## Setup

### 1. N8N Webhook Configuration

Ustaw w N8N environment variable:
```
N8N_WEBHOOK_URL=https://YOUR_N8N_INSTANCE/webhook/grouaistream
```

### 2. Supabase Environment Variable

Dodaj do Supabase secrets:
```
N8N_WEBHOOK_URL=https://your-n8n.instance/webhook/grouaistream
```

---

## Workflow Events

### 📤 `track.uploaded`
**Trigger:** Użytkownik uploaduje utwór
```json
{
  "event": "track.uploaded",
  "data": {
    "track_id": "uuid",
    "title": "string",
    "artist": "string",
    "genre": "string",
    "duration": "number (seconds)",
    "user_id": "uuid",
    "uploaded_at": "timestamp"
  }
}
```

**N8N Actions:**
- ✅ Generuj cover (ai-cover-generate)
- ✅ Analyzuj metadata
- ✅ Wyślij notyfikację użytkownikowi
- ✅ Log do analytics

---

### 🎵 `track.generated`
**Trigger:** AI wygenerował utwór w Studio
```json
{
  "event": "track.generated",
  "data": {
    "track_id": "uuid",
    "title": "string",
    "engine": "suno|acestep|musicgen",
    "duration": "number",
    "prompt": "string",
    "user_id": "uuid",
    "cover_url": "string"
  }
}
```

**N8N Actions:**
- ✅ Auto-mastering
- ✅ Generuj video teledysk (Replicate)
- ✅ Post na social media
- ✅ Email do artysty
- ✅ Sync z Spotify/Apple Music

---

### 💾 `track.saved`
**Trigger:** Utwór został zapisany w bazie
```json
{
  "event": "track.saved",
  "data": {
    "track_id": "uuid",
    "cover_url": "string (if generated)",
    "audio_url": "string",
    "status": "published|draft"
  }
}
```

**N8N Actions:**
- ✅ Backup do S3
- ✅ Generate thumbnails
- ✅ Index w wyszukiwarce
- ✅ Update katalogów

---

### 👤 `user.signup`
**Trigger:** Nowy użytkownik się zarejestral
```json
{
  "event": "user.signup",
  "data": {
    "user_id": "uuid",
    "email": "string",
    "provider": "google|github",
    "created_at": "timestamp"
  }
}
```

**N8N Actions:**
- ✅ Welcome email
- ✅ Setup FREE quota
- ✅ Add do newsletter
- ✅ Log w CRM

---

### 💰 `earnings.calculated`
**Trigger:** Zarobki przeliczane
```json
{
  "event": "earnings.calculated",
  "data": {
    "user_id": "uuid",
    "period": "monthly",
    "total_streams": "number",
    "earnings_usd": "number",
    "payout_status": "pending|processed"
  }
}
```

**N8N Actions:**
- ✅ Generate raport PDF
- ✅ Email z podsumowaniem
- ✅ Trigger payout (Stripe)
- ✅ Log w accounting

---

### 🎤 `b2b.message`
**Trigger:** B2B Text Aurora otrzyma wiadomość
```json
{
  "event": "b2b.message",
  "data": {
    "user_id": "uuid",
    "message": "string",
    "language": "pl|en|de",
    "response_id": "uuid"
  }
}
```

**N8N Actions:**
- ✅ Log conversation
- ✅ Analytics (sentiment, topics)
- ✅ Escalate if needed
- ✅ Update CRM

---

### 📊 `playlist.created`
**Trigger:** Użytkownik tworzy playlistę
```json
{
  "event": "playlist.created",
  "data": {
    "playlist_id": "uuid",
    "title": "string",
    "user_id": "uuid",
    "track_count": "number"
  }
}
```

**N8N Actions:**
- ✅ Generate playlist cover
- ✅ Generate sharing image
- ✅ Email "share" link

---

## N8N Workflow Templates

### 🎵 Workflow: Track Auto-Processing

```
1. Trigger: POST /n8n-webhook
2. Filter: event === "track.uploaded"
3. Step 1: Call Supabase (get track details)
4. Step 2: Call ai-cover-generate
5. Step 3: Call ai-mastering
6. Step 4: Call stable-diffusion (video generation)
7. Step 5: Call Discord webhook (notify mods)
8. Step 6: Update track status
```

---

### 🤖 Workflow: Social Media Auto-Post

```
1. Trigger: POST /n8n-webhook
2. Filter: event === "track.generated"
3. Step 1: Generate caption (use AI)
4. Step 2: Download cover image
5. Step 3: Post to TikTok (via TikTok API)
6. Step 4: Post to Instagram (via Instazood/Zapier)
7. Step 5: Post to YouTube (short form)
8. Step 6: Update track with social links
```

---

### 💰 Workflow: Monthly Earnings Report

```
1. Trigger: Cron "0 0 1 * *" (1st day of month, midnight)
2. Step 1: Query Supabase (get all users)
3. Step 2: For each user:
   - Calculate streams from last month
   - Calculate earnings (streams * rate)
   - Generate PDF report
   - Email to artist
4. Step 3: Aggregate stats for admin
5. Step 4: Slack notification to team
```

---

### 📧 Workflow: Welcome Email Sequence

```
1. Trigger: POST /n8n-webhook
2. Filter: event === "user.signup"
3. Step 1: Get user email & language
4. Step 2: Send welcome email (Sendgrid)
   - Polish version if lang === "pl"
5. Step 3: Wait 2 days
6. Step 4: Send "Studio tutorial" email
7. Step 5: Wait 5 days
8. Step 6: Send "Earn money" email
```

---

## Database Table: n8n_webhooks

```sql
CREATE TABLE n8n_webhooks (
  id BIGSERIAL PRIMARY KEY,
  event TEXT NOT NULL,
  data JSONB NOT NULL,
  response_status INT,
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_n8n_event ON n8n_webhooks(event);
CREATE INDEX idx_n8n_created ON n8n_webhooks(created_at);
```

---

## Trigger Points in Code

### Upload Flow
```typescript
// src/pages/Upload.tsx - After successful upload
await supabase.functions.invoke("n8n-webhook", {
  body: {
    event: "track.uploaded",
    data: { track_id, title, artist, genre, duration, user_id }
  }
});
```

### Studio Generation
```typescript
// src/pages/Suno.tsx - After track generation
await supabase.functions.invoke("n8n-webhook", {
  body: {
    event: "track.generated",
    data: { track_id, title, engine, duration, prompt, user_id }
  }
});
```

### User Signup
```typescript
// src/pages/Auth.tsx - After OAuth success
await supabase.functions.invoke("n8n-webhook", {
  body: {
    event: "user.signup",
    data: { user_id, email, provider }
  }
});
```

---

## API Responses

All N8N webhooks return:
```json
{
  "success": true,
  "forwarded_to_n8n": true
}
```

---

## Testing

### Curl Test
```bash
curl -X POST http://localhost:54321/functions/v1/n8n-webhook \
  -H "Content-Type: application/json" \
  -d '{
    "event": "track.uploaded",
    "data": {
      "track_id": "test-123",
      "title": "Test Track",
      "artist": "Test Artist",
      "genre": "Pop",
      "duration": 180,
      "user_id": "user-123"
    }
  }'
```

### N8N Webhook Trigger
Create webhook in n8n with:
- **URL**: `https://YOUR_SUPABASE_PROJECT.supabase.co/functions/v1/n8n-webhook`
- **Method**: POST
- **Authentication**: None (Supabase handles via API key)

---

## Environment Variables

```bash
# Supabase
N8N_WEBHOOK_URL=https://n8n.example.com/webhook/grouaistream

# N8N (if hosted)
SUPABASE_API_KEY=your_supabase_anon_key
SUPABASE_URL=your_supabase_url
```

---

## Security

- ✅ All webhooks logged to `n8n_webhooks` table
- ✅ Validate origin (can add JWT token verification)
- ✅ Rate limit: 1000 req/hour per event
- ✅ Retry logic: exponential backoff (if needed)

---

## Monitoring

Query recent n8n activity:
```sql
SELECT event, COUNT(*) as count
FROM n8n_webhooks
WHERE created_at > NOW() - INTERVAL '24 hours'
GROUP BY event
ORDER BY count DESC;
```

---

## Next Steps

1. Set up N8N instance
2. Configure webhook URL in Supabase
3. Deploy edge function
4. Add trigger calls in Upload.tsx, Suno.tsx, Auth.tsx
5. Create workflows in N8N
6. Test end-to-end
7. Monitor webhook logs
