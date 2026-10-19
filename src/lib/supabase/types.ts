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
      audit_log: {
        Row: {
          action: string
          actor_profile_id: string | null
          after_data: Json | null
          before_data: Json | null
          created_at: string
          entity_id: string
          entity_type: string
          id: string
        }
        Insert: {
          action: string
          actor_profile_id?: string | null
          after_data?: Json | null
          before_data?: Json | null
          created_at?: string
          entity_id: string
          entity_type: string
          id?: string
        }
        Update: {
          action?: string
          actor_profile_id?: string | null
          after_data?: Json | null
          before_data?: Json | null
          created_at?: string
          entity_id?: string
          entity_type?: string
          id?: string
        }
        Relationships: [
          {
            foreignKeyName: "audit_log_actor_profile_id_fkey"
            columns: ["actor_profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
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
      exam_terms: {
        Row: {
          academic_year_id: string
          created_at: string
          id: string
          name: string
          sort_order: number | null
          status: string
        }
        Insert: {
          academic_year_id: string
          created_at?: string
          id?: string
          name: string
          sort_order?: number | null
          status?: string
        }
        Update: {
          academic_year_id?: string
          created_at?: string
          id?: string
          name?: string
          sort_order?: number | null
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "exam_terms_academic_year_id_fkey"
            columns: ["academic_year_id"]
            isOneToOne: false
            referencedRelation: "academic_years"
            referencedColumns: ["id"]
          },
        ]
      }
      expense_categories: {
        Row: { created_at: string; id: string; name: string }
        Insert: { created_at?: string; id?: string; name: string }
        Update: { created_at?: string; id?: string; name?: string }
        Relationships: []
      }
      expenses: {
        Row: {
          amount_minor: number
          category_id: string
          created_at: string
          description: string | null
          id: string
          incurred_on: string
          receipt_ref: string | null
          recorded_by: string
        }
        Insert: {
          amount_minor: number
          category_id: string
          created_at?: string
          description?: string | null
          id?: string
          incurred_on: string
          receipt_ref?: string | null
          recorded_by: string
        }
        Update: {
          amount_minor?: number
          category_id?: string
          created_at?: string
          description?: string | null
          id?: string
          incurred_on?: string
          receipt_ref?: string | null
          recorded_by?: string
        }
        Relationships: [
          {
            foreignKeyName: "expenses_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "expense_categories"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "expenses_recorded_by_fkey"
            columns: ["recorded_by"]
            isOneToOne: false
            referencedRelation: "staff"
            referencedColumns: ["id"]
          },
        ]
      }
      export_requests: {
        Row: {
          completed_at: string | null
          export_type: string
          filters: Json | null
          id: string
          requested_at: string
          requested_by: string
          row_count: number | null
        }
        Insert: {
          completed_at?: string | null
          export_type: string
          filters?: Json | null
          id?: string
          requested_at?: string
          requested_by: string
          row_count?: number | null
        }
        Update: {
          completed_at?: string | null
          export_type?: string
          filters?: Json | null
          id?: string
          requested_at?: string
          requested_by?: string
          row_count?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "export_requests_requested_by_fkey"
            columns: ["requested_by"]
            isOneToOne: false
            referencedRelation: "staff"
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
      grade_scale: {
        Row: {
          academic_year_id: string
          created_at: string
          grade_label: string
          id: string
          max_percent: number
          min_percent: number
          remark: string | null
        }
        Insert: {
          academic_year_id: string
          created_at?: string
          grade_label: string
          id?: string
          max_percent: number
          min_percent: number
          remark?: string | null
        }
        Update: {
          academic_year_id?: string
          created_at?: string
          grade_label?: string
          id?: string
          max_percent?: number
          min_percent?: number
          remark?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "grade_scale_academic_year_id_fkey"
            columns: ["academic_year_id"]
            isOneToOne: false
            referencedRelation: "academic_years"
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
      marks: {
        Row: {
          entered_at: string
          entered_by: string
          exam_term_id: string
          id: string
          max_score: number
          raw_score: number
          section_id: string
          student_id: string
          subject_id: string
          updated_at: string | null
          updated_by: string | null
        }
        Insert: {
          entered_at?: string
          entered_by: string
          exam_term_id: string
          id?: string
          max_score: number
          raw_score: number
          section_id: string
          student_id: string
          subject_id: string
          updated_at?: string | null
          updated_by?: string | null
        }
        Update: {
          entered_at?: string
          entered_by?: string
          exam_term_id?: string
          id?: string
          max_score?: number
          raw_score?: number
          section_id?: string
          student_id?: string
          subject_id?: string
          updated_at?: string | null
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "marks_entered_by_fkey"
            columns: ["entered_by"]
            isOneToOne: false
            referencedRelation: "staff"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "marks_exam_term_id_fkey"
            columns: ["exam_term_id"]
            isOneToOne: false
            referencedRelation: "exam_terms"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "marks_section_id_fkey"
            columns: ["section_id"]
            isOneToOne: false
            referencedRelation: "sections"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "marks_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "students"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "marks_subject_id_fkey"
            columns: ["subject_id"]
            isOneToOne: false
            referencedRelation: "subjects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "marks_updated_by_fkey"
            columns: ["updated_by"]
            isOneToOne: false
            referencedRelation: "staff"
            referencedColumns: ["id"]
          },
        ]
      }
      marks_audit: {
        Row: {
          change_type: string
          changed_at: string
          changed_by: string
          exam_term_id: string
          id: string
          mark_id: string
          max_score: number
          raw_score: number
          student_id: string
          subject_id: string
        }
        Insert: {
          change_type: string
          changed_at?: string
          changed_by: string
          exam_term_id: string
          id?: string
          mark_id: string
          max_score: number
          raw_score: number
          student_id: string
          subject_id: string
        }
        Update: {
          change_type?: string
          changed_at?: string
          changed_by?: string
          exam_term_id?: string
          id?: string
          mark_id?: string
          max_score?: number
          raw_score?: number
          student_id?: string
          subject_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "marks_audit_changed_by_fkey"
            columns: ["changed_by"]
            isOneToOne: false
            referencedRelation: "staff"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "marks_audit_mark_id_fkey"
            columns: ["mark_id"]
            isOneToOne: false
            referencedRelation: "marks"
            referencedColumns: ["id"]
          },
        ]
      }
      staff_invitations: {
        Row: {
          accepted_at: string | null
          created_at: string
          designation: string | null
          email: string
          id: string
          invited_by: string
          role: string
          status: string
        }
        Insert: {
          accepted_at?: string | null
          created_at?: string
          designation?: string | null
          email: string
          id?: string
          invited_by: string
          role: string
          status?: string
        }
        Update: {
          accepted_at?: string | null
          created_at?: string
          designation?: string | null
          email?: string
          id?: string
          invited_by?: string
          role?: string
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "staff_invitations_invited_by_fkey"
            columns: ["invited_by"]
            isOneToOne: false
            referencedRelation: "staff"
            referencedColumns: ["id"]
          },
        ]
      }
      parent_student_links: {
        Row: {
          id: string
          parent_id: string
          requested_at: string
          student_id: string
          verification_method: string
          verification_status: string
          verified_at: string | null
          verified_by: string | null
        }
        Insert: {
          id?: string
          parent_id: string
          requested_at?: string
          student_id: string
          verification_method?: string
          verification_status?: string
          verified_at?: string | null
          verified_by?: string | null
        }
        Update: {
          id?: string
          parent_id?: string
          requested_at?: string
          student_id?: string
          verification_method?: string
          verification_status?: string
          verified_at?: string | null
          verified_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "parent_student_links_parent_id_fkey"
            columns: ["parent_id"]
            isOneToOne: false
            referencedRelation: "parents"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "parent_student_links_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "students"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "parent_student_links_verified_by_fkey"
            columns: ["verified_by"]
            isOneToOne: false
            referencedRelation: "staff"
            referencedColumns: ["id"]
          },
        ]
      }
      parents: {
        Row: {
          created_at: string
          email: string | null
          id: string
          phone: string | null
          profile_id: string
        }
        Insert: {
          created_at?: string
          email?: string | null
          id?: string
          phone?: string | null
          profile_id: string
        }
        Update: {
          created_at?: string
          email?: string | null
          id?: string
          phone?: string | null
          profile_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "parents_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: true
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
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
      payroll_runs: {
        Row: {
          created_at: string
          finalized_at: string | null
          generated_by: string
          id: string
          period_month: string
          status: string
        }
        Insert: {
          created_at?: string
          finalized_at?: string | null
          generated_by: string
          id?: string
          period_month: string
          status?: string
        }
        Update: {
          created_at?: string
          finalized_at?: string | null
          generated_by?: string
          id?: string
          period_month?: string
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "payroll_runs_generated_by_fkey"
            columns: ["generated_by"]
            isOneToOne: false
            referencedRelation: "staff"
            referencedColumns: ["id"]
          },
        ]
      }
      payslips: {
        Row: {
          adjustments_total_minor: number
          base_amount_minor: number
          created_at: string
          id: string
          net_amount_minor: number
          paid_at: string | null
          payment_method: string | null
          payroll_run_id: string
          staff_id: string
        }
        Insert: {
          adjustments_total_minor?: number
          base_amount_minor: number
          created_at?: string
          id?: string
          net_amount_minor: number
          paid_at?: string | null
          payment_method?: string | null
          payroll_run_id: string
          staff_id: string
        }
        Update: {
          adjustments_total_minor?: number
          base_amount_minor?: number
          created_at?: string
          id?: string
          net_amount_minor?: number
          paid_at?: string | null
          payment_method?: string | null
          payroll_run_id?: string
          staff_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "payslips_payroll_run_id_fkey"
            columns: ["payroll_run_id"]
            isOneToOne: false
            referencedRelation: "payroll_runs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payslips_staff_id_fkey"
            columns: ["staff_id"]
            isOneToOne: false
            referencedRelation: "staff"
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
      results: {
        Row: {
          approved_at: string | null
          approved_by: string | null
          created_at: string
          exam_term_id: string
          id: string
          overall_grade: string | null
          percentage: number | null
          published_at: string | null
          rejection_reason: string | null
          status: string
          student_id: string
          total_max: number | null
          total_obtained: number | null
          version: number
        }
        Insert: {
          approved_at?: string | null
          approved_by?: string | null
          created_at?: string
          exam_term_id: string
          id?: string
          overall_grade?: string | null
          percentage?: number | null
          published_at?: string | null
          rejection_reason?: string | null
          status?: string
          student_id: string
          total_max?: number | null
          total_obtained?: number | null
          version?: number
        }
        Update: {
          approved_at?: string | null
          approved_by?: string | null
          created_at?: string
          exam_term_id?: string
          id?: string
          overall_grade?: string | null
          percentage?: number | null
          published_at?: string | null
          rejection_reason?: string | null
          status?: string
          student_id?: string
          total_max?: number | null
          total_obtained?: number | null
          version?: number
        }
        Relationships: [
          {
            foreignKeyName: "results_approved_by_fkey"
            columns: ["approved_by"]
            isOneToOne: false
            referencedRelation: "staff"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "results_exam_term_id_fkey"
            columns: ["exam_term_id"]
            isOneToOne: false
            referencedRelation: "exam_terms"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "results_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "students"
            referencedColumns: ["id"]
          },
        ]
      }
      results_audit: {
        Row: {
          changed_at: string
          changed_by: string
          id: string
          new_status: string
          note: string | null
          old_status: string | null
          result_id: string
        }
        Insert: {
          changed_at?: string
          changed_by: string
          id?: string
          new_status: string
          note?: string | null
          old_status?: string | null
          result_id: string
        }
        Update: {
          changed_at?: string
          changed_by?: string
          id?: string
          new_status?: string
          note?: string | null
          old_status?: string | null
          result_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "results_audit_changed_by_fkey"
            columns: ["changed_by"]
            isOneToOne: false
            referencedRelation: "staff"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "results_audit_result_id_fkey"
            columns: ["result_id"]
            isOneToOne: false
            referencedRelation: "results"
            referencedColumns: ["id"]
          },
        ]
      }
      salary_adjustments: {
        Row: {
          amount_minor: number
          created_at: string
          created_by: string
          id: string
          idempotency_key: string | null
          kind: string
          payroll_run_id: string
          reason: string
          staff_id: string
        }
        Insert: {
          amount_minor: number
          created_at?: string
          created_by: string
          id?: string
          idempotency_key?: string | null
          kind: string
          payroll_run_id: string
          reason: string
          staff_id: string
        }
        Update: {
          amount_minor?: number
          created_at?: string
          created_by?: string
          id?: string
          idempotency_key?: string | null
          kind?: string
          payroll_run_id?: string
          reason?: string
          staff_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "salary_adjustments_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "staff"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "salary_adjustments_payroll_run_id_fkey"
            columns: ["payroll_run_id"]
            isOneToOne: false
            referencedRelation: "payroll_runs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "salary_adjustments_staff_id_fkey"
            columns: ["staff_id"]
            isOneToOne: false
            referencedRelation: "staff"
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
      staff_salaries: {
        Row: {
          created_at: string
          effective_from: string
          effective_to: string | null
          id: string
          monthly_amount_minor: number
          staff_id: string
        }
        Insert: {
          created_at?: string
          effective_from?: string
          effective_to?: string | null
          id?: string
          monthly_amount_minor: number
          staff_id: string
        }
        Update: {
          created_at?: string
          effective_from?: string
          effective_to?: string | null
          id?: string
          monthly_amount_minor?: number
          staff_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "staff_salaries_staff_id_fkey"
            columns: ["staff_id"]
            isOneToOne: false
            referencedRelation: "staff"
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
      add_salary_adjustment: {
        Args: {
          p_amount_minor: number
          p_idempotency_key: string
          p_kind: string
          p_payroll_run_id: string
          p_reason: string
          p_staff_id: string
        }
        Returns: undefined
      }
      approve_results: { Args: { p_result_ids: string[] }; Returns: number }
      assign_role: {
        Args: { new_role: string; target_user_id: string }
        Returns: undefined
      }
      revoke_role: {
        Args: { p_role: string; p_user_id: string }
        Returns: undefined
      }
      invite_staff: {
        Args: { p_designation?: string; p_email: string; p_role: string }
        Returns: string
      }
      revoke_invitation: {
        Args: { p_invitation_id: string }
        Returns: undefined
      }
      revoke_parent_link: {
        Args: { p_link_id: string }
        Returns: undefined
      }
      auth_has_role: { Args: { required_role: string }; Returns: boolean }
      complete_export: {
        Args: { p_export_request_id: string; p_row_count: number }
        Returns: undefined
      }
      compute_results: { Args: { p_exam_term_id: string }; Returns: number }
      current_staff_id: { Args: never; Returns: string }
      finalize_payroll_run: {
        Args: { p_payroll_run_id: string }
        Returns: undefined
      }
      is_verified_parent_of: { Args: { p_student_id: string }; Returns: boolean }
      request_student_link: {
        Args: { p_admission_no: string; p_child_full_name: string }
        Returns: undefined
      }
      review_link_request: {
        Args: { p_decision: string; p_link_id: string }
        Returns: undefined
      }
      generate_monthly_fee_schedules: {
        Args: { p_academic_year_id: string; p_period_month: string }
        Returns: number
      }
      generate_payroll_run: {
        Args: { p_period_month: string }
        Returns: string
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
      mark_payslip_paid: {
        Args: { p_payment_method: string; p_payslip_id: string }
        Returns: undefined
      }
      publish_results: { Args: { p_result_ids: string[] }; Returns: number }
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
      reject_results: {
        Args: { p_reason: string; p_result_ids: string[] }
        Returns: number
      }
      reopen_for_correction: {
        Args: { p_reason: string; p_result_id: string }
        Returns: undefined
      }
      request_export: {
        Args: { p_export_type: string; p_filters: Json }
        Returns: string
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
