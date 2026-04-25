import { ImageResponse } from '@vercel/og';

export const config = {
  runtime: 'edge',
};

type SeasonRow = {
  name: string;
  gp: number;
  goals: number;
  assists: number;
  points: number;
  ppg: string;
  goalieWins: number;
  goalieLosses: number;
};

type ExportTheme = {
  bg: string;
  card: string;
  text: string;
  accent: string;
};

type Payload = {
  rows: SeasonRow[];
  seasonTitle: string;
  seasonYear: string;
  gamesCount: number;
  theme: ExportTheme;
};

const FALLBACK_THEME: ExportTheme = {
  bg: '#f7f8fb',
  card: '#ffffff',
  text: '#14213d',
  accent: '#f59e0b',
};

function safeTheme(theme?: Partial<ExportTheme>): ExportTheme {
  return {
    bg: theme?.bg || FALLBACK_THEME.bg,
    card: theme?.card || FALLBACK_THEME.card,
    text: theme?.text || FALLBACK_THEME.text,
    accent: theme?.accent || FALLBACK_THEME.accent,
  };
}

export default async function handler(request: Request) {
  if (request.method !== 'POST') {
    return new Response('Method not allowed', { status: 405 });
  }

  let body: Payload;
  try {
    body = (await request.json()) as Payload;
  } catch {
    return new Response('Invalid JSON body', { status: 400 });
  }

  const rows = Array.isArray(body.rows) ? body.rows : [];
  const theme = safeTheme(body.theme);
  const title = body.seasonTitle || 'FQH Season Stats';
  const year = body.seasonYear || '2026-2027';
  const gamesCount = Number.isFinite(body.gamesCount) ? body.gamesCount : 0;

  return new ImageResponse(
    (
      <div
        style={{
          display: 'flex',
          width: '1800px',
          height: '1200px',
          padding: '36px',
          background: theme.bg,
          color: theme.text,
          fontFamily: 'Inter, Arial, sans-serif',
        }}
      >
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            width: '100%',
            height: '100%',
            borderRadius: '24px',
            background: theme.card,
            padding: '28px',
            boxSizing: 'border-box',
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '18px' }}>
            <div style={{ display: 'flex', flexDirection: 'column' }}>
              <div style={{ fontSize: '22px', opacity: 0.75 }}>FQH</div>
              <div style={{ fontSize: '44px', fontWeight: 800 }}>Season Stats</div>
              <div style={{ fontSize: '24px', opacity: 0.8 }}>{title}</div>
              <div style={{ fontSize: '20px', opacity: 0.7 }}>{gamesCount} games tracked</div>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end' }}>
              <div style={{ fontSize: '30px', fontWeight: 700 }}>{title}</div>
              <div style={{ fontSize: '24px', opacity: 0.8 }}>{year}</div>
              <div style={{ width: '180px', height: '10px', borderRadius: '8px', marginTop: '12px', background: theme.accent }} />
            </div>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', width: '100%', border: '1px solid rgba(20,33,61,0.18)', borderRadius: '12px', overflow: 'hidden' }}>
            <div style={{ display: 'flex', padding: '12px 14px', background: 'rgba(20,33,61,0.08)', fontSize: '21px', fontWeight: 700 }}>
              {['Name', 'GP', 'Goals', 'Assists', 'Points', 'PPG', 'Goalie W', 'Goalie L'].map((label) => (
                <div key={label} style={{ width: label === 'Name' ? '33%' : '9.57%', textAlign: label === 'Name' ? 'left' : 'center' }}>
                  {label}
                </div>
              ))}
            </div>

            {rows.length === 0 ? (
              <div style={{ display: 'flex', justifyContent: 'center', padding: '24px', fontSize: '22px', opacity: 0.7 }}>No games yet.</div>
            ) : (
              rows.slice(0, 32).map((row, idx) => (
                <div
                  key={`${row.name}-${idx}`}
                  style={{
                    display: 'flex',
                    padding: '10px 14px',
                    fontSize: '20px',
                    background: idx % 2 === 0 ? 'rgba(20,33,61,0.02)' : 'transparent',
                    borderTop: '1px solid rgba(20,33,61,0.08)',
                  }}
                >
                  <div style={{ width: '33%', fontWeight: 700 }}>{row.name}</div>
                  <div style={{ width: '9.57%', textAlign: 'center' }}>{row.gp}</div>
                  <div style={{ width: '9.57%', textAlign: 'center' }}>{row.goals}</div>
                  <div style={{ width: '9.57%', textAlign: 'center' }}>{row.assists}</div>
                  <div style={{ width: '9.57%', textAlign: 'center' }}>{row.points}</div>
                  <div style={{ width: '9.57%', textAlign: 'center' }}>{row.ppg}</div>
                  <div style={{ width: '9.57%', textAlign: 'center' }}>{row.goalieWins}</div>
                  <div style={{ width: '9.57%', textAlign: 'center' }}>{row.goalieLosses}</div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    ),
    {
      width: 1800,
      height: 1200,
    }
  );
}
