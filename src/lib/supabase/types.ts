export type UserRole = "admin" | "player";
export type SeasonStatus = "qualifying" | "teams_set" | "in_progress" | "completed";

export interface Database {
  public: {
    Tables: {
      profiles: {
        Row: {
          id: string;
          name: string;
          email: string;
          role: UserRole;
          created_at: string;
        };
        Insert: {
          id: string;
          name: string;
          email: string;
          role?: UserRole;
        };
        Update: {
          name?: string;
          role?: UserRole;
        };
        Relationships: [];
      };
      seasons: {
        Row: {
          id: string;
          year: number;
          qualification_start: string | null;
          qualification_end: string | null;
          status: SeasonStatus;
          created_at: string;
        };
        Insert: {
          id?: string;
          year: number;
          qualification_start?: string | null;
          qualification_end?: string | null;
          status?: SeasonStatus;
        };
        Update: {
          year?: number;
          qualification_start?: string | null;
          qualification_end?: string | null;
          status?: SeasonStatus;
        };
        Relationships: [];
      };
      rounds: {
        Row: {
          id: string;
          user_id: string;
          season_id: string;
          course_par: number;
          score: number;
          date: string;
          created_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          season_id: string;
          course_par: number;
          score: number;
          date?: string;
        };
        Update: {
          course_par?: number;
          score?: number;
          date?: string;
        };
        Relationships: [];
      };
      teams: {
        Row: {
          id: string;
          season_id: string;
          player_1_id: string;
          player_2_id: string;
          created_at: string;
        };
        Insert: {
          id?: string;
          season_id: string;
          player_1_id: string;
          player_2_id: string;
        };
        Update: {
          player_1_id?: string;
          player_2_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "teams_player_1_id_fkey";
            columns: ["player_1_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "teams_player_2_id_fkey";
            columns: ["player_2_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          }
        ];
      };
      tournament_scores: {
        Row: {
          id: string;
          team_id: string;
          season_id: string;
          round_number: number;
          strokes: number | null;
          entered_by: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          team_id: string;
          season_id: string;
          round_number: number;
          strokes?: number | null;
          entered_by?: string | null;
        };
        Update: {
          strokes?: number | null;
          entered_by?: string | null;
        };
        Relationships: [];
      };
      trophy_history: {
        Row: {
          season_id: string;
          winning_team_names: string;
          photo_url: string | null;
          created_at: string;
        };
        Insert: {
          season_id: string;
          winning_team_names: string;
          photo_url?: string | null;
        };
        Update: {
          winning_team_names?: string;
          photo_url?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "trophy_history_season_id_fkey";
            columns: ["season_id"];
            isOneToOne: true;
            referencedRelation: "seasons";
            referencedColumns: ["id"];
          }
        ];
      };
    };
    Views: Record<string, never>;
    Functions: Record<string, never>;
    Enums: {
      user_role: UserRole;
      season_status: SeasonStatus;
    };
    CompositeTypes: Record<string, never>;
  };
}
