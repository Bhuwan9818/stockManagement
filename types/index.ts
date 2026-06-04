export interface Product {
  id: number;
  name: string;
  sku: string;
  category: string | null;
  unit: string;
  low_stock_threshold: number;
  master_stock: number;
  created_at: string;
  updated_at: string;
}

export interface Platform {
  id: number;
  name: string;
  color: string;
  type: 'online' | 'offline' | 'other';
  is_active: boolean;
  created_at: string;
}

export type TxnType = 'restock' | 'sale' | 'return' | 'gift' | 'offline_sale' | 'adjustment';

export interface StockTransaction {
  id: number;
  product_id: number;
  platform_id: number | null;
  type: TxnType;
  quantity: number;
  direction: 1 | -1;
  transaction_date: string;
  notes: string | null;
  supplier: string | null;
  cost_per_unit: number | null;
  created_at: string;
  // joined
  product_name?: string;
  product_sku?: string;
  platform_name?: string;
  platform_color?: string;
  platform_type?: string;
}

export const TXN_META: Record<TxnType, { label: string; color: string; direction: 1 | -1; badge: string }> = {
  restock:      { label: 'Restock',      color: '#22c55e', direction:  1, badge: 'badge-success' },
  sale:         { label: 'Platform Sale', color: '#ef4444', direction: -1, badge: 'badge-danger'  },
  return:       { label: 'Return',        color: '#3b82f6', direction:  1, badge: 'badge-info'    },
  gift:         { label: 'Gift',          color: '#ec4899', direction: -1, badge: 'badge-pink'    },
  offline_sale: { label: 'Offline Sale',  color: '#f59e0b', direction: -1, badge: 'badge-warning' },
  adjustment:   { label: 'Adjustment',    color: '#8b5cf6', direction:  1, badge: 'badge-purple'  },
};
