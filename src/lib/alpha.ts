// Closed-alpha entry state.
//
// ALPHA_SIGNUPS_OPEN controls the APPLICATION ONLY — the signup UI and the
// `signup` server action. It is NOT the security boundary.
//
// The AUTHORITATIVE enrollment gate is Supabase Authentication's
// "Allow new users to sign up" setting. Because the public anon key can call
// the GoTrue signup endpoint directly (bypassing this app entirely), turning
// that Supabase setting off is what actually prevents uninvited enrollment.
//
// Reopening signup therefore requires changing BOTH:
//   1. set ALPHA_SIGNUPS_OPEN = true here (restores the in-app UI + action), and
//   2. turn "Allow new users to sign up" back ON in the Supabase dashboard.
//
// Changing only this constant re-shows the form but Supabase will still
// reject new accounts; changing only Supabase leaves the app presenting a
// closed state. Both must agree.
export const ALPHA_SIGNUPS_OPEN = false;
