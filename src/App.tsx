import React, { useEffect, useMemo, useState, useRef } from 'react';
import { motion } from 'framer-motion';
import {
  Calendar,
  ChevronLeft,
  Download,
  Eye,
  Pencil,
  Plus,
  Save,
  Shield,
  Trash2,
  Trophy,
  User,
} from 'lucide-react';
import html2canvas from 'html2canvas';
import { getConfigError, supabase } from './lib/supabase';
import {
  computeSeasonStats,
  emptyEntry,
  formatDate,
  gameEntryPoints,
  goalieGamePoints,
  safeNumber,
  sumTeamPlayerGoals,
} from './lib/stats';
import type { Entry, Game, Team } from './lib/types';

const DEFAULT_EXPORT_THEME = {
  bg: '#f7f8fb',
  card: '#ffffff',
  text: '#14213d',
  accent: '#f59e0b',
};

const SEASON_META_KEY = 'fqh-season-meta-v4';

type ExportTheme = typeof DEFAULT_EXPORT_THEME;

type GameRow = {
  id: string;
  season_key: string | null;
  game_date: string;
  notes: string | null;
  mvp_name: string | null;
  created_at: string;
};

type EntryRow = {
  id: string;
  game_id: string;
  name: string;
  team: Team;
  role: 'player' | 'goalie';
  goals: number;
  assists: number;
  created_at?: string;
};

type SeasonMeta = {
  seasonText: string;
  yearText: string;
};

type Highlight = {
  label: string;
  value: string;
  subvalue: string;
};

function normalizeSeasonText(value: string) {
  const trimmed = value.trim();
  if (!trimmed) return '21st';
  const match = trimmed.match(/(\d+)/);
  if (match) {
    const num = Number(match[1]);
    if (Number.isFinite(num) && num > 0) {
      const mod100 = num % 100;
      if (mod100 >= 11 && mod100 <= 13) return `${num}th`;
      switch (num % 10) {
        case 1:
          return `${num}st`;
        case 2:
          return `${num}nd`;
        case 3:
          return `${num}rd`;
        default:
          return `${num}th`;
      }
    }
  }
  return trimmed;
}

function buildSeasonKey(value: string) {
  return normalizeSeasonText(value).toLowerCase();
}

function buildSeasonTitle(meta: SeasonMeta) {
  return `${normalizeSeasonText(meta.seasonText)} FQH Season Stats`;
}

function loadSeasonMeta(): SeasonMeta {
  if (typeof window === 'undefined') return { seasonText: '21st', yearText: '2026-2027' };

  try {
    const raw = window.localStorage.getItem(SEASON_META_KEY);
    if (!raw) return { seasonText: '21st', yearText: '2026-2027' };
    const parsed = JSON.parse(raw) as Partial<SeasonMeta>;
    return {
      seasonText: typeof parsed.seasonText === 'string' && parsed.seasonText.trim() ? parsed.seasonText : '21st',
      yearText: typeof parsed.yearText === 'string' && parsed.yearText.trim() ? parsed.yearText : '2026-2027',
    };
  } catch {
    return { seasonText: '21st', yearText: '2026-2027' };
  }
}

function buildLeader(entries: Entry[], metric: 'goals' | 'assists' | 'points', game: Game): Highlight {
  const scored = entries
    .filter((entry) => entry.name.trim())
    .map((entry) => ({
      name: entry.name.trim(),
      value:
        metric === 'goals'
          ? safeNumber(entry.goals)
          : metric === 'assists'
            ? safeNumber(entry.assists)
            : gameEntryPoints(entry, game.redScore, game.blueScore),
    }));

  const maxValue = scored.reduce((max, item) => Math.max(max, item.value), 0);
  if (maxValue <= 0) {
    return {
      label: metric === 'goals' ? 'Most Goals' : metric === 'assists' ? 'Most Assists' : 'Most Points',
      value: '—',
      subvalue: 'No stats yet',
    };
  }

  const leaders = scored.filter((item) => item.value === maxValue).map((item) => item.name);
  return {
    label: metric === 'goals' ? 'Most Goals' : metric === 'assists' ? 'Most Assists' : 'Most Points',
    value: leaders.join(' / '),
    subvalue: `${maxValue}`,
  };
}

function buildHighlights(game: Game): Highlight[] {
  return [
    buildLeader(game.entries.filter((entry) => entry.role === 'player'), 'goals', game),
    buildLeader(game.entries, 'assists', game),
    buildLeader(game.entries, 'points', game),
    {
      label: 'MVP',
      value: game.mvpName?.trim() || '—',
      subvalue: game.mvpName?.trim() ? 'Selected manually' : 'Not selected',
    },
  ];
}

function ErrorScreen({ message }: { message: string }) {
  return (
    <div className="page-shell">
      <div className="error-card">
        <div className="eyebrow error">Configuration Error</div>
        <h1>Supabase is required</h1>
        <p>{message}</p>
        <div className="code-hint">
          Add <code>VITE_SUPABASE_URL</code> and <code>VITE_SUPABASE_ANON_KEY</code> in Vercel and your local <code>.env</code>.
        </div>
      </div>
    </div>
  );
}

function StatPill({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="stat-pill">
      <div className="stat-label">{label}</div>
      <div className="stat-value">{value}</div>
    </div>
  );
}

function HighlightCard({ item }: { item: Highlight }) {
  return (
    <div className="highlight-card">
      <div className="stat-label">{item.label}</div>
      <div className="highlight-value">{item.value}</div>
      <div className="muted-line">{item.subvalue}</div>
    </div>
  );
}

function IconButton({ icon, children, onClick, variant = 'primary', type = 'button', disabled = false }: {
  icon?: React.ReactNode;
  children: React.ReactNode;
  onClick?: () => void;
  variant?: 'primary' | 'secondary' | 'danger';
  type?: 'button' | 'submit';
  disabled?: boolean;
}) {
  return (
    <button className={`btn ${variant}`} onClick={onClick} type={type} disabled={disabled}>
      {icon}
      {children}
    </button>
  );
}

function ExportControls({ theme, setTheme, onExport, compact = false }: {
  theme: ExportTheme;
  setTheme: React.Dispatch<React.SetStateAction<ExportTheme>>;
  onExport: () => void;
  compact?: boolean;
}) {
  return (
    <div className={`export-controls ${compact ? 'compact' : ''}`}>
      <div className="color-row">
        <label>
          BG
          <input type="color" value={theme.bg} onChange={(e) => setTheme((t) => ({ ...t, bg: e.target.value }))} />
        </label>
        <label>
          Card
          <input type="color" value={theme.card} onChange={(e) => setTheme((t) => ({ ...t, card: e.target.value }))} />
        </label>
        <label>
          Text
          <input type="color" value={theme.text} onChange={(e) => setTheme((t) => ({ ...t, text: e.target.value }))} />
        </label>
        <label>
          Accent
          <input type="color" value={theme.accent} onChange={(e) => setTheme((t) => ({ ...t, accent: e.target.value }))} />
        </label>
      </div>
      <IconButton icon={<Download size={16} />} variant="secondary" onClick={onExport}>Export PNG</IconButton>
    </div>
  );
}

function SeasonPicker({
  seasonMeta,
  seasonInput,
  setSeasonInput,
  onApplySeason,
  setSeasonMeta,
}: {
  seasonMeta: SeasonMeta;
  seasonInput: string;
  setSeasonInput: React.Dispatch<React.SetStateAction<string>>;
  onApplySeason: () => void;
  setSeasonMeta: React.Dispatch<React.SetStateAction<SeasonMeta>>;
}) {
  return (
    <div className="season-picker">
      <div className="field picker-field">
        <label>FQH Season</label>
        <input
          value={seasonInput}
          placeholder="21st"
          onChange={(e) => setSeasonInput(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault();
              onApplySeason();
            }
          }}
        />
      </div>
      <div className="field picker-field">
        <label>Year (PNG only)</label>
        <input
          value={seasonMeta.yearText}
          placeholder="2026-2027"
          onChange={(e) => setSeasonMeta((prev) => ({ ...prev, yearText: e.target.value }))}
        />
      </div>
      <IconButton variant="secondary" onClick={onApplySeason}>Load Season</IconButton>
    </div>
  );
}

function GameCard({ game, onOpen, onEdit, onDelete }: {
  game: Game;
  onOpen: (id: string) => void;
  onEdit: (id: string) => void;
  onDelete: (id: string) => void;
}) {
  return (
    <div className="card archive-card">
      <div className="archive-head">
        <div>
          <div className="archive-date"><Calendar size={15} /> {formatDate(game.date)}</div>
          <div className="archive-score">Team Red {game.redScore} - {game.blueScore} Team Blue</div>
          <div className="archive-notes">{game.notes || 'No notes'}</div>
        </div>
        <div className="archive-actions">
          <IconButton icon={<Eye size={16} />} variant="secondary" onClick={() => onOpen(game.id)}>View</IconButton>
          <IconButton icon={<Pencil size={16} />} variant="secondary" onClick={() => onEdit(game.id)}>Edit</IconButton>
          <IconButton icon={<Trash2 size={16} />} variant="danger" onClick={() => onDelete(game.id)}>Delete</IconButton>
        </div>
      </div>
    </div>
  );
}

function ExportFrame({ id, title, subtitle, theme, seasonMeta, children }: {
  id: string;
  title: string;
  subtitle?: string;
  theme: ExportTheme;
  seasonMeta: SeasonMeta;
  children: React.ReactNode;
}) {
  return (
    <div id={id} className="export-frame" style={{ background: theme.bg, color: theme.text }}>
      <div className="export-card" style={{ background: theme.card, color: theme.text }}>
        <div className="export-header">
          <div className="export-brand">
            <img src="/logo.png" alt="FQH logo" />
            <div>
              <div className="eyebrow">FQH</div>
              <h2>{title}</h2>
              {subtitle ? <div className="muted">{subtitle}</div> : null}
            </div>
          </div>
          <div className="export-top-right">
            <div className="export-season-copy">
              <div className="export-season-title">{buildSeasonTitle(seasonMeta)}</div>
              <div className="export-season-year">{seasonMeta.yearText.trim() || '2026-2027'}</div>
            </div>
            <div className="export-accent" style={{ background: theme.accent }} />
          </div>
        </div>
        {children}
      </div>
    </div>
  );
}

function SeasonExportGraphic({ rows, theme, seasonMeta, gamesCount }: {
  rows: ReturnType<typeof computeSeasonStats>;
  theme: ExportTheme;
  seasonMeta: SeasonMeta;
  gamesCount: number;
}) {
  return (
    <ExportFrame id="season-export" title="Season Stats" subtitle={`${gamesCount} games tracked`} theme={theme} seasonMeta={seasonMeta}>
      <div className="season-export-sheet">
        <div className="season-export-row season-export-head">
          <span>Name</span>
          <span>GP</span>
          <span>Goals</span>
          <span>Assists</span>
          <span>Points</span>
          <span>PPG</span>
          <span>Goalie W</span>
          <span>Goalie L</span>
        </div>
        {rows.length === 0 ? (
          <div className="empty-state">No games yet.</div>
        ) : (
          rows.map((row) => (
            <div className="season-export-row" key={row.name}>
              <span className="strong">{row.name}</span>
              <span>{row.gp}</span>
              <span>{row.goals}</span>
              <span>{row.assists}</span>
              <span>{row.points}</span>
              <span>{row.ppg}</span>
              <span>{row.goalieWins}</span>
              <span>{row.goalieLosses}</span>
            </div>
          ))
        )}
      </div>
    </ExportFrame>
  );
}

function GameExportGraphic({ game, theme, seasonMeta }: { game: Game; theme: ExportTheme; seasonMeta: SeasonMeta }) {
  const redRows = game.entries.filter((r) => r.team === 'Red');
  const blueRows = game.entries.filter((r) => r.team === 'Blue');
  const highlights = buildHighlights(game);

  return (
    <ExportFrame id="game-export" title={`Game Recap · ${formatDate(game.date)}`} subtitle={game.notes || 'No notes'} theme={theme} seasonMeta={seasonMeta}>
      <div className="export-scoreboard">
        <div>
          <div className="export-scoreline">Team Red {game.redScore} - {game.blueScore} Team Blue</div>
        </div>
        <div className="export-highlight-grid">
          {highlights.map((item) => <HighlightCard key={item.label} item={item} />)}
        </div>
      </div>
      <div className="detail-grid-two export-team-grid">
        <ExportTeamPanel team="Red" score={game.redScore} rows={redRows} game={game} />
        <ExportTeamPanel team="Blue" score={game.blueScore} rows={blueRows} game={game} />
      </div>
    </ExportFrame>
  );
}

function ExportTeamPanel({ team, score, rows, game }: { team: Team; score: number; rows: Entry[]; game: Game }) {
  const playerRows = rows.filter((r) => r.role === 'player');
  const goalieRows = rows.filter((r) => r.role === 'goalie');

  return (
    <div className="card team-detail-card export-panel-card">
      <div className="section-head between">
        <h2>Team {team}</h2>
        <div className="score-badge">{score}</div>
      </div>
      <div className="stack gap-16">
        <div>
          <div className="eyebrow muted">Players</div>
          <div className="player-list export-player-list">
            <div className="player-list-head">
              <span>Name</span>
              <span>Goals</span>
              <span>Assists</span>
              <span>Points</span>
            </div>
            {playerRows.map((row) => (
              <div className="player-list-row" key={row.id}>
                <span className="strong">{row.name}</span>
                <span>{row.goals}</span>
                <span>{row.assists}</span>
                <span>{safeNumber(row.goals) + safeNumber(row.assists)}</span>
              </div>
            ))}
          </div>
        </div>
        <div>
          <div className="eyebrow muted">Goalies</div>
          <div className="stack gap-10">
            {goalieRows.length === 0 ? (
              <div className="empty-state">No goalie entered.</div>
            ) : (
              goalieRows.map((goalie) => (
                <div key={goalie.id} className="goalie-card">
                  <div>
                    <div className="strong big">{goalie.name}</div>
                    <div className="muted-line">Assists: {goalie.assists} · Points: {goalieGamePoints(goalie, game.redScore, game.blueScore)}</div>
                  </div>
                  <div className="score-badge small">{goalie.team === 'Red' ? (game.redScore > game.blueScore ? 'W' : game.redScore < game.blueScore ? 'L' : 'T') : (game.blueScore > game.redScore ? 'W' : game.blueScore < game.redScore ? 'L' : 'T')}</div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

export default function App() {
  const configError = getConfigError();
  const initialSeasonMeta = useMemo(() => loadSeasonMeta(), []);
  const [games, setGames] = useState<Game[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [view, setView] = useState<'dashboard' | 'add-game' | 'game-detail'>('dashboard');
  const [selectedGameId, setSelectedGameId] = useState<string | null>(null);
  const [editingGameId, setEditingGameId] = useState<string | null>(null);
  const [allNames, setAllNames] = useState<string[]>([]);
  const [filterText, setFilterText] = useState('');
  const [sortBy, setSortBy] = useState<'points' | 'name' | 'ppg' | 'goalieWins'>('points');
  const [seasonExportTheme, setSeasonExportTheme] = useState(DEFAULT_EXPORT_THEME);
  const [gameExportTheme, setGameExportTheme] = useState(DEFAULT_EXPORT_THEME);
  const [seasonMeta, setSeasonMeta] = useState<SeasonMeta>(initialSeasonMeta);
  const [seasonInput, setSeasonInput] = useState(initialSeasonMeta.seasonText);
  const [activeSeasonKey, setActiveSeasonKey] = useState(buildSeasonKey(initialSeasonMeta.seasonText));
  const [form, setForm] = useState({
    date: '',
    notes: '',
    mvpName: '',
    entries: [
      emptyEntry('Red', 'player'),
      emptyEntry('Red', 'goalie'),
      emptyEntry('Blue', 'player'),
      emptyEntry('Blue', 'goalie'),
    ] as Entry[],
  });

  const redScore = useMemo(() => sumTeamPlayerGoals(form.entries, 'Red'), [form.entries]);
  const blueScore = useMemo(() => sumTeamPlayerGoals(form.entries, 'Blue'), [form.entries]);
  const seasonStats = useMemo(() => computeSeasonStats(games), [games]);
  const selectedGame = games.find((g) => g.id === selectedGameId) || null;

  useEffect(() => {
    if (typeof window !== 'undefined') {
      window.localStorage.setItem(SEASON_META_KEY, JSON.stringify(seasonMeta));
    }
  }, [seasonMeta]);

  const filteredSeasonStats = useMemo(() => {
    const q = filterText.trim().toLowerCase();
    const list = seasonStats.filter((row) => !q || row.name.toLowerCase().includes(q));
    return [...list].sort((a, b) => {
      if (sortBy === 'name') return a.name.localeCompare(b.name);
      if (sortBy === 'ppg') return Number(b.ppg) - Number(a.ppg);
      if (sortBy === 'goalieWins') return b.goalieWins - a.goalieWins;
      return b.points - a.points;
    });
  }, [filterText, seasonStats, sortBy]);

  async function loadGames() {
    if (!supabase) return;
    setLoading(true);
    setError('');

    const gamesRes = await supabase
      .from('games')
      .select('id, season_key, game_date, notes, mvp_name, created_at')
      .eq('season_key', activeSeasonKey)
      .order('game_date', { ascending: false });

    if (gamesRes.error) {
      setError(gamesRes.error.message);
      setLoading(false);
      return;
    }

    const gamesData = (gamesRes.data ?? []) as GameRow[];
    const ids = gamesData.map((g) => g.id);
    let entriesData: EntryRow[] = [];

    if (ids.length > 0) {
      const entriesRes = await supabase
        .from('game_entries')
        .select('id, game_id, name, team, role, goals, assists, created_at')
        .in('game_id', ids)
        .order('created_at', { ascending: true });

      if (entriesRes.error) {
        setError(entriesRes.error.message);
        setLoading(false);
        return;
      }
      entriesData = (entriesRes.data ?? []) as EntryRow[];
    }

    const merged: Game[] = gamesData.map((game) => {
      const entries = entriesData.filter((e) => e.game_id === game.id);
      return {
        id: game.id,
        date: game.game_date,
        notes: game.notes || '',
        mvpName: game.mvp_name || '',
        redScore: sumTeamPlayerGoals(entries, 'Red'),
        blueScore: sumTeamPlayerGoals(entries, 'Blue'),
        entries,
        createdAt: game.created_at,
      };
    });

    setGames(merged);
    setAllNames(Array.from(new Set(entriesData.map((e) => e.name.trim()).filter(Boolean))).sort((a, b) => a.localeCompare(b)));
    setLoading(false);
  }

  useEffect(() => {
    if (!configError) loadGames();
  }, [configError, activeSeasonKey]);

  const applySeason = () => {
    const normalized = normalizeSeasonText(seasonInput);
    setSeasonInput(normalized);
    setSeasonMeta((prev) => ({ ...prev, seasonText: normalized }));
    setActiveSeasonKey(buildSeasonKey(normalized));
    setSelectedGameId(null);
    setEditingGameId(null);
    setView('dashboard');
  };

  const addEntryRow = (team: Team, role: 'player' | 'goalie') => {
    setForm((prev) => ({ ...prev, entries: [...prev.entries, emptyEntry(team, role)] }));
  };

  const updateEntry = (id: string, key: keyof Entry, value: string | number) => {
    setForm((prev) => ({
      ...prev,
      entries: prev.entries.map((entry) =>
        entry.id === id
          ? { ...entry, [key]: key === 'goals' || key === 'assists' ? safeNumber(value) : value }
          : entry
      ),
    }));
  };

  const removeEntry = (id: string) => {
    setForm((prev) => ({ ...prev, entries: prev.entries.filter((entry) => entry.id !== id) }));
  };

  const resetForm = () => {
    setEditingGameId(null);
    setForm({
      date: '',
      notes: '',
      mvpName: '',
      entries: [
        emptyEntry('Red', 'player'),
        emptyEntry('Red', 'goalie'),
        emptyEntry('Blue', 'player'),
        emptyEntry('Blue', 'goalie'),
      ],
    });
  };

  const editGame = (gameId: string) => {
    const game = games.find((g) => g.id === gameId);
    if (!game) return;
    setEditingGameId(game.id);
    setForm({
      date: game.date,
      notes: game.notes,
      mvpName: game.mvpName,
      entries: game.entries.map((entry) => ({ ...entry })),
    });
    setView('add-game');
  };

  const saveGame = async () => {
    if (!supabase) return;
    const cleanEntries = form.entries
      .map((entry) => ({
        ...entry,
        name: entry.name.trim(),
        goals: entry.role === 'goalie' ? 0 : safeNumber(entry.goals),
        assists: safeNumber(entry.assists),
      }))
      .filter((entry) => entry.name);

    if (!form.date) {
      setError('Date is required.');
      return;
    }
    if (cleanEntries.length === 0) {
      setError('Enter at least one player or goalie.');
      return;
    }

    setError('');

    if (editingGameId) {
      const updateGame = await supabase
        .from('games')
        .update({
          game_date: form.date,
          notes: form.notes.trim(),
          season_key: activeSeasonKey,
          mvp_name: form.mvpName.trim(),
        })
        .eq('id', editingGameId);
      if (updateGame.error) return setError(updateGame.error.message);

      const deleteEntries = await supabase.from('game_entries').delete().eq('game_id', editingGameId);
      if (deleteEntries.error) return setError(deleteEntries.error.message);

      const payload = cleanEntries.map((entry) => ({
        game_id: editingGameId,
        name: entry.name,
        team: entry.team,
        role: entry.role,
        goals: entry.goals,
        assists: entry.assists,
      }));
      const insertEntries = await supabase.from('game_entries').insert(payload);
      if (insertEntries.error) return setError(insertEntries.error.message);
    } else {
      const insertGame = await supabase
        .from('games')
        .insert({
          game_date: form.date,
          notes: form.notes.trim(),
          season_key: activeSeasonKey,
          mvp_name: form.mvpName.trim(),
        })
        .select('id')
        .single();
      if (insertGame.error || !insertGame.data) return setError(insertGame.error?.message || 'Could not create game.');

      const payload = cleanEntries.map((entry) => ({
        game_id: insertGame.data.id,
        name: entry.name,
        team: entry.team,
        role: entry.role,
        goals: entry.goals,
        assists: entry.assists,
      }));
      const insertEntries = await supabase.from('game_entries').insert(payload);
      if (insertEntries.error) return setError(insertEntries.error.message);
    }

    await loadGames();
    resetForm();
    setView('dashboard');
  };

  const deleteGame = async (gameId: string) => {
    if (!supabase) return;
    const deleteGameRows = await supabase.from('game_entries').delete().eq('game_id', gameId);
    if (deleteGameRows.error) return setError(deleteGameRows.error.message);
    const deleteGameRecord = await supabase.from('games').delete().eq('id', gameId);
    if (deleteGameRecord.error) return setError(deleteGameRecord.error.message);
    if (selectedGameId === gameId) {
      setSelectedGameId(null);
      setView('dashboard');
    }
    await loadGames();
  };

  const downloadServerPng = async (endpoint: string, filename: string, payload: unknown) => {
    setError('');
    try {
      const response = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        const text = await response.text();
        // If server fails, fall back to client-side export
        console.warn('Server export failed, trying client-side:', text);
        return false;
      }

      const contentType = response.headers.get('content-type') || '';
      if (!contentType.includes('image/png')) {
        const text = await response.text();
        console.warn('Server returned non-PNG, trying client-side:', text);
        return false;
      }

      const blob = await response.blob();
      if (blob.size === 0) {
        console.warn('Server returned empty PNG, trying client-side');
        return false;
      }

      const objectUrl = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = objectUrl;
      a.download = filename;
      a.style.display = 'none';
      document.body.appendChild(a);
      a.click();
      a.remove();

      window.setTimeout(() => URL.revokeObjectURL(objectUrl), 1500);
      return true;
    } catch (err) {
      console.warn('Server export error, will try client-side:', err);
      return false;
    }
  };

  const downloadClientPng = async (elementId: string, filename: string) => {
    setError('');
    const element = document.getElementById(elementId);
    if (!element) {
      setError('Export element not found.');
      return;
    }

    try {
      const canvas = await html2canvas(element, {
        backgroundColor: null,
        scale: 2,
        useCORS: true,
        logging: false,
      });

      const blob = await new Promise<Blob>((resolve) => {
        canvas.toBlob((b) => resolve(b!), 'image/png');
      });

      if (blob.size === 0) {
        setError('Export returned an empty PNG. Please try again.');
        return;
      }

      const objectUrl = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = objectUrl;
      a.download = filename;
      a.style.display = 'none';
      document.body.appendChild(a);
      a.click();
      a.remove();

      window.setTimeout(() => URL.revokeObjectURL(objectUrl), 1500);
    } catch (err) {
      setError(`Export failed: ${err instanceof Error ? err.message : 'Unknown error'}`);
    }
  };

  if (configError) return <ErrorScreen message={configError} />;

  return (
    <div className="page-shell">
      <div className="page-container">
        <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} className="hero">
          <div className="hero-copy">
            <div className="eyebrow">FQH</div>
            <h1>Season Stats Manager</h1>
            <p>Games are stored in Supabase. Team score is auto-calculated from player goals only. Points are combined across player and goalie appearances.</p>
          </div>
          <div className="hero-actions hero-actions-stack">
            <SeasonPicker
              seasonMeta={seasonMeta}
              seasonInput={seasonInput}
              setSeasonInput={setSeasonInput}
              onApplySeason={applySeason}
              setSeasonMeta={setSeasonMeta}
            />
            <IconButton icon={<Plus size={16} />} onClick={() => setView('add-game')}>Add Game</IconButton>
          </div>
        </motion.div>

        {error ? <div className="alert error-alert">{error}</div> : null}

        <div className="stats-grid">
          <StatPill label="Games" value={games.length} />
          <StatPill label="People Tracked" value={seasonStats.length} />
          <StatPill label="Top Scorer" value={seasonStats[0]?.name || '—'} />
          <StatPill label="Top Points" value={seasonStats[0]?.points ?? 0} />
        </div>

        <div className="main-section">
          {view === 'game-detail' && selectedGame ? (
            <GameDetail
              game={selectedGame}
              seasonMeta={seasonMeta}
              theme={gameExportTheme}
              setTheme={setGameExportTheme}
              onExport={async () => {
                const success = await downloadServerPng('/api/export-game', `fqh-game-${selectedGame.date || selectedGame.id}.png`, {
                  game: selectedGame,
                  seasonTitle: buildSeasonTitle(seasonMeta),
                  seasonYear: seasonMeta.yearText.trim() || '2026-2027',
                  theme: gameExportTheme,
                });
                if (!success) {
                  await downloadClientPng('game-export-frame', `fqh-game-${selectedGame.date || selectedGame.id}.png`);
                }
              }}
              onBack={() => setView('dashboard')}
            />
          ) : view === 'add-game' ? (
            <div className="stack gap-16">
              <div className="section-head between">
                <div>
                  <h2>{editingGameId ? 'Edit Game' : 'Add Game'}</h2>
                  <p>{buildSeasonTitle(seasonMeta)} · season key `{activeSeasonKey}`</p>
                </div>
                <IconButton icon={<ChevronLeft size={16} />} variant="secondary" onClick={() => setView('dashboard')}>Back</IconButton>
              </div>

              <div className="card form-card">
                <div className="grid three-col gap-16 compact-grid">
                  <div>
                    <label>Date</label>
                    <input type="date" value={form.date} onChange={(e) => setForm({ ...form, date: e.target.value })} />
                  </div>
                  <div>
                    <label>Red Score</label>
                    <input type="number" value={redScore} disabled />
                  </div>
                  <div>
                    <label>Blue Score</label>
                    <input type="number" value={blueScore} disabled />
                  </div>
                  <div className="span-3">
                    <label>Notes</label>
                    <textarea value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} rows={4} />
                  </div>
                  <div className="span-3">
                    <label>MVP</label>
                    <input list="all-names" value={form.mvpName} onChange={(e) => setForm({ ...form, mvpName: e.target.value })} placeholder="Select or type MVP" />
                  </div>
                </div>
              </div>

              <div className="team-grid">
                {(['Red', 'Blue'] as Team[]).map((team) => (
                  <div className="card team-card" key={team}>
                    <div className="section-head between">
                      <h2>Team {team}</h2>
                      <div className="inline-actions">
                        <IconButton icon={<User size={16} />} variant="secondary" onClick={() => addEntryRow(team, 'player')}>Add Player</IconButton>
                        <IconButton icon={<Shield size={16} />} variant="secondary" onClick={() => addEntryRow(team, 'goalie')}>Add Goalie</IconButton>
                      </div>
                    </div>

                    <div className="stack gap-12">
                      {form.entries.filter((entry) => entry.team === team).map((entry) => (
                        <div className="entry-row" key={entry.id}>
                          <div className="field grow-2">
                            <label>Name</label>
                            <input list="all-names" value={entry.name} onChange={(e) => updateEntry(entry.id, 'name', e.target.value)} />
                          </div>
                          <div className="field grow-1">
                            <label>Role</label>
                            <select value={entry.role} onChange={(e) => updateEntry(entry.id, 'role', e.target.value as 'player' | 'goalie')}>
                              <option value="player">Player</option>
                              <option value="goalie">Goalie</option>
                            </select>
                          </div>
                          <div className="field small-field">
                            <label>Goals</label>
                            <input type="number" value={entry.role === 'goalie' ? 0 : entry.goals} disabled={entry.role === 'goalie'} onChange={(e) => updateEntry(entry.id, 'goals', e.target.value)} />
                          </div>
                          <div className="field small-field">
                            <label>Assists</label>
                            <input type="number" value={entry.assists} onChange={(e) => updateEntry(entry.id, 'assists', e.target.value)} />
                          </div>
                          <div className="field action-field">
                            <IconButton icon={<Trash2 size={16} />} variant="danger" onClick={() => removeEntry(entry.id)}>Remove</IconButton>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>

              <datalist id="all-names">
                {allNames.map((name) => (
                  <option key={name} value={name} />
                ))}
              </datalist>

              <div className="footer-actions">
                <IconButton variant="secondary" onClick={resetForm}>Reset</IconButton>
                <IconButton icon={<Save size={16} />} onClick={saveGame}>Save Game</IconButton>
              </div>
            </div>
          ) : (
            <div className="dashboard-grid">
              <div className="card" id="season-export-wrap">
                <div className="section-head between align-start">
                  <div>
                    <div className="title-row"><Trophy size={20} /> <h2>Season Stats</h2></div>
                    <p>{buildSeasonTitle(seasonMeta)} · players and goalies combined into one table.</p>
                  </div>
                  <ExportControls
                    theme={seasonExportTheme}
                    setTheme={setSeasonExportTheme}
                    onExport={async () => {
                      const success = await downloadServerPng('/api/export-season', 'fqh-season-stats.png', {
                        rows: filteredSeasonStats,
                        seasonTitle: buildSeasonTitle(seasonMeta),
                        seasonYear: seasonMeta.yearText.trim() || '2026-2027',
                        gamesCount: games.length,
                        theme: seasonExportTheme,
                      });
                      if (!success) {
                        await downloadClientPng('season-export-wrap', 'fqh-season-stats.png');
                      }
                    }}
                    compact
                  />
                </div>

                <div className="toolbar">
                  <div className="field grow-2">
                    <label>Filter</label>
                    <input placeholder="Search by name" value={filterText} onChange={(e) => setFilterText(e.target.value)} />
                  </div>
                  <div className="field grow-1">
                    <label>Sort</label>
                    <select value={sortBy} onChange={(e) => setSortBy(e.target.value as typeof sortBy)}>
                      <option value="points">Points</option>
                      <option value="ppg">PPG</option>
                      <option value="goalieWins">Goalie Wins</option>
                      <option value="name">Name</option>
                    </select>
                  </div>
                </div>

                {loading ? (
                  <div className="empty-state">Loading…</div>
                ) : (
                  <div className="table-wrap">
                    <table>
                      <thead>
                        <tr>
                          <th>Name</th>
                          <th>GP</th>
                          <th>Goals</th>
                          <th>Assists</th>
                          <th>Points</th>
                          <th>PPG</th>
                          <th>Goalie W</th>
                          <th>Goalie L</th>
                        </tr>
                      </thead>
                      <tbody>
                        {filteredSeasonStats.length === 0 ? (
                          <tr><td colSpan={8} className="empty-cell">No games yet.</td></tr>
                        ) : (
                          filteredSeasonStats.map((row) => (
                            <tr key={row.name}>
                              <td className="strong">{row.name}</td>
                              <td>{row.gp}</td>
                              <td>{row.goals}</td>
                              <td>{row.assists}</td>
                              <td>{row.points}</td>
                              <td>{row.ppg}</td>
                              <td>{row.goalieWins}</td>
                              <td>{row.goalieLosses}</td>
                            </tr>
                          ))
                        )}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>

              <div className="stack gap-12">
                <div className="card">
                  <div className="section-head">
                    <h2>Game Archive</h2>
                    <p>Open, edit, or delete older games in this season only.</p>
                  </div>
                  <div className="stack gap-12">
                    {loading ? (
                      <div className="empty-state">Loading…</div>
                    ) : games.length === 0 ? (
                      <div className="empty-state">No games saved yet.</div>
                    ) : (
                      games.map((game) => (
                        <GameCard
                          key={game.id}
                          game={game}
                          onOpen={(id) => {
                            setSelectedGameId(id);
                            setView('game-detail');
                          }}
                          onEdit={editGame}
                          onDelete={deleteGame}
                        />
                      ))
                    )}
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      <div className="export-stage" aria-hidden="true">
        <SeasonExportGraphic rows={filteredSeasonStats} theme={seasonExportTheme} seasonMeta={seasonMeta} gamesCount={games.length} />
        {selectedGame ? <GameExportGraphic game={selectedGame} theme={gameExportTheme} seasonMeta={seasonMeta} /> : null}
      </div>
    </div>
  );
}

function GameDetail({
  game,
  onBack,
  theme,
  setTheme,
  onExport,
  seasonMeta,
}: {
  game: Game;
  onBack: () => void;
  theme: ExportTheme;
  setTheme: React.Dispatch<React.SetStateAction<ExportTheme>>;
  onExport: () => void;
  seasonMeta: SeasonMeta;
}) {
  const redRows = game.entries.filter((r) => r.team === 'Red');
  const blueRows = game.entries.filter((r) => r.team === 'Blue');
  const highlights = buildHighlights(game);

  const TeamPanel = ({ team, score, rows, game }: { team: Team; score: number; rows: Entry[]; game: Game }) => (
    <div className="card team-detail-card">
      <div className="section-head between">
        <h2>Team {team}</h2>
        <div className="score-badge">{score}</div>
      </div>
      <div className="stack gap-16">
        <div>
          <div className="eyebrow muted">Players</div>
          <div className="table-wrap compact-table">
            <table>
              <thead>
                <tr>
                  <th>Name</th>
                  <th>Goals</th>
                  <th>Assists</th>
                  <th>Points</th>
                </tr>
              </thead>
              <tbody>
                {rows.filter((r) => r.role === 'player').map((row) => (
                  <tr key={row.id}>
                    <td className="strong">{row.name}</td>
                    <td>{row.goals}</td>
                    <td>{row.assists}</td>
                    <td>{safeNumber(row.goals) + safeNumber(row.assists)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
        <div>
          <div className="eyebrow muted">Goalies</div>
          <div className="stack gap-10">
            {rows.filter((r) => r.role === 'goalie').length === 0 ? (
              <div className="empty-state">No goalie entered.</div>
            ) : (
              rows.filter((r) => r.role === 'goalie').map((goalie) => (
                <div key={goalie.id} className="goalie-card">
                  <div>
                    <div className="strong big">{goalie.name}</div>
                    <div className="muted-line">Assists: {goalie.assists} · Points: {goalieGamePoints(goalie, game.redScore, game.blueScore)}</div>
                  </div>
                  <div className="score-badge small">{goalie.team === 'Red' ? (game.redScore > game.blueScore ? 'W' : game.redScore < game.blueScore ? 'L' : 'T') : (game.blueScore > game.redScore ? 'W' : game.blueScore < game.redScore ? 'L' : 'T')}</div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );

  return (
    <div className="stack gap-16">
      <div className="section-head between align-start">
        <IconButton icon={<ChevronLeft size={16} />} variant="secondary" onClick={onBack}>Back to games</IconButton>
        <ExportControls theme={theme} setTheme={setTheme} onExport={onExport} compact />
      </div>

      <div id="game-export-frame" className="card export-preview-card">
        <div className="section-head between align-start">
          <div>
            <div className="eyebrow">FQH</div>
            <h2>Game Recap · {formatDate(game.date)}</h2>
            <p>{seasonMeta.yearText.trim() || '2026-2027'}</p>
          </div>
        </div>
        <div className="hero mini-hero export-inner-hero">
          <div className="hero-copy wide-copy">
            <h1 className="scoreline">Team Red {game.redScore} - {game.blueScore} Team Blue</h1>
          </div>
          <div className="stats-grid detail-grid">
            {highlights.map((item) => <HighlightCard key={item.label} item={item} />)}
          </div>
        </div>

        <div className="detail-grid-two">
          <TeamPanel team="Red" score={game.redScore} rows={redRows} game={game} />
          <TeamPanel team="Blue" score={game.blueScore} rows={blueRows} game={game} />
        </div>
      </div>
    </div>
  );
}
