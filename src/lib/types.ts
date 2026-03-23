export type Team = 'Red' | 'Blue';
export type Role = 'player' | 'goalie';

export type Entry = {
  id: string;
  game_id?: string | null;
  name: string;
  team: Team;
  role: Role;
  goals: number;
  assists: number;
};

export type Game = {
  id: string;
  date: string;
  notes: string;
  mvpName: string;
  redScore: number;
  blueScore: number;
  entries: Entry[];
  createdAt: string;
};

export type SeasonRow = {
  name: string;
  gp: number;
  goals: number;
  assists: number;
  points: number;
  ppg: string;
  goalieWins: number;
  goalieLosses: number;
};
