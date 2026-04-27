// Auto-generated from the live Supabase schema via the Supabase MCP
// (mcp__claude_ai_Supabase__generate_typescript_types).
// To regenerate after a schema change: ask the assistant to call
// generate_typescript_types and overwrite this file.

export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.5"
  }
  public: {
    Tables: {
      accelerant_events: {
        Row: {
          id: string
          kind: Database["public"]["Enums"]["accelerant_t"]
          pair_id: string | null
          payload: Json
          round_id: string
          scope: Database["public"]["Enums"]["accelerant_scope_t"]
          triggered_at: string
          triggered_by: string
        }
        Insert: {
          id?: string
          kind: Database["public"]["Enums"]["accelerant_t"]
          pair_id?: string | null
          payload?: Json
          round_id: string
          scope: Database["public"]["Enums"]["accelerant_scope_t"]
          triggered_at?: string
          triggered_by: string
        }
        Update: {
          id?: string
          kind?: Database["public"]["Enums"]["accelerant_t"]
          pair_id?: string | null
          payload?: Json
          round_id?: string
          scope?: Database["public"]["Enums"]["accelerant_scope_t"]
          triggered_at?: string
          triggered_by?: string
        }
        Relationships: [
          {
            foreignKeyName: "accelerant_events_pair_id_fkey"
            columns: ["pair_id"]
            isOneToOne: false
            referencedRelation: "pairs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "accelerant_events_round_id_fkey"
            columns: ["round_id"]
            isOneToOne: false
            referencedRelation: "rounds"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "accelerant_events_triggered_by_fkey"
            columns: ["triggered_by"]
            isOneToOne: false
            referencedRelation: "participants"
            referencedColumns: ["id"]
          },
        ]
      }
      briefs: {
        Row: {
          created_at: string
          id: string
          pair_round_id: string
          revealed: boolean
          role: Database["public"]["Enums"]["role_t"]
          rules: Json
          source: Database["public"]["Enums"]["brief_source_t"]
          title: string
        }
        Insert: {
          created_at?: string
          id?: string
          pair_round_id: string
          revealed?: boolean
          role: Database["public"]["Enums"]["role_t"]
          rules: Json
          source: Database["public"]["Enums"]["brief_source_t"]
          title: string
        }
        Update: {
          created_at?: string
          id?: string
          pair_round_id?: string
          revealed?: boolean
          role?: Database["public"]["Enums"]["role_t"]
          rules?: Json
          source?: Database["public"]["Enums"]["brief_source_t"]
          title?: string
        }
        Relationships: [
          {
            foreignKeyName: "briefs_pair_round_id_fkey"
            columns: ["pair_round_id"]
            isOneToOne: false
            referencedRelation: "pair_rounds"
            referencedColumns: ["id"]
          },
        ]
      }
      briefs_library: {
        Row: {
          complexity_max: number
          complexity_min: number
          id: string
          role: Database["public"]["Enums"]["role_t"]
          rules: Json
          title: string
        }
        Insert: {
          complexity_max: number
          complexity_min: number
          id?: string
          role: Database["public"]["Enums"]["role_t"]
          rules: Json
          title: string
        }
        Update: {
          complexity_max?: number
          complexity_min?: number
          id?: string
          role?: Database["public"]["Enums"]["role_t"]
          rules?: Json
          title?: string
        }
        Relationships: []
      }
      games: {
        Row: {
          builder_brief_custom: Json | null
          builder_brief_on: boolean
          builder_brief_source: Database["public"]["Enums"]["brief_source_t"]
          code: string
          created_at: string
          default_complexity: number
          ended_at: string | null
          gemini_calls_used: number
          gm_participant_id: string
          guider_brief_custom: Json | null
          guider_brief_on: boolean
          guider_brief_source: Database["public"]["Enums"]["brief_source_t"]
          host_token_hash: string
          id: string
          last_interaction_at: string
          participant_cap: number
          round_count: number
          round_duration_seconds: number
          scoring_correct_pts: number
          scoring_wrong_pts: number
          sound_on: boolean
          status: Database["public"]["Enums"]["game_status_t"]
          team_mode: Database["public"]["Enums"]["team_mode_t"]
          video_call_url: string
          whiteboard_url: string | null
          workshop_name: string
        }
        Insert: {
          builder_brief_custom?: Json | null
          builder_brief_on?: boolean
          builder_brief_source?: Database["public"]["Enums"]["brief_source_t"]
          code: string
          created_at?: string
          default_complexity: number
          ended_at?: string | null
          gemini_calls_used?: number
          gm_participant_id: string
          guider_brief_custom?: Json | null
          guider_brief_on?: boolean
          guider_brief_source?: Database["public"]["Enums"]["brief_source_t"]
          host_token_hash: string
          id?: string
          last_interaction_at?: string
          participant_cap: number
          round_count: number
          round_duration_seconds?: number
          scoring_correct_pts?: number
          scoring_wrong_pts?: number
          sound_on?: boolean
          status?: Database["public"]["Enums"]["game_status_t"]
          team_mode: Database["public"]["Enums"]["team_mode_t"]
          video_call_url: string
          whiteboard_url?: string | null
          workshop_name: string
        }
        Update: {
          builder_brief_custom?: Json | null
          builder_brief_on?: boolean
          builder_brief_source?: Database["public"]["Enums"]["brief_source_t"]
          code?: string
          created_at?: string
          default_complexity?: number
          ended_at?: string | null
          gemini_calls_used?: number
          gm_participant_id?: string
          guider_brief_custom?: Json | null
          guider_brief_on?: boolean
          guider_brief_source?: Database["public"]["Enums"]["brief_source_t"]
          host_token_hash?: string
          id?: string
          last_interaction_at?: string
          participant_cap?: number
          round_count?: number
          round_duration_seconds?: number
          scoring_correct_pts?: number
          scoring_wrong_pts?: number
          sound_on?: boolean
          status?: Database["public"]["Enums"]["game_status_t"]
          team_mode?: Database["public"]["Enums"]["team_mode_t"]
          video_call_url?: string
          whiteboard_url?: string | null
          workshop_name?: string
        }
        Relationships: []
      }
      gemini_budget: {
        Row: {
          calls_used: number
          day: string
        }
        Insert: {
          calls_used?: number
          day: string
        }
        Update: {
          calls_used?: number
          day?: string
        }
        Relationships: []
      }
      pair_rounds: {
        Row: {
          briefs_revealed: boolean
          builder_snapshot: Json | null
          goal_pattern: Json
          id: string
          pair_id: string
          pattern_seed: string
          prototype_until: string | null
          round_id: string
          shares_remaining: number
          test_enabled: boolean
        }
        Insert: {
          briefs_revealed?: boolean
          builder_snapshot?: Json | null
          goal_pattern: Json
          id?: string
          pair_id: string
          pattern_seed: string
          prototype_until?: string | null
          round_id: string
          shares_remaining?: number
          test_enabled?: boolean
        }
        Update: {
          briefs_revealed?: boolean
          builder_snapshot?: Json | null
          goal_pattern?: Json
          id?: string
          pair_id?: string
          pattern_seed?: string
          prototype_until?: string | null
          round_id?: string
          shares_remaining?: number
          test_enabled?: boolean
        }
        Relationships: [
          {
            foreignKeyName: "pair_rounds_pair_id_fkey"
            columns: ["pair_id"]
            isOneToOne: false
            referencedRelation: "pairs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pair_rounds_round_id_fkey"
            columns: ["round_id"]
            isOneToOne: false
            referencedRelation: "rounds"
            referencedColumns: ["id"]
          },
        ]
      }
      pairs: {
        Row: {
          builder_id: string | null
          created_at: string
          display_name: string | null
          game_id: string
          guider_id: string | null
          id: string
        }
        Insert: {
          builder_id?: string | null
          created_at?: string
          display_name?: string | null
          game_id: string
          guider_id?: string | null
          id?: string
        }
        Update: {
          builder_id?: string | null
          created_at?: string
          display_name?: string | null
          game_id?: string
          guider_id?: string | null
          id?: string
        }
        Relationships: [
          {
            foreignKeyName: "pairs_builder_id_fkey"
            columns: ["builder_id"]
            isOneToOne: false
            referencedRelation: "participants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pairs_game_id_fkey"
            columns: ["game_id"]
            isOneToOne: false
            referencedRelation: "games"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pairs_guider_id_fkey"
            columns: ["guider_id"]
            isOneToOne: false
            referencedRelation: "participants"
            referencedColumns: ["id"]
          },
        ]
      }
      participants: {
        Row: {
          color: string
          display_name: string
          game_id: string
          id: string
          joined_at: string
          last_seen_at: string
          pair_id: string | null
          released_at: string | null
          role: Database["public"]["Enums"]["role_t"]
        }
        Insert: {
          color: string
          display_name: string
          game_id: string
          id?: string
          joined_at?: string
          last_seen_at?: string
          pair_id?: string | null
          released_at?: string | null
          role?: Database["public"]["Enums"]["role_t"]
        }
        Update: {
          color?: string
          display_name?: string
          game_id?: string
          id?: string
          joined_at?: string
          last_seen_at?: string
          pair_id?: string | null
          released_at?: string | null
          role?: Database["public"]["Enums"]["role_t"]
        }
        Relationships: [
          {
            foreignKeyName: "participants_game_id_fkey"
            columns: ["game_id"]
            isOneToOne: false
            referencedRelation: "games"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "participants_pair_id_fkey"
            columns: ["pair_id"]
            isOneToOne: false
            referencedRelation: "pairs"
            referencedColumns: ["id"]
          },
        ]
      }
      placements: {
        Row: {
          color: string
          id: string
          pair_round_id: string
          placed_at: string
          placed_by: string
          q: number
          r: number
          rot: number
          shape: string
        }
        Insert: {
          color: string
          id?: string
          pair_round_id: string
          placed_at?: string
          placed_by: string
          q: number
          r: number
          rot: number
          shape: string
        }
        Update: {
          color?: string
          id?: string
          pair_round_id?: string
          placed_at?: string
          placed_by?: string
          q?: number
          r?: number
          rot?: number
          shape?: string
        }
        Relationships: [
          {
            foreignKeyName: "placements_pair_round_id_fkey"
            columns: ["pair_round_id"]
            isOneToOne: false
            referencedRelation: "pair_rounds"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "placements_placed_by_fkey"
            columns: ["placed_by"]
            isOneToOne: false
            referencedRelation: "participants"
            referencedColumns: ["id"]
          },
        ]
      }
      rate_limits: {
        Row: {
          count: number
          key: string
          window_start: string
        }
        Insert: {
          count?: number
          key: string
          window_start?: string
        }
        Update: {
          count?: number
          key?: string
          window_start?: string
        }
        Relationships: []
      }
      rounds: {
        Row: {
          complexity: number
          duration_seconds: number
          ended_at: string | null
          game_id: string
          id: string
          index: number
          started_at: string | null
          status: Database["public"]["Enums"]["round_status_t"]
        }
        Insert: {
          complexity: number
          duration_seconds: number
          ended_at?: string | null
          game_id: string
          id?: string
          index: number
          started_at?: string | null
          status?: Database["public"]["Enums"]["round_status_t"]
        }
        Update: {
          complexity?: number
          duration_seconds?: number
          ended_at?: string | null
          game_id?: string
          id?: string
          index?: number
          started_at?: string | null
          status?: Database["public"]["Enums"]["round_status_t"]
        }
        Relationships: [
          {
            foreignKeyName: "rounds_game_id_fkey"
            columns: ["game_id"]
            isOneToOne: false
            referencedRelation: "games"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      clear_allocations: { Args: { p_game_id: string }; Returns: undefined }
      create_pair_with_roles: {
        Args: { p_builder_id: string; p_game_id: string; p_guider_id: string }
        Returns: {
          builder_id: string | null
          created_at: string
          game_id: string
          guider_id: string | null
          id: string
        }
        SetofOptions: {
          from: "*"
          to: "pairs"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      reserve_gemini_call: {
        Args: {
          p_game_id: string
          p_per_day_max: number
          p_per_game_max: number
        }
        Returns: Json
      }
    }
    Enums: {
      accelerant_scope_t: "pair" | "all"
      accelerant_t:
        | "prototype"
        | "reveal_briefs"
        | "test_build"
        | "agile_share"
        | "time_pressure"
        | "vocab_swap"
        | "change_builder_brief"
        | "randomizer"
        | "requirement_change"
        | "harder"
        | "easier"
      brief_source_t: "gm" | "library" | "gemini"
      game_status_t: "lobby" | "running" | "ended" | "purged"
      role_t: "gm" | "builder" | "guider" | "observer" | "lobby"
      round_status_t: "pending" | "running" | "ended"
      team_mode_t: "gm_picks" | "players_pick"
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {
      accelerant_scope_t: ["pair", "all"],
      accelerant_t: [
        "prototype",
        "reveal_briefs",
        "test_build",
        "agile_share",
        "time_pressure",
        "vocab_swap",
        "change_builder_brief",
        "randomizer",
        "requirement_change",
        "harder",
        "easier",
      ],
      brief_source_t: ["gm", "library", "gemini"],
      game_status_t: ["lobby", "running", "ended", "purged"],
      role_t: ["gm", "builder", "guider", "observer", "lobby"],
      round_status_t: ["pending", "running", "ended"],
      team_mode_t: ["gm_picks", "players_pick"],
    },
  },
} as const
