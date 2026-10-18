// Generated from the live Supabase schema (project blue-sky-school-sms).
// Regenerate after every migration: see src/lib/supabase/client.ts for usage.

export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  __InternalSupabase: {
    PostgrestVersion: "14.18"
  }
  public: {
    Tables: {
      academic_years: {
        Row: {
          created_at: string
          end_date: string
          id: string
          is_current: boolean
          label: string
          start_date: string
        }
        Insert: {
          created_at?: string
          end_date: string
          id?: string
          is_current?: boolean
          label: string
          start_date: string
        }
        Update: {
          created_at?: string
          end_date?: string
          id?: string
          is_current?: boolean
          label?: string
          start_date?: string
        }
        Relationships: []
      }
      classes: {
        Row: {
          academic_year_id: string
          created_at: string
          id: string
          name: string
          sort_order: number | null
        }
        Insert: {
          academic_year_id: string
          created_at?: string
          id?: string
          name: string
          sort_order?: number | null
        }
        Update: {
          academic_year_id?: string
          created_at?: string
          id?: string
          name?: string
          sort_order?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "classes_academic_year_id_fkey"
            columns: ["academic_year_id"]
            isOneToOne: false
            referencedRelation: "academic_years"
            referencedColumns: ["id"]
          },
        ]
      }
      fee_schedules: {
        Row: {
          amount_due_minor: number
          created_at: string
          fee_structure_id: string
          id: string
          period_month: string
          status: string
          student_id: string
        }
        Insert: {
          amount_due_minor: number
          created_at?: string
          fee_structure_id: string
          id?: string
          period_month: string
          status?: string
          student_id: string
        }
        Update: {
          amount_due_minor?: number
          created_at?: string
          fee_structure_id?: string
          id?: string
          period_month?: string
          status?: string
          student_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "fee_schedules_fee_structure_id_fkey"
            columns: ["fee_structure_id"]
            isOneToOne: false
            referencedRelation: "fee_structures"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fee_schedules_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "students"
            referencedColumns: ["id"]
          },
        ]
      }
      fee_structures: {
        Row: {
          academic_year_id: string
          amount_minor: number
          class_id: string
          created_at: string
          id: string
          name: string
        }
        Insert: {
          academic_year_id: string
          amount_minor: number
          class_id: string
          created_at?: string
          id?: string
          name: string
        }
        Update: {
          academic_year_id?: string
          amount_minor?: number
          class_id?: string
          created_at?: string
          id?: string
          name?: string
        }
        Relationships: [
          {
            foreignKeyName: "fee_structures_academic_year_id_fkey"
            columns: ["academic_year_id"]
            isOneToOne: false
            referencedRelation: "academic_years"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fee_structures_class_id_fkey"
            columns: ["class_id"]
            isOneToOne: false
            referencedRelation: "classes"
            referencedColumns: ["id"]
          },
        ]
      }
      guardians: {
        Row: {
          created_at: string
          email: string | null
          full_name: string
          id: string
          phone: string | null
          relation: string | null
        }
        Insert: {
          created_at?: string
          email?: string | null
          full_name: string
          id?: string
          phone?: string | null
          relation?: string | null
        }
        Update: {
          created_at?: string
          email?: string | null
          full_name?: string
          id?: string
          phone?: string | null
          relation?: string | null
        }
        Relationships: []
      }
      payment_allocations: {
        Row: {
          allocated_amount_minor: number
          created_at: string
          fee_schedule_id: string
          id: string
          payment_id: string
        }
        Insert: {
          allocated_amount_minor: number
          created_at?: string
          fee_schedule_id: string
          id?: string
          payment_id: string
        }
        Update: {
          allocated_amount_minor?: number
          created_at?: string
          fee_schedule_id?: string
          id?: string
          payment_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "payment_allocations_fee_schedule_id_fkey"
            columns: ["fee_schedule_id"]
            isOneToOne: false
            referencedRelation: "fee_schedules"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payment_allocations_payment_id_fkey"
            columns: ["payment_id"]
            isOneToOne: false
            referencedRelation: "payments"
            referencedColumns: ["id"]
          },
        ]
      }
      payments: {
        Row: {
          amount_minor: number
          created_at: string
          id: string
          idempotency_key: string
          is_refund: boolean
          method: string
          receipt_number: string
          received_at: string
          received_by: string
          reference_note: string | null
          student_id: string
        }
        Insert: {
          amount_minor: number
          created_at?: string
          id?: string
          idempotency_key: string
          is_refund?: boolean
          method: string
          receipt_number: string
          received_at?: string
          received_by: string
          reference_note?: string | null
          student_id: string
        }
        Update: {
          amount_minor?: number
          created_at?: string
          id?: string
          idempotency_key?: string
          is_refund?: boolean
          method?: string
          receipt_number?: string
          received_at?: string
          received_by?: string
          reference_note?: string | null
          student_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "payments_received_by_fkey"
            columns: ["received_by"]
            isOneToOne: false
            referencedRelation: "staff"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payments_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "students"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          created_at: string
          email: string | null
          full_name: string
          id: string
          is_active: boolean
          phone: string | null
        }
        Insert: {
          created_at?: string
          email?: string | null
          full_name?: string
          id: string
          is_active?: boolean
          phone?: string | null
        }
        Update: {
          created_at?: string
          email?: string | null
          full_name?: string
          id?: string
          is_active?: boolean
          phone?: string | null
        }
        Relationships: []
      }
      refund_allocations: {
        Row: {
          amount_minor: number
          created_at: string
          fee_schedule_id: string
          id: string
          refund_id: string
        }
        Insert: {
          amount_minor: number
          created_at?: string
          fee_schedule_id: string
          id?: string
          refund_id: string
        }
        Update: {
          amount_minor?: number
          created_at?: string
          fee_schedule_id?: string
          id?: string
          refund_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "refund_allocations_fee_schedule_id_fkey"
            columns: ["fee_schedule_id"]
            isOneToOne: false
            referencedRelation: "fee_schedules"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "refund_allocations_refund_id_fkey"
            columns: ["refund_id"]
            isOneToOne: false
            referencedRelation: "refunds"
            referencedColumns: ["id"]
          },
        ]
      }
      refunds: {
        Row: {
          created_at: string
          id: string
          original_payment_id: string
          processed_by: string
          reason: string
          refund_payment_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          original_payment_id: string
          processed_by: string
          reason: string
          refund_payment_id: string
        }
        Update: {
          created_at?: string
          id?: string
          original_payment_id?: string
          processed_by?: string
          reason?: string
          refund_payment_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "refunds_original_payment_id_fkey"
            columns: ["original_payment_id"]
            isOneToOne: false
            referencedRelation: "payments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "refunds_processed_by_fkey"
            columns: ["processed_by"]
            isOneToOne: false
            referencedRelation: "staff"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "refunds_refund_payment_id_fkey"
            columns: ["refund_payment_id"]
            isOneToOne: false
            referencedRelation: "payments"
            referencedColumns: ["id"]
          },
        ]
      }
      sections: {
        Row: {
          class_id: string
          class_teacher_staff_id: string | null
          created_at: string
          id: string
          name: string
        }
        Insert: {
          class_id: string
          class_teacher_staff_id?: string | null
          created_at?: string
          id?: string
          name: string
        }
        Update: {
          class_id?: string
          class_teacher_staff_id?: string | null
          created_at?: string
          id?: string
          name?: string
        }
        Relationships: [
          {
            foreignKeyName: "sections_class_id_fkey"
            columns: ["class_id"]
            isOneToOne: false
            referencedRelation: "classes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sections_class_teacher_staff_id_fkey"
            columns: ["class_teacher_staff_id"]
            isOneToOne: false
            referencedRelation: "staff"
            referencedColumns: ["id"]
          },
        ]
      }
      staff: {
        Row: {
          created_at: string
          date_joined: string | null
          designation: string | null
          id: string
          is_active: boolean
          profile_id: string
          staff_code: string | null
        }
        Insert: {
          created_at?: string
          date_joined?: string | null
          designation?: string | null
          id?: string
          is_active?: boolean
          profile_id: string
          staff_code?: string | null
        }
        Update: {
          created_at?: string
          date_joined?: string | null
          designation?: string | null
          id?: string
          is_active?: boolean
          profile_id?: string
          staff_code?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "staff_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: true
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      student_guardians: {
        Row: {
          created_at: string
          guardian_id: string
          id: string
          is_primary: boolean
          student_id: string
        }
        Insert: {
          created_at?: string
          guardian_id: string
          id?: string
          is_primary?: boolean
          student_id: string
        }
        Update: {
          created_at?: string
          guardian_id?: string
          id?: string
          is_primary?: boolean
          student_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "student_guardians_guardian_id_fkey"
            columns: ["guardian_id"]
            isOneToOne: false
            referencedRelation: "guardians"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "student_guardians_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "students"
            referencedColumns: ["id"]
          },
        ]
      }
      student_section_history: {
        Row: {
          created_at: string
          effective_from: string
          effective_to: string | null
          id: string
          section_id: string
          student_id: string
        }
        Insert: {
          created_at?: string
          effective_from: string
          effective_to?: string | null
          id?: string
          section_id: string
          student_id: string
        }
        Update: {
          created_at?: string
          effective_from?: string
          effective_to?: string | null
          id?: string
          section_id?: string
          student_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "student_section_history_section_id_fkey"
            columns: ["section_id"]
            isOneToOne: false
            referencedRelation: "sections"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "student_section_history_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "students"
            referencedColumns: ["id"]
          },
        ]
      }
      students: {
        Row: {
          academic_year_id: string
          admission_date: string | null
          admission_no: string
          created_at: string
          current_section_id: string
          dob: string | null
          full_name: string
          gender: string | null
          id: string
          status: string
        }
        Insert: {
          academic_year_id: string
          admission_date?: string | null
          admission_no: string
          created_at?: string
          current_section_id: string
          dob?: string | null
          full_name: string
          gender?: string | null
          id?: string
          status?: string
        }
        Update: {
          academic_year_id?: string
          admission_date?: string | null
          admission_no?: string
          created_at?: string
          current_section_id?: string
          dob?: string | null
          full_name?: string
          gender?: string | null
          id?: string
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "students_academic_year_id_fkey"
            columns: ["academic_year_id"]
            isOneToOne: false
            referencedRelation: "academic_years"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "students_current_section_id_fkey"
            columns: ["current_section_id"]
            isOneToOne: false
            referencedRelation: "sections"
            referencedColumns: ["id"]
          },
        ]
      }
      subjects: {
        Row: {
          academic_year_id: string
          code: string | null
          created_at: string
          id: string
          name: string
        }
        Insert: {
          academic_year_id: string
          code?: string | null
          created_at?: string
          id?: string
          name: string
        }
        Update: {
          academic_year_id?: string
          code?: string | null
          created_at?: string
          id?: string
          name?: string
        }
        Relationships: [
          {
            foreignKeyName: "subjects_academic_year_id_fkey"
            columns: ["academic_year_id"]
            isOneToOne: false
            referencedRelation: "academic_years"
            referencedColumns: ["id"]
          },
        ]
      }
      teacher_subject_assignments: {
        Row: {
          academic_year_id: string
          created_at: string
          effective_from: string
          effective_to: string | null
          id: string
          section_id: string
          subject_id: string
          teacher_staff_id: string
        }
        Insert: {
          academic_year_id: string
          created_at?: string
          effective_from?: string
          effective_to?: string | null
          id?: string
          section_id: string
          subject_id: string
          teacher_staff_id: string
        }
        Update: {
          academic_year_id?: string
          created_at?: string
          effective_from?: string
          effective_to?: string | null
          id?: string
          section_id?: string
          subject_id?: string
          teacher_staff_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "teacher_subject_assignments_academic_year_id_fkey"
            columns: ["academic_year_id"]
            isOneToOne: false
            referencedRelation: "academic_years"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "teacher_subject_assignments_section_id_fkey"
            columns: ["section_id"]
            isOneToOne: false
            referencedRelation: "sections"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "teacher_subject_assignments_subject_id_fkey"
            columns: ["subject_id"]
            isOneToOne: false
            referencedRelation: "subjects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "teacher_subject_assignments_teacher_staff_id_fkey"
            columns: ["teacher_staff_id"]
            isOneToOne: false
            referencedRelation: "staff"
            referencedColumns: ["id"]
          },
        ]
      }
      user_roles: {
        Row: {
          created_at: string
          id: string
          role: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          role: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          role?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_roles_profile_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      teacher_roster: {
        Row: {
          admission_no: string | null
          class_name: string | null
          full_name: string | null
          section_id: string | null
          section_name: string | null
          student_id: string | null
          subject_id: string | null
          subject_name: string | null
          teacher_staff_id: string | null
        }
        Relationships: [
          {
            foreignKeyName: "teacher_subject_assignments_section_id_fkey"
            columns: ["section_id"]
            isOneToOne: false
            referencedRelation: "sections"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "teacher_subject_assignments_subject_id_fkey"
            columns: ["subject_id"]
            isOneToOne: false
            referencedRelation: "subjects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "teacher_subject_assignments_teacher_staff_id_fkey"
            columns: ["teacher_staff_id"]
            isOneToOne: false
            referencedRelation: "staff"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Functions: {
      assign_role: {
        Args: { new_role: string; target_user_id: string }
        Returns: undefined
      }
      auth_has_role: { Args: { required_role: string }; Returns: boolean }
      current_staff_id: { Args: never; Returns: string }
      generate_monthly_fee_schedules: {
        Args: { p_academic_year_id: string; p_period_month: string }
        Returns: number
      }
      issue_refund: {
        Args: {
          p_idempotency_key: string
          p_payment_id: string
          p_reason: string
        }
        Returns: {
          refund_id: string
          refund_receipt_number: string
        }[]
      }
      recompute_fee_schedule_status: {
        Args: { p_fee_schedule_id: string }
        Returns: undefined
      }
      record_payment: {
        Args: {
          p_allocations: Json
          p_amount_minor: number
          p_idempotency_key: string
          p_method: string
          p_reference_note: string
          p_student_id: string
        }
        Returns: {
          payment_id: string
          receipt_number: string
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never) = never,
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
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
  EnumName extends (DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never) = never,
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
  CompositeTypeName extends (PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never) = never,
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
