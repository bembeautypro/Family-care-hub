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
      access_logs: {
        Row: {
          action: string
          created_at: string | null
          emergency_link_id: string | null
          family_id: string | null
          family_id_snapshot: string
          id: string
          ip_address: string | null
          patient_id: string | null
          patient_id_snapshot: string | null
          resource_id: string | null
          resource_type: string | null
          user_agent: string | null
          user_id: string | null
        }
        Insert: {
          action: string
          created_at?: string | null
          emergency_link_id?: string | null
          family_id?: string | null
          family_id_snapshot: string
          id?: string
          ip_address?: string | null
          patient_id?: string | null
          patient_id_snapshot?: string | null
          resource_id?: string | null
          resource_type?: string | null
          user_agent?: string | null
          user_id?: string | null
        }
        Update: {
          action?: string
          created_at?: string | null
          emergency_link_id?: string | null
          family_id?: string | null
          family_id_snapshot?: string
          id?: string
          ip_address?: string | null
          patient_id?: string | null
          patient_id_snapshot?: string | null
          resource_id?: string | null
          resource_type?: string | null
          user_agent?: string | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "access_logs_emergency_link_id_fkey"
            columns: ["emergency_link_id"]
            isOneToOne: false
            referencedRelation: "emergency_links"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "access_logs_family_id_fkey"
            columns: ["family_id"]
            isOneToOne: false
            referencedRelation: "families"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "access_logs_patient_id_fkey"
            columns: ["patient_id"]
            isOneToOne: false
            referencedRelation: "patients"
            referencedColumns: ["id"]
          },
        ]
      }
      appointments: {
        Row: {
          address: string | null
          created_at: string | null
          deleted_at: string | null
          deleted_by: string | null
          doctor_name: string | null
          id: string
          location: string | null
          map_url: string | null
          notes: string | null
          parent_appointment_id: string | null
          patient_id: string | null
          responsible_user_id: string
          scheduled_at: string
          specialty: string | null
          status: string
          title: string
          type: string
          updated_at: string | null
        }
        Insert: {
          address?: string | null
          created_at?: string | null
          deleted_at?: string | null
          deleted_by?: string | null
          doctor_name?: string | null
          id?: string
          location?: string | null
          map_url?: string | null
          notes?: string | null
          parent_appointment_id?: string | null
          patient_id?: string | null
          responsible_user_id: string
          scheduled_at: string
          specialty?: string | null
          status: string
          title: string
          type: string
          updated_at?: string | null
        }
        Update: {
          address?: string | null
          created_at?: string | null
          deleted_at?: string | null
          deleted_by?: string | null
          doctor_name?: string | null
          id?: string
          location?: string | null
          map_url?: string | null
          notes?: string | null
          parent_appointment_id?: string | null
          patient_id?: string | null
          responsible_user_id?: string
          scheduled_at?: string
          specialty?: string | null
          status?: string
          title?: string
          type?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "appointments_parent_appointment_id_fkey"
            columns: ["parent_appointment_id"]
            isOneToOne: false
            referencedRelation: "appointments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "appointments_patient_id_fkey"
            columns: ["patient_id"]
            isOneToOne: false
            referencedRelation: "patients"
            referencedColumns: ["id"]
          },
        ]
      }
      clinical_events: {
        Row: {
          appointment_id: string | null
          created_at: string | null
          created_by: string | null
          deleted_at: string | null
          deleted_by: string | null
          description: string | null
          doctor_name: string | null
          event_date: string
          id: string
          patient_id: string | null
          severity: string | null
          tags: string[] | null
          title: string
          type: string
          updated_at: string | null
        }
        Insert: {
          appointment_id?: string | null
          created_at?: string | null
          created_by?: string | null
          deleted_at?: string | null
          deleted_by?: string | null
          description?: string | null
          doctor_name?: string | null
          event_date: string
          id?: string
          patient_id?: string | null
          severity?: string | null
          tags?: string[] | null
          title: string
          type: string
          updated_at?: string | null
        }
        Update: {
          appointment_id?: string | null
          created_at?: string | null
          created_by?: string | null
          deleted_at?: string | null
          deleted_by?: string | null
          description?: string | null
          doctor_name?: string | null
          event_date?: string
          id?: string
          patient_id?: string | null
          severity?: string | null
          tags?: string[] | null
          title?: string
          type?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "clinical_events_appointment_id_fkey"
            columns: ["appointment_id"]
            isOneToOne: false
            referencedRelation: "appointments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "clinical_events_patient_id_fkey"
            columns: ["patient_id"]
            isOneToOne: false
            referencedRelation: "patients"
            referencedColumns: ["id"]
          },
        ]
      }
      documents: {
        Row: {
          ai_summary: string | null
          clinical_event_id: string | null
          created_at: string | null
          deleted_at: string | null
          deleted_by: string | null
          doctor_name: string | null
          document_date: string | null
          expiry_date: string | null
          file_mime_type: string | null
          file_path: string
          file_size_bytes: number | null
          id: string
          institution: string | null
          ocr_text: string | null
          patient_id: string | null
          search_vector: unknown
          tags: string[] | null
          title: string
          type: string
          updated_at: string | null
          uploaded_by: string | null
        }
        Insert: {
          ai_summary?: string | null
          clinical_event_id?: string | null
          created_at?: string | null
          deleted_at?: string | null
          deleted_by?: string | null
          doctor_name?: string | null
          document_date?: string | null
          expiry_date?: string | null
          file_mime_type?: string | null
          file_path: string
          file_size_bytes?: number | null
          id?: string
          institution?: string | null
          ocr_text?: string | null
          patient_id?: string | null
          search_vector?: unknown
          tags?: string[] | null
          title: string
          type: string
          updated_at?: string | null
          uploaded_by?: string | null
        }
        Update: {
          ai_summary?: string | null
          clinical_event_id?: string | null
          created_at?: string | null
          deleted_at?: string | null
          deleted_by?: string | null
          doctor_name?: string | null
          document_date?: string | null
          expiry_date?: string | null
          file_mime_type?: string | null
          file_path?: string
          file_size_bytes?: number | null
          id?: string
          institution?: string | null
          ocr_text?: string | null
          patient_id?: string | null
          search_vector?: unknown
          tags?: string[] | null
          title?: string
          type?: string
          updated_at?: string | null
          uploaded_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "documents_clinical_event_id_fkey"
            columns: ["clinical_event_id"]
            isOneToOne: false
            referencedRelation: "clinical_events"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "documents_patient_id_fkey"
            columns: ["patient_id"]
            isOneToOne: false
            referencedRelation: "patients"
            referencedColumns: ["id"]
          },
        ]
      }
      emergency_contacts: {
        Row: {
          created_at: string | null
          deleted_at: string | null
          deleted_by: string | null
          email: string | null
          id: string
          name: string
          patient_id: string | null
          phone: string | null
          priority: number | null
          relationship: string | null
        }
        Insert: {
          created_at?: string | null
          deleted_at?: string | null
          deleted_by?: string | null
          email?: string | null
          id?: string
          name: string
          patient_id?: string | null
          phone?: string | null
          priority?: number | null
          relationship?: string | null
        }
        Update: {
          created_at?: string | null
          deleted_at?: string | null
          deleted_by?: string | null
          email?: string | null
          id?: string
          name?: string
          patient_id?: string | null
          phone?: string | null
          priority?: number | null
          relationship?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "emergency_contacts_patient_id_fkey"
            columns: ["patient_id"]
            isOneToOne: false
            referencedRelation: "patients"
            referencedColumns: ["id"]
          },
        ]
      }
      emergency_links: {
        Row: {
          access_count: number | null
          created_at: string | null
          created_by: string | null
          expires_at: string | null
          id: string
          is_active: boolean | null
          patient_id: string | null
          token: string
        }
        Insert: {
          access_count?: number | null
          created_at?: string | null
          created_by?: string | null
          expires_at?: string | null
          id?: string
          is_active?: boolean | null
          patient_id?: string | null
          token?: string
        }
        Update: {
          access_count?: number | null
          created_at?: string | null
          created_by?: string | null
          expires_at?: string | null
          id?: string
          is_active?: boolean | null
          patient_id?: string | null
          token?: string
        }
        Relationships: [
          {
            foreignKeyName: "emergency_links_patient_id_fkey"
            columns: ["patient_id"]
            isOneToOne: false
            referencedRelation: "patients"
            referencedColumns: ["id"]
          },
        ]
      }
      emergency_rate_limits: {
        Row: {
          hits: number
          ip_address: string
          window_start: string
        }
        Insert: {
          hits?: number
          ip_address: string
          window_start: string
        }
        Update: {
          hits?: number
          ip_address?: string
          window_start?: string
        }
        Relationships: []
      }
      families: {
        Row: {
          created_at: string | null
          created_by: string | null
          id: string
          name: string
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          created_by?: string | null
          id?: string
          name: string
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          created_by?: string | null
          id?: string
          name?: string
          updated_at?: string | null
        }
        Relationships: []
      }
      family_members: {
        Row: {
          created_at: string | null
          family_id: string | null
          id: string
          invited_by: string | null
          role: string
          status: string
          updated_at: string | null
          user_id: string | null
        }
        Insert: {
          created_at?: string | null
          family_id?: string | null
          id?: string
          invited_by?: string | null
          role: string
          status: string
          updated_at?: string | null
          user_id?: string | null
        }
        Update: {
          created_at?: string | null
          family_id?: string | null
          id?: string
          invited_by?: string | null
          role?: string
          status?: string
          updated_at?: string | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "family_members_family_id_fkey"
            columns: ["family_id"]
            isOneToOne: false
            referencedRelation: "families"
            referencedColumns: ["id"]
          },
        ]
      }
      invitations: {
        Row: {
          created_at: string | null
          email: string | null
          expires_at: string
          family_id: string | null
          id: string
          invited_by: string | null
          role: string
          status: string
          token: string
        }
        Insert: {
          created_at?: string | null
          email?: string | null
          expires_at: string
          family_id?: string | null
          id?: string
          invited_by?: string | null
          role: string
          status: string
          token?: string
        }
        Update: {
          created_at?: string | null
          email?: string | null
          expires_at?: string
          family_id?: string | null
          id?: string
          invited_by?: string | null
          role?: string
          status?: string
          token?: string
        }
        Relationships: [
          {
            foreignKeyName: "invitations_family_id_fkey"
            columns: ["family_id"]
            isOneToOne: false
            referencedRelation: "families"
            referencedColumns: ["id"]
          },
        ]
      }
      medication_doses: {
        Row: {
          created_at: string
          id: string
          medication_id: string
          patient_id: string
          scheduled_at: string
          status: string
          taken_at: string
          taken_by: string | null
        }
        Insert: {
          created_at?: string
          id?: string
          medication_id: string
          patient_id: string
          scheduled_at: string
          status?: string
          taken_at?: string
          taken_by?: string | null
        }
        Update: {
          created_at?: string
          id?: string
          medication_id?: string
          patient_id?: string
          scheduled_at?: string
          status?: string
          taken_at?: string
          taken_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "medication_doses_medication_id_fkey"
            columns: ["medication_id"]
            isOneToOne: false
            referencedRelation: "medications"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "medication_doses_patient_id_fkey"
            columns: ["patient_id"]
            isOneToOne: false
            referencedRelation: "patients"
            referencedColumns: ["id"]
          },
        ]
      }
      medication_reminder_log: {
        Row: {
          id: string
          medication_id: string
          recipient_count: number
          scheduled_for: string
          sent_at: string
          status: string
        }
        Insert: {
          id?: string
          medication_id: string
          recipient_count?: number
          scheduled_for: string
          sent_at?: string
          status?: string
        }
        Update: {
          id?: string
          medication_id?: string
          recipient_count?: number
          scheduled_for?: string
          sent_at?: string
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "medication_reminder_log_medication_id_fkey"
            columns: ["medication_id"]
            isOneToOne: false
            referencedRelation: "medications"
            referencedColumns: ["id"]
          },
        ]
      }
      medications: {
        Row: {
          created_at: string | null
          deleted_at: string | null
          deleted_by: string | null
          dosage: string | null
          end_date: string | null
          file_path: string | null
          frequency: string | null
          generic_name: string | null
          id: string
          name: string
          notes: string | null
          patient_id: string | null
          prescribed_by: string | null
          schedule: Json | null
          start_date: string | null
          status: string
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          deleted_at?: string | null
          deleted_by?: string | null
          dosage?: string | null
          end_date?: string | null
          file_path?: string | null
          frequency?: string | null
          generic_name?: string | null
          id?: string
          name: string
          notes?: string | null
          patient_id?: string | null
          prescribed_by?: string | null
          schedule?: Json | null
          start_date?: string | null
          status: string
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          deleted_at?: string | null
          deleted_by?: string | null
          dosage?: string | null
          end_date?: string | null
          file_path?: string | null
          frequency?: string | null
          generic_name?: string | null
          id?: string
          name?: string
          notes?: string | null
          patient_id?: string | null
          prescribed_by?: string | null
          schedule?: Json | null
          start_date?: string | null
          status?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "medications_patient_id_fkey"
            columns: ["patient_id"]
            isOneToOne: false
            referencedRelation: "patients"
            referencedColumns: ["id"]
          },
        ]
      }
      patient_allergies: {
        Row: {
          allergy: string
          created_at: string | null
          deleted_at: string | null
          deleted_by: string | null
          id: string
          notes: string | null
          patient_id: string | null
          severity: string | null
        }
        Insert: {
          allergy: string
          created_at?: string | null
          deleted_at?: string | null
          deleted_by?: string | null
          id?: string
          notes?: string | null
          patient_id?: string | null
          severity?: string | null
        }
        Update: {
          allergy?: string
          created_at?: string | null
          deleted_at?: string | null
          deleted_by?: string | null
          id?: string
          notes?: string | null
          patient_id?: string | null
          severity?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "patient_allergies_patient_id_fkey"
            columns: ["patient_id"]
            isOneToOne: false
            referencedRelation: "patients"
            referencedColumns: ["id"]
          },
        ]
      }
      patient_conditions: {
        Row: {
          created_at: string | null
          deleted_at: string | null
          deleted_by: string | null
          description: string | null
          diagnosed_at: string | null
          id: string
          name: string
          patient_id: string | null
          status: string | null
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          deleted_at?: string | null
          deleted_by?: string | null
          description?: string | null
          diagnosed_at?: string | null
          id?: string
          name: string
          patient_id?: string | null
          status?: string | null
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          deleted_at?: string | null
          deleted_by?: string | null
          description?: string | null
          diagnosed_at?: string | null
          id?: string
          name?: string
          patient_id?: string | null
          status?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "patient_conditions_patient_id_fkey"
            columns: ["patient_id"]
            isOneToOne: false
            referencedRelation: "patients"
            referencedColumns: ["id"]
          },
        ]
      }
      patients: {
        Row: {
          birth_date: string | null
          blood_type: string | null
          created_at: string | null
          created_by: string | null
          deleted_at: string | null
          deleted_by: string | null
          family_id: string | null
          health_insurance_name: string | null
          health_insurance_number: string | null
          height: number | null
          id: string
          name: string
          notes: string | null
          photo_url: string | null
          preferred_hospital: string | null
          timezone: string
          updated_at: string | null
          weight: number | null
        }
        Insert: {
          birth_date?: string | null
          blood_type?: string | null
          created_at?: string | null
          created_by?: string | null
          deleted_at?: string | null
          deleted_by?: string | null
          family_id?: string | null
          health_insurance_name?: string | null
          health_insurance_number?: string | null
          height?: number | null
          id?: string
          name: string
          notes?: string | null
          photo_url?: string | null
          preferred_hospital?: string | null
          timezone?: string
          updated_at?: string | null
          weight?: number | null
        }
        Update: {
          birth_date?: string | null
          blood_type?: string | null
          created_at?: string | null
          created_by?: string | null
          deleted_at?: string | null
          deleted_by?: string | null
          family_id?: string | null
          health_insurance_name?: string | null
          health_insurance_number?: string | null
          height?: number | null
          id?: string
          name?: string
          notes?: string | null
          photo_url?: string | null
          preferred_hospital?: string | null
          timezone?: string
          updated_at?: string | null
          weight?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "patients_family_id_fkey"
            columns: ["family_id"]
            isOneToOne: false
            referencedRelation: "families"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          created_at: string | null
          full_name: string | null
          id: string
          onboarding_step: number | null
          phone: string | null
          photo_url: string | null
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          full_name?: string | null
          id: string
          onboarding_step?: number | null
          phone?: string | null
          photo_url?: string | null
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          full_name?: string | null
          id?: string
          onboarding_step?: number | null
          phone?: string | null
          photo_url?: string | null
          updated_at?: string | null
        }
        Relationships: []
      }
      push_subscriptions: {
        Row: {
          auth: string
          created_at: string
          disabled_at: string | null
          endpoint: string
          id: string
          last_seen_at: string
          p256dh: string
          user_agent: string | null
          user_id: string
        }
        Insert: {
          auth: string
          created_at?: string
          disabled_at?: string | null
          endpoint: string
          id?: string
          last_seen_at?: string
          p256dh: string
          user_agent?: string | null
          user_id: string
        }
        Update: {
          auth?: string
          created_at?: string
          disabled_at?: string | null
          endpoint?: string
          id?: string
          last_seen_at?: string
          p256dh?: string
          user_agent?: string | null
          user_id?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      get_solo_admin_families: {
        Args: { p_user_id: string }
        Returns: {
          family_id: string
        }[]
      }
      has_family_role: {
        Args: { fid: string; roles: string[] }
        Returns: boolean
      }
      is_family_member: { Args: { fid: string }; Returns: boolean }
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
