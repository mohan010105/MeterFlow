export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  public: {
    Tables: {
      profiles: {
        Row: {
          id: string
          name: string | null
          email: string | null
          role: string | null
          plan: string | null
          created_at: string
        }
        Insert: {
          id: string
          name?: string | null
          email?: string | null
          role?: string | null
          plan?: string | null
          created_at?: string
        }
        Update: {
          id?: string
          name?: string | null
          email?: string | null
          role?: string | null
          plan?: string | null
          created_at?: string
        }
        Relationships: []
      }
      usage_logs: {
        Row: {
          id: string
          api_key_id: string | null
          api_id: string | null
          endpoint: string | null
          method: string | null
          status_code: number | null
          latency_ms: number | null
          ip: string | null
          created_at: string
        }
        Insert: {
          id?: string
          api_key_id?: string | null
          api_id?: string | null
          endpoint?: string | null
          method?: string | null
          status_code?: number | null
          latency_ms?: number | null
          ip?: string | null
          created_at?: string
        }
        Update: {
          id?: string
          api_key_id?: string | null
          api_id?: string | null
          endpoint?: string | null
          method?: string | null
          status_code?: number | null
          latency_ms?: number | null
          ip?: string | null
          created_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "usage_logs_api_id_fkey"
            columns: ["api_id"]
            referencedRelation: "apis"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "usage_logs_api_key_id_fkey"
            columns: ["api_key_id"]
            referencedRelation: "api_keys"
            referencedColumns: ["id"]
          }
        ]
      }
      invoices: {
        Row: {
          id: string
          user_id: string
          month: string | null
          requests: number | null
          amount: number | null
          status: string | null
          created_at: string
        }
        Insert: {
          id?: string
          user_id: string
          month?: string | null
          requests?: number | null
          amount?: number | null
          status?: string | null
          created_at?: string
        }
        Update: {
          id?: string
          user_id?: string
          month?: string | null
          requests?: number | null
          amount?: number | null
          status?: string | null
          created_at?: string
        }
        Relationships: []
      }
      apis: {
        Row: {
          id: string
          owner_id: string | null
          name: string
          base_url: string | null
          description: string | null
          status: string | null
          created_at: string
          user_id: string | null
        }
        Insert: {
          id?: string
          owner_id?: string | null
          name: string
          base_url?: string | null
          description?: string | null
          status?: string | null
          created_at?: string
          user_id?: string | null
        }
        Update: {
          id?: string
          owner_id?: string | null
          name?: string
          base_url?: string | null
          description?: string | null
          status?: string | null
          created_at?: string
          user_id?: string | null
        }
        Relationships: []
      }
      api_keys: {
        Row: {
          id: string
          api_id: string
          user_id: string | null
          key_hash: string
          prefix: string | null
          status: string | null
          environment: string | null
          created_at: string
          expires_at: string | null
          name: string | null
        }
        Insert: {
          id?: string
          api_id: string
          user_id?: string | null
          key_hash: string
          prefix?: string | null
          status?: string | null
          environment?: string | null
          created_at?: string
          expires_at?: string | null
          name?: string | null
        }
        Update: {
          id?: string
          api_id?: string
          user_id?: string | null
          key_hash?: string
          prefix?: string | null
          status?: string | null
          environment?: string | null
          created_at?: string
          expires_at?: string | null
          name?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "api_keys_api_id_fkey"
            columns: ["api_id"]
            referencedRelation: "apis"
            referencedColumns: ["id"]
          }
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      [_ in never]: never
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}
