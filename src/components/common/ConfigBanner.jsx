import React from 'react';
import { AlertTriangle, Database } from 'lucide-react';
import { isSupabaseConfigured } from '../../lib/supabase';

export default function ConfigBanner() {
  if (isSupabaseConfigured) return null;

  return (
    <div style={{
      backgroundColor: 'rgba(245, 158, 11, 0.12)',
      borderBottom: '1px solid rgba(245, 158, 11, 0.3)',
      padding: '0.65rem 1.5rem',
      fontSize: '0.875rem',
      color: '#fef3c7',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      gap: '0.75rem',
      textAlign: 'center',
    }}>
      <AlertTriangle size={16} color="#f59e0b" style={{ flexShrink: 0 }} />
      <span>
        <strong>Supabase Configuration Required:</strong> Please configure <code>VITE_SUPABASE_URL</code> and <code>VITE_SUPABASE_ANON_KEY</code> in your <code>.env</code> file, then run <code>supabase_schema.sql</code> in your Supabase SQL Editor.
      </span>
    </div>
  );
}
