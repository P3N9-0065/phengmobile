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
      customers: {
        Row: {
          address: string | null
          created_at: string
          email: string | null
          id: string
          name: string
          notes: string | null
          phone: string
          points: number
          updated_at: string
        }
        Insert: {
          address?: string | null
          created_at?: string
          email?: string | null
          id?: string
          name: string
          notes?: string | null
          phone: string
          points?: number
          updated_at?: string
        }
        Update: {
          address?: string | null
          created_at?: string
          email?: string | null
          id?: string
          name?: string
          notes?: string | null
          phone?: string
          points?: number
          updated_at?: string
        }
        Relationships: []
      }
      devices: {
        Row: {
          brand: string
          color: string | null
          created_at: string
          customer_id: string | null
          id: string
          imei: string | null
          model: string
          notes: string | null
        }
        Insert: {
          brand: string
          color?: string | null
          created_at?: string
          customer_id?: string | null
          id?: string
          imei?: string | null
          model: string
          notes?: string | null
        }
        Update: {
          brand?: string
          color?: string | null
          created_at?: string
          customer_id?: string | null
          id?: string
          imei?: string | null
          model?: string
          notes?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "devices_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
        ]
      }
      inventory_items: {
        Row: {
          category: Database["public"]["Enums"]["item_category"]
          cost_price: number
          created_at: string
          description: string | null
          id: string
          low_stock_threshold: number
          name: string
          sell_price: number
          sku: string | null
          stock_qty: number
          updated_at: string
        }
        Insert: {
          category?: Database["public"]["Enums"]["item_category"]
          cost_price?: number
          created_at?: string
          description?: string | null
          id?: string
          low_stock_threshold?: number
          name: string
          sell_price?: number
          sku?: string | null
          stock_qty?: number
          updated_at?: string
        }
        Update: {
          category?: Database["public"]["Enums"]["item_category"]
          cost_price?: number
          created_at?: string
          description?: string | null
          id?: string
          low_stock_threshold?: number
          name?: string
          sell_price?: number
          sku?: string | null
          stock_qty?: number
          updated_at?: string
        }
        Relationships: []
      }
      profiles: {
        Row: {
          created_at: string
          full_name: string
          id: string
          phone: string | null
        }
        Insert: {
          created_at?: string
          full_name?: string
          id: string
          phone?: string | null
        }
        Update: {
          created_at?: string
          full_name?: string
          id?: string
          phone?: string | null
        }
        Relationships: []
      }
      repair_parts_used: {
        Row: {
          created_at: string
          created_by: string | null
          id: string
          item_id: string
          qty: number
          ticket_id: string
          unit_cost: number
          unit_price: number
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          id?: string
          item_id: string
          qty: number
          ticket_id: string
          unit_cost?: number
          unit_price?: number
        }
        Update: {
          created_at?: string
          created_by?: string | null
          id?: string
          item_id?: string
          qty?: number
          ticket_id?: string
          unit_cost?: number
          unit_price?: number
        }
        Relationships: [
          {
            foreignKeyName: "repair_parts_used_item_id_fkey"
            columns: ["item_id"]
            isOneToOne: false
            referencedRelation: "inventory_items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "repair_parts_used_ticket_id_fkey"
            columns: ["ticket_id"]
            isOneToOne: false
            referencedRelation: "repair_tickets"
            referencedColumns: ["id"]
          },
        ]
      }
      repair_status_history: {
        Row: {
          changed_at: string
          changed_by: string | null
          id: string
          note: string | null
          status: Database["public"]["Enums"]["repair_status"]
          ticket_id: string
        }
        Insert: {
          changed_at?: string
          changed_by?: string | null
          id?: string
          note?: string | null
          status: Database["public"]["Enums"]["repair_status"]
          ticket_id: string
        }
        Update: {
          changed_at?: string
          changed_by?: string | null
          id?: string
          note?: string | null
          status?: Database["public"]["Enums"]["repair_status"]
          ticket_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "repair_status_history_ticket_id_fkey"
            columns: ["ticket_id"]
            isOneToOne: false
            referencedRelation: "repair_tickets"
            referencedColumns: ["id"]
          },
        ]
      }
      repair_tickets: {
        Row: {
          accessories: string[] | null
          created_at: string
          created_by: string | null
          customer_id: string
          device_brand: string
          device_color: string | null
          device_imei: string | null
          device_model: string
          estimated_price: number | null
          final_price: number | null
          id: string
          internal_notes: string | null
          labor_cost: number | null
          lock_code: string | null
          photo_urls: string[] | null
          picked_up_at: string | null
          problem_description: string
          signature_url: string | null
          status: Database["public"]["Enums"]["repair_status"]
          technician_id: string | null
          ticket_code: string
          updated_at: string
          warranty_days: number
          warranty_until: string | null
        }
        Insert: {
          accessories?: string[] | null
          created_at?: string
          created_by?: string | null
          customer_id: string
          device_brand: string
          device_color?: string | null
          device_imei?: string | null
          device_model: string
          estimated_price?: number | null
          final_price?: number | null
          id?: string
          internal_notes?: string | null
          labor_cost?: number | null
          lock_code?: string | null
          photo_urls?: string[] | null
          picked_up_at?: string | null
          problem_description: string
          signature_url?: string | null
          status?: Database["public"]["Enums"]["repair_status"]
          technician_id?: string | null
          ticket_code?: string
          updated_at?: string
          warranty_days?: number
          warranty_until?: string | null
        }
        Update: {
          accessories?: string[] | null
          created_at?: string
          created_by?: string | null
          customer_id?: string
          device_brand?: string
          device_color?: string | null
          device_imei?: string | null
          device_model?: string
          estimated_price?: number | null
          final_price?: number | null
          id?: string
          internal_notes?: string | null
          labor_cost?: number | null
          lock_code?: string | null
          photo_urls?: string[] | null
          picked_up_at?: string | null
          problem_description?: string
          signature_url?: string | null
          status?: Database["public"]["Enums"]["repair_status"]
          technician_id?: string | null
          ticket_code?: string
          updated_at?: string
          warranty_days?: number
          warranty_until?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "repair_tickets_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
        ]
      }
      sale_items: {
        Row: {
          created_at: string
          created_by: string | null
          id: string
          item_id: string
          line_total: number
          name_snapshot: string
          qty: number
          sale_id: string
          unit_price: number
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          id?: string
          item_id: string
          line_total?: number
          name_snapshot: string
          qty: number
          sale_id: string
          unit_price?: number
        }
        Update: {
          created_at?: string
          created_by?: string | null
          id?: string
          item_id?: string
          line_total?: number
          name_snapshot?: string
          qty?: number
          sale_id?: string
          unit_price?: number
        }
        Relationships: [
          {
            foreignKeyName: "sale_items_item_id_fkey"
            columns: ["item_id"]
            isOneToOne: false
            referencedRelation: "inventory_items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sale_items_sale_id_fkey"
            columns: ["sale_id"]
            isOneToOne: false
            referencedRelation: "sales"
            referencedColumns: ["id"]
          },
        ]
      }
      sales: {
        Row: {
          amount_paid: number
          cashier_id: string | null
          change_lak: number
          created_at: string
          currency_paid: Database["public"]["Enums"]["currency_code"]
          customer_id: string | null
          discount: number
          exchange_rate: number
          id: string
          notes: string | null
          payment_method: Database["public"]["Enums"]["payment_method"]
          sale_code: string
          subtotal: number
          total: number
        }
        Insert: {
          amount_paid?: number
          cashier_id?: string | null
          change_lak?: number
          created_at?: string
          currency_paid?: Database["public"]["Enums"]["currency_code"]
          customer_id?: string | null
          discount?: number
          exchange_rate?: number
          id?: string
          notes?: string | null
          payment_method?: Database["public"]["Enums"]["payment_method"]
          sale_code?: string
          subtotal?: number
          total?: number
        }
        Update: {
          amount_paid?: number
          cashier_id?: string | null
          change_lak?: number
          created_at?: string
          currency_paid?: Database["public"]["Enums"]["currency_code"]
          customer_id?: string | null
          discount?: number
          exchange_rate?: number
          id?: string
          notes?: string | null
          payment_method?: Database["public"]["Enums"]["payment_method"]
          sale_code?: string
          subtotal?: number
          total?: number
        }
        Relationships: [
          {
            foreignKeyName: "sales_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
        ]
      }
      stock_movements: {
        Row: {
          created_at: string
          created_by: string | null
          id: string
          item_id: string
          note: string | null
          qty: number
          ref_ticket_id: string | null
          type: Database["public"]["Enums"]["movement_type"]
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          id?: string
          item_id: string
          note?: string | null
          qty: number
          ref_ticket_id?: string | null
          type: Database["public"]["Enums"]["movement_type"]
        }
        Update: {
          created_at?: string
          created_by?: string | null
          id?: string
          item_id?: string
          note?: string | null
          qty?: number
          ref_ticket_id?: string | null
          type?: Database["public"]["Enums"]["movement_type"]
        }
        Relationships: [
          {
            foreignKeyName: "stock_movements_item_id_fkey"
            columns: ["item_id"]
            isOneToOne: false
            referencedRelation: "inventory_items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "stock_movements_ref_ticket_id_fkey"
            columns: ["ref_ticket_id"]
            isOneToOne: false
            referencedRelation: "repair_tickets"
            referencedColumns: ["id"]
          },
        ]
      }
      user_roles: {
        Row: {
          created_at: string
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      gen_ticket_code: { Args: never; Returns: string }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      is_staff: { Args: { _user_id: string }; Returns: boolean }
      track_ticket: {
        Args: { _code: string }
        Returns: {
          created_at: string
          device_brand: string
          device_model: string
          history: Json
          picked_up_at: string
          status: Database["public"]["Enums"]["repair_status"]
          ticket_code: string
          warranty_until: string
        }[]
      }
    }
    Enums: {
      app_role: "admin" | "cashier" | "technician"
      currency_code: "LAK" | "THB" | "USD"
      item_category: "part" | "accessory" | "tool" | "phone_new" | "phone_used"
      movement_type:
        | "purchase"
        | "repair_use"
        | "adjustment"
        | "sale"
        | "return"
      payment_method: "cash" | "qr" | "transfer" | "card"
      repair_status:
        | "received"
        | "inspecting"
        | "waiting_parts"
        | "repairing"
        | "testing"
        | "done"
        | "picked_up"
        | "closed"
        | "cancelled"
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
      app_role: ["admin", "cashier", "technician"],
      currency_code: ["LAK", "THB", "USD"],
      item_category: ["part", "accessory", "tool", "phone_new", "phone_used"],
      movement_type: ["purchase", "repair_use", "adjustment", "sale", "return"],
      payment_method: ["cash", "qr", "transfer", "card"],
      repair_status: [
        "received",
        "inspecting",
        "waiting_parts",
        "repairing",
        "testing",
        "done",
        "picked_up",
        "closed",
        "cancelled",
      ],
    },
  },
} as const
