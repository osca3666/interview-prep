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
      review_events: {
        Row: {
          id: string
          new_review_stage: number
          next_review_at: string
          previous_next_review_at: string | null
          previous_review_stage: number
          rating: string
          reviewed_at: string
          user_id: string
          user_problem_id: string
        }
        Insert: {
          id?: string
          new_review_stage: number
          next_review_at: string
          previous_next_review_at?: string | null
          previous_review_stage: number
          rating: string
          reviewed_at?: string
          user_id: string
          user_problem_id: string
        }
        Update: {
          id?: string
          new_review_stage?: number
          next_review_at?: string
          previous_next_review_at?: string | null
          previous_review_stage?: number
          rating?: string
          reviewed_at?: string
          user_id?: string
          user_problem_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "review_events_user_problem_user_fk"
            columns: ["user_problem_id", "user_id"]
            isOneToOne: false
            referencedRelation: "user_problems"
            referencedColumns: ["id", "user_id"]
          },
        ]
      }
      user_problems: {
        Row: {
          created_at: string
          difficulty: string
          id: string
          last_reviewed_at: string | null
          leetcode_slug: string
          leetcode_url: string
          lifecycle_state: string
          mastery_score: number
          next_review_at: string
          notes: string
          pattern: string | null
          review_stage: number
          schedule_version: number
          title: string
          total_reviews: number
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          difficulty: string
          id?: string
          last_reviewed_at?: string | null
          leetcode_slug: string
          leetcode_url: string
          lifecycle_state?: string
          mastery_score?: number
          next_review_at?: string
          notes?: string
          pattern?: string | null
          review_stage?: number
          schedule_version?: number
          title: string
          total_reviews?: number
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          difficulty?: string
          id?: string
          last_reviewed_at?: string | null
          leetcode_slug?: string
          leetcode_url?: string
          lifecycle_state?: string
          mastery_score?: number
          next_review_at?: string
          notes?: string
          pattern?: string | null
          review_stage?: number
          schedule_version?: number
          title?: string
          total_reviews?: number
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      create_user_problem: {
        Args: {
          p_difficulty: string
          p_leetcode_slug: string
          p_leetcode_url: string
          p_notes: string
          p_pattern: string
          p_rating: string
          p_start_date: string
          p_start_mode: string
          p_title: string
        }
        Returns: {
          mastery_score: number
          next_review_at: string
          review_stage: number
          total_reviews: number
          user_problem_id: string
        }[]
      }
      create_user_problem_with_timezone: {
        Args: {
          p_difficulty: string
          p_leetcode_slug: string
          p_leetcode_url: string
          p_notes: string
          p_pattern: string
          p_rating: string
          p_start_date: string
          p_start_mode: string
          p_time_zone: string
          p_title: string
        }
        Returns: {
          mastery_score: number
          next_review_at: string
          review_stage: number
          total_reviews: number
          user_problem_id: string
        }[]
      }
      submit_problem_review: {
        Args: {
          p_expected_schedule_version: number
          p_rating: string
          p_user_problem_id: string
        }
        Returns: {
          new_next_review_at: string
          new_review_stage: number
          new_schedule_version: number
        }[]
      }
    }
    Enums: {
      [_ in never]: never
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
    Enums: {},
  },
} as const
