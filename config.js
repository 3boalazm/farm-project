// ╔═══════════════════════════════════════════════════════╗
// ║           إعدادات المزرعة — عدّل هنا فقط            ║
// ╠═══════════════════════════════════════════════════════╣
// ║  1. افتح هذا الملف                                   ║
// ║  2. ضع بيانات Supabase بين علامات التنصيص ''         ║
// ║  3. ارفع الملفات الأربعة على Cloudflare              ║
// ║  4. كل الأجهزة ستعمل تلقائياً بدون أي إعداد          ║
// ╚═══════════════════════════════════════════════════════╝

const FARM_CONFIG = {
  // ── Supabase ──────────────────────────────────────────
  supabaseUrl: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImhhZW56dWpjYm94bml0dGRuanllIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzg1MjY1NTQsImV4cCI6MjA5NDEwMjU1NH0.VGtdigLbG5V-r_kP-gSw5xEJGKjt3KHgZ2xn6Na4v9c',
  supabaseKey: 'sb_publishable_HoCJA3XUhzPOFj0sdTf0zw_yiSmo9TF',

  // ── معلومات المزرعة (اختياري) ─────────────────────────
  farmName:    'بيان المزرعة',
  ownerName:   'مدير المزرعة',
  currency:    'ج.م',
};