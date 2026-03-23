import type { Entry, Game, SeasonRow, Team } from './types';

export function uid() {
  return Math.random().toString(36).slice(2, 10);
}

export function safeNumber(value: string | number | null | undefined) {
  const n = Number(value);
  return Number.isFinite(n) ? n : 0;
}

export function formatDate(value: string) {
  if (!value) return 'No date';
  const d = new Date(`${value}T12:00:00`);
  if (Number.isNaN(d.getTime())) return value;
  return d.toLocaleDateString(undefined, {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });
}

export function emptyEntry(team: Team, role: 'player' | 'goalie'): Entry {
  return {
    id: uid(),
    game_id: null,
    name: '',
    team,
    role,
    goals: 0,
    assists: 0,
  };
}

export function sumTeamPlayerGoals(rows: Entry[], team: Team) {
  return rows
    .filter((row) => row.team === team && row.role === 'player')
    .reduce((sum, row) => sum + safeNumber(row.goals), 0);
}

export function goalieGamePoints(row: Entry, redScore: number, blueScore: number) {
  const assists = safeNumber(row.assists);
  const won = row.team === 'Red' ? redScore > blueScore : blueScore > redScore;
  const diff = won ? Math.abs(redScore - blueScore) : 0;
  return 5 + assists + diff;
}

export function gameEntryPoints(row: Entry, redScore: number, blueScore: number) {
  return row.role === 'goalie'
    ? goalieGamePoints(row, redScore, blueScore)
    : safeNumber(row.goals) + safeNumber(row.assists);
}

export function computeSeasonStats(games: Game[]): SeasonRow[] {
  const byName = new Map<string, SeasonRow>();

  for (const game of games) {
    for (const row of game.entries) {
      const name = row.name.trim();
      if (!name) continue;

      if (!byName.has(name)) {
        byName.set(name, {
          name,
          gp: 0,
          goals: 0,
          assists: 0,
          points: 0,
          ppg: '0.00',
          goalieWins: 0,
          goalieLosses: 0,
        });
      }

      const current = byName.get(name)!;
      current.gp += 1;

      if (row.role === 'goalie') {
        current.assists += safeNumber(row.assists);
        current.points += goalieGamePoints(row, game.redScore, game.blueScore);
        const didWin = row.team === 'Red' ? game.redScore > game.blueScore : game.blueScore > game.redScore;
        const didLose = row.team === 'Red' ? game.redScore < game.blueScore : game.blueScore < game.redScore;
        if (didWin) current.goalieWins += 1;
        if (didLose) current.goalieLosses += 1;
      } else {
        const goals = safeNumber(row.goals);
        const assists = safeNumber(row.assists);
        current.goals += goals;
        current.assists += assists;
        current.points += goals + assists;
      }
    }
  }

  return Array.from(byName.values())
    .map((row) => ({
      ...row,
      ppg: row.gp > 0 ? (row.points / row.gp).toFixed(2) : '0.00',
    }))
    .sort((a, b) => {
      if (b.points !== a.points) return b.points - a.points;
      if (b.goalieWins !== a.goalieWins) return b.goalieWins - a.goalieWins;
      return a.name.localeCompare(b.name);
    });
}
