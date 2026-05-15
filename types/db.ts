// Supabase-compatible Database type matching supabase/migrations/0001_init.sql.

export type Category = "Drinks" | "Short-eats" | "Sweets" | "BBQ";
export type UserRole = "cashier" | "admin";

export interface Profile {
  id: string;
  full_name: string | null;
  role: UserRole;
  created_at: string;
}

export interface Product {
  id: string;
  name: string;
  price: number;
  category: Category;
  stock_count: number;
  image_url: string | null;
  is_active: boolean;
  created_at: string;
}

export interface ComboItemRef {
  product_id: string;
  quantity: number;
}

export interface Combo {
  id: string;
  name: string;
  price: number;
  items: ComboItemRef[];
  image_url: string | null;
  is_active: boolean;
  created_at: string;
}

export type SaleLineType = "product" | "combo" | "addon";

export interface SaleLine {
  type: SaleLineType;
  id: string;
  name: string;
  price: number;
  quantity: number;
}

export type IncomeType = "order" | "custom";

export const CUSTOM_INCOME_CATEGORIES = [
  "Parking",
  "Previous Revenue",
  "Tips",
  "Donation",
  "Other",
] as const;

export type CustomIncomeCategory = (typeof CUSTOM_INCOME_CATEGORIES)[number];

export interface Sale {
  id: string;
  created_at: string;
  total_amount: number;
  items: SaleLine[];
  payment_method: string;
  customer_phone: string | null;
  cashier_id: string | null;
  income_type: IncomeType;
  income_category: string | null;
  description: string | null;
}

export interface InventoryLog {
  id: string;
  product_id: string | null;
  change_amount: number;
  reason: string;
  actor_id: string | null;
  created_at: string;
}

export type ExpenseCategory =
  | "Ingredients"
  | "Utilities"
  | "Salaries"
  | "Rent"
  | "Maintenance"
  | "Marketing"
  | "Other";

export interface Expense {
  id: string;
  created_at: string;
  expense_date: string;
  category: ExpenseCategory;
  amount: number;
  description: string | null;
  image_url: string | null;
  created_by: string | null;
}

export interface TopSellingItem {
  name: string;
  units_sold: number;
  revenue: number;
}

export type NotificationType = "sale" | "expense" | "stock";

export interface Notification {
  id: string;
  created_at: string;
  title: string;
  message: string;
  type: NotificationType;
  is_read: boolean;
  actor_id: string | null;
}

export interface NotificationDismissal {
  notification_id: string;
  user_id: string;
  dismissed_at: string;
}

type RowOnlyTable<T> = {
  Row: T;
  Insert: Partial<T> & Record<string, unknown>;
  Update: Partial<T>;
  Relationships: [];
};

export interface Database {
  public: {
    Tables: {
      profiles: RowOnlyTable<Profile>;
      products: RowOnlyTable<Product>;
      combos: RowOnlyTable<Combo>;
      sales: RowOnlyTable<Sale>;
      inventory_logs: RowOnlyTable<InventoryLog>;
      expenses: RowOnlyTable<Expense>;
      notifications: RowOnlyTable<Notification>;
      notification_dismissals: RowOnlyTable<NotificationDismissal>;
    };
    Views: {
      v_top_selling_items: {
        Row: TopSellingItem;
        Relationships: [];
      };
    };
    Functions: Record<string, never>;
    Enums: Record<string, never>;
    CompositeTypes: Record<string, never>;
  };
}
