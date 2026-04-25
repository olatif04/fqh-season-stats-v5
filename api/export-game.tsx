import { ImageResponse } from '@vercel/og';

export const config = {
  runtime: 'edge',
};

type Team = 'Red' | 'Blue';
type Role = 'player' | 'goalie';

type Entry = {
  id: string;
  name: string;
  team: Team;
  role: Role;
  goals: number;
  assists: number;
};

type Game = {
  id: string;
  date: string;
  notes: string;
  mvpName: string;
  redScore: number;
  blueScore: number;
  entries: Entry[];
};

type ExportTheme = {
  bg: string;
  card: string;
  text: string;
  accent: string;
};

type Payload = {
  game: Game;
  seasonTitle: string;
  seasonYear: string;
  theme: ExportTheme;
};

const FALLBACK_THEME: ExportTheme = {
  bg: '#f7f8fb',
  card: '#ffffff',
  text: '#14213d',
  accent: '#f59e0b',
};

function safeNumber(value: unknown) {
  const n = Number(value);
  return Number.isFinite(n) ? n : 0;
}

function goaliePoints(entry: Entry, redScore: number, blueScore: number) {
  const assists = safeNumber(entry.assists);
  const won = entry.team === 'Red' ? redScore > blueScore : blueScore > redScore;
  const diff = won ? Math.min(Math.abs(redScore - blueScore), 5) : 0;
  return 5 + assists + diff;
}

function safeTheme(theme?: Partial<ExportTheme>): ExportTheme {
  return {
    bg: theme?.bg || FALLBACK_THEME.bg,
    card: theme?.card || FALLBACK_THEME.card,
    text: theme?.text || FALLBACK_THEME.text,
    accent: theme?.accent || FALLBACK_THEME.accent,
  };
}

function formatDate(value?: string) {
  if (!value) return 'No date';
  const d = new Date(`${value}T12:00:00`);
  if (Number.isNaN(d.getTime())) return value;
  return d.toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });
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

  if (!body.game) {
    return new Response('Missing game payload', { status: 400 });
  }

  const game = body.game;
  const theme = safeTheme(body.theme);
  const title = body.seasonTitle || 'FQH Season Stats';
  const year = body.seasonYear || '2026-2027';

  const redRows = game.entries.filter((entry) => entry.team === 'Red');
  const blueRows = game.entries.filter((entry) => entry.team === 'Blue');
  const redPlayers = redRows.filter((row) => row.role === 'player');
  const redGoalies = redRows.filter((row) => row.role === 'goalie');
  const bluePlayers = blueRows.filter((row) => row.role === 'player');
  const blueGoalies = blueRows.filter((row) => row.role === 'goalie');

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
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
            <div style={{ display: 'flex', flexDirection: 'column' }}>
              <div style={{ fontSize: '22px', opacity: 0.75 }}>FQH</div>
              <div style={{ fontSize: '38px', fontWeight: 800 }}>Game Recap - {formatDate(game.date)}</div>
              <div style={{ fontSize: '22px', opacity: 0.8 }}>{game.notes || 'No notes'}</div>
              <div style={{ fontSize: '28px', fontWeight: 700, marginTop: '8px' }}>
                Team Red {game.redScore} - {game.blueScore} Team Blue
              </div>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end' }}>
              <div style={{ fontSize: '30px', fontWeight: 700 }}>{title}</div>
              <div style={{ fontSize: '24px', opacity: 0.8 }}>{year}</div>
              <div style={{ width: '180px', height: '10px', borderRadius: '8px', marginTop: '12px', background: theme.accent }} />
            </div>
          </div>

          <div style={{ display: 'flex', marginTop: '18px', marginBottom: '18px', gap: '12px' }}>
            <div style={{ display: 'flex', fontSize: '22px', border: '1px solid rgba(20,33,61,0.16)', borderRadius: '10px', padding: '10px 14px' }}>
              <span style={{ marginRight: '8px', opacity: 0.7 }}>MVP:</span>
              <span style={{ fontWeight: 700 }}>{game.mvpName?.trim() || '-'}</span>
            </div>
          </div>

          <div style={{ display: 'flex', gap: '16px', flex: 1 }}>
            {[{ label: 'Red', players: redPlayers, goalies: redGoalies, score: game.redScore }, { label: 'Blue', players: bluePlayers, goalies: blueGoalies, score: game.blueScore }].map((team) => (
              <div key={team.label} style={{ display: 'flex', flexDirection: 'column', width: '50%', border: '1px solid rgba(20,33,61,0.14)', borderRadius: '14px', padding: '14px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '28px', fontWeight: 800, marginBottom: '10px' }}>
                  <span>Team {team.label}</span>
                  <span>{team.score}</span>
                </div>

                <div style={{ fontSize: '20px', fontWeight: 700, marginBottom: '6px' }}>Players</div>
                <div style={{ display: 'flex', fontSize: '18px', fontWeight: 700, opacity: 0.8 }}>
                  <div style={{ width: '48%' }}>Name</div>
                  <div style={{ width: '17%', textAlign: 'center' }}>G</div>
                  <div style={{ width: '17%', textAlign: 'center' }}>A</div>
                  <div style={{ width: '18%', textAlign: 'center' }}>PTS</div>
                </div>
                {(team.players.length ? team.players : []).slice(0, 10).map((row, idx) => (
                  <div key={`${row.id}-${idx}`} style={{ display: 'flex', fontSize: '18px', padding: '3px 0' }}>
                    <div style={{ width: '48%', fontWeight: 600 }}>{row.name}</div>
                    <div style={{ width: '17%', textAlign: 'center' }}>{safeNumber(row.goals)}</div>
                    <div style={{ width: '17%', textAlign: 'center' }}>{safeNumber(row.assists)}</div>
                    <div style={{ width: '18%', textAlign: 'center' }}>{safeNumber(row.goals) + safeNumber(row.assists)}</div>
                  </div>
                ))}
                {!team.players.length ? <div style={{ fontSize: '18px', opacity: 0.7 }}>No players entered.</div> : null}

                <div style={{ fontSize: '20px', fontWeight: 700, marginTop: '12px', marginBottom: '6px' }}>Goalies</div>
                {(team.goalies.length ? team.goalies : []).slice(0, 6).map((goalie, idx) => (
                  <div key={`${goalie.id}-g-${idx}`} style={{ display: 'flex', justifyContent: 'space-between', fontSize: '18px', padding: '3px 0' }}>
                    <span style={{ fontWeight: 600 }}>{goalie.name}</span>
                    <span>A: {safeNumber(goalie.assists)} | PTS: {goaliePoints(goalie, game.redScore, game.blueScore)}</span>
                  </div>
                ))}
                {!team.goalies.length ? <div style={{ fontSize: '18px', opacity: 0.7 }}>No goalie entered.</div> : null}
              </div>
            ))}
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
