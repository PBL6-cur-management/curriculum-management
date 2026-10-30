// Palette lấy từ hệ thống chuẩn đầu ra của Trường (chuandaura.dut.udn.vn).
// Mọi màu trong app đi qua đây hoặc qua token AntD sinh từ đây — không hardcode hex trong component.

export const palette = {
  brand: '#0071a6',
  brandStrong: '#005b86',
  brandSoft: '#e6f1f7',

  headerFrom: '#1e40af', // blue-800
  headerTo: '#2563eb', // blue-600

  slate50: '#f8fafc',
  slate100: '#f1f5f9',
  slate200: '#e2e8f0',
  slate300: '#cbd5e1',
  slate400: '#94a3b8',
  slate500: '#64748b',
  slate600: '#475569',
  slate700: '#334155',
  slate800: '#1e293b',
  slate900: '#0f172a',

  pass: '#059669',
  passStrong: '#047857',
  passSoft: '#ecfdf5',
  fail: '#ef4444',
  failStrong: '#b91c1c',
  failSoft: '#fef2f2',
  warn: '#d97706',
  warnSoft: '#fffbeb',
  info: '#1d4ed8',
  infoSoft: '#eff6ff',

  white: '#ffffff',
} as const;

export const radius = { sm: 4, md: 6, lg: 8, xl: 12, xxl: 16 } as const;

export const fontStack =
  "'Roboto Variable', ui-sans-serif, system-ui, 'Segoe UI', sans-serif";
export const monoStack =
  "ui-monospace, SFMono-Regular, Menlo, Consolas, 'Liberation Mono', monospace";
