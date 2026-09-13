export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[];

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.5";
  };
  public: {
    Tables: {
      chat_conversations: {
        Row: {
          id: string;
          user_id: string;
          title: string;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          title?: string;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          title?: string;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      chat_messages: {
        Row: {
          id: string;
          conversation_id: string;
          role: string;
          content: string;
          created_at: string;
        };
        Insert: {
          id?: string;
          conversation_id: string;
          role: string;
          content: string;
          created_at?: string;
        };
        Update: {
          id?: string;
          conversation_id?: string;
          role?: string;
          content?: string;
          created_at?: string;
        };
        Relationships: [];
      };
      admin_directors: {
        Row: {
          user_id: string;
          granted_by: string | null;
          granted_at: string;
        };
        Insert: {
          user_id: string;
          granted_by?: string | null;
          granted_at?: string;
        };
        Update: {
          user_id?: string;
          granted_by?: string | null;
          granted_at?: string;
        };
        Relationships: [];
      };
      admin_requests: {
        Row: {
          id: string;
          type: string;
          target_user_id: string;
          requested_by: string;
          reason: string | null;
          status: string;
          reviewed_by: string | null;
          reviewed_at: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          type: string;
          target_user_id: string;
          requested_by: string;
          reason?: string | null;
          status?: string;
          reviewed_by?: string | null;
          reviewed_at?: string | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          type?: string;
          target_user_id?: string;
          requested_by?: string;
          reason?: string | null;
          status?: string;
          reviewed_by?: string | null;
          reviewed_at?: string | null;
          created_at?: string;
        };
        Relationships: [];
      };
      alerts: {
        Row: {
          active: boolean;
          created_at: string;
          expires_at: string | null;
          id: string;
          latitude: number | null;
          longitude: number | null;
          message: string;
          radius_km: number;
          region: string | null;
          severity: string;
          title: string;
          updated_at: string;
        };
        Insert: {
          active?: boolean;
          created_at?: string;
          expires_at?: string | null;
          id?: string;
          latitude?: number | null;
          longitude?: number | null;
          message: string;
          radius_km?: number;
          region?: string | null;
          severity?: string;
          title: string;
          updated_at?: string;
        };
        Update: {
          active?: boolean;
          created_at?: string;
          expires_at?: string | null;
          id?: string;
          latitude?: number | null;
          longitude?: number | null;
          message?: string;
          radius_km?: number;
          region?: string | null;
          severity?: string;
          title?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      broadcasts: {
        Row: {
          active: boolean;
          created_at: string;
          id: string;
          message: string;
        };
        Insert: {
          active?: boolean;
          created_at?: string;
          id?: string;
          message: string;
        };
        Update: {
          active?: boolean;
          created_at?: string;
          id?: string;
          message?: string;
        };
        Relationships: [];
      };
      chat_logs: {
        Row: {
          category: string;
          created_at: string;
          id: string;
          language: string | null;
          location: string | null;
          user_id: string | null;
        };
        Insert: {
          category?: string;
          created_at?: string;
          id?: string;
          language?: string | null;
          location?: string | null;
          user_id?: string | null;
        };
        Update: {
          category?: string;
          created_at?: string;
          id?: string;
          language?: string | null;
          location?: string | null;
          user_id?: string | null;
        };
        Relationships: [];
      };
      contact_messages: {
        Row: {
          created_at: string;
          email: string;
          handled: boolean;
          id: string;
          message: string;
          name: string;
          subject: string | null;
        };
        Insert: {
          created_at?: string;
          email: string;
          handled?: boolean;
          id?: string;
          message: string;
          name: string;
          subject?: string | null;
        };
        Update: {
          created_at?: string;
          email?: string;
          handled?: boolean;
          id?: string;
          message?: string;
          name?: string;
          subject?: string | null;
        };
        Relationships: [];
      };
      posts: {
        Row: {
          author_id: string | null;
          content: string;
          cover_url: string | null;
          created_at: string;
          excerpt: string | null;
          id: string;
          published: boolean;
          slug: string;
          title: string;
          updated_at: string;
        };
        Insert: {
          author_id?: string | null;
          content?: string;
          cover_url?: string | null;
          created_at?: string;
          excerpt?: string | null;
          id?: string;
          published?: boolean;
          slug: string;
          title: string;
          updated_at?: string;
        };
        Update: {
          author_id?: string | null;
          content?: string;
          cover_url?: string | null;
          created_at?: string;
          excerpt?: string | null;
          id?: string;
          published?: boolean;
          slug?: string;
          title?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      profiles: {
        Row: {
          avatar_url: string | null;
          created_at: string;
          display_name: string | null;
          email: string | null;
          id: string;
          updated_at: string;
        };
        Insert: {
          avatar_url?: string | null;
          created_at?: string;
          display_name?: string | null;
          email?: string | null;
          id: string;
          updated_at?: string;
        };
        Update: {
          avatar_url?: string | null;
          created_at?: string;
          display_name?: string | null;
          email?: string | null;
          id?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      user_roles: {
        Row: {
          created_at: string;
          id: string;
          role: Database["public"]["Enums"]["app_role"];
          user_id: string;
        };
        Insert: {
          created_at?: string;
          id?: string;
          role: Database["public"]["Enums"]["app_role"];
          user_id: string;
        };
        Update: {
          created_at?: string;
          id?: string;
          role?: Database["public"]["Enums"]["app_role"];
          user_id?: string;
        };
        Relationships: [];
      };
    };
    Views: {
      [_ in never]: never;
    };
    Functions: {
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"];
          _user_id: string;
        };
        Returns: boolean;
      };
      cleanup_unverified_users: {
        Args: {
          older_than?: unknown;
        };
        Returns: number;
      };
    };
    Enums: {
      app_role: "admin" | "user";
    };
    CompositeTypes: {
      [_ in never]: never;
    };
  };
};

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">;

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">];

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R;
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] & DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R;
      }
      ? R
      : never
    : never;

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    keyof DefaultSchema["Tables"] | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I;
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I;
      }
      ? I
      : never
    : never;

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    keyof DefaultSchema["Tables"] | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U;
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U;
      }
      ? U
      : never
    : never;

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    keyof DefaultSchema["Enums"] | { schema: keyof DatabaseWithoutInternals },
  EnumName extends (DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never) = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never;

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    keyof DefaultSchema["CompositeTypes"] | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends (PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never) = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never;

export const Constants = {
  public: {
    Enums: {
      app_role: ["admin", "user"],
    },
  },
} as const;
