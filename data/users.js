/* ============================================================
   YallahClick - Staff accounts seed (data/users)
   Roles:
     owner      -> full access to everything
     webmaster  -> website listings (content hub, prompts, templates,
                   video / thumbnail / PSD templates, files, categories)
     marketing  -> promotions + categories
     callcenter -> customers + bookings
     comptable  -> analytics (read)
   The backend authenticates /api/auth/login against this same
   collection, so edits on the admin Users page take effect on the
   real sign-in immediately.
   ============================================================ */
window.YC = window.YC || {};
YC.data = YC.data || {};

YC.data.users = [
  {
    id: 1,
    name: "YallahClick Owner",
    email: "admin@yallahclick.com",
    password: "admin123",
    role: "owner",
    status: "active",
    createdAt: "2026-08-01T10:00:00Z"
  },
  {
    id: 2,
    name: "Sarah K.",
    email: "sarah@yallahclick.com",
    password: "yallah123",
    role: "webmaster",
    status: "active",
    createdAt: "2026-08-12T09:30:00Z"
  },
  {
    id: 3,
    name: "Omar B.",
    email: "omar@yallahclick.com",
    password: "yallah123",
    role: "marketing",
    status: "active",
    createdAt: "2026-08-18T14:00:00Z"
  },
  {
    id: 4,
    name: "Lina M.",
    email: "lina@yallahclick.com",
    password: "yallah123",
    role: "callcenter",
    status: "active",
    createdAt: "2026-08-20T11:20:00Z"
  },
  {
    id: 5,
    name: "Hicham R.",
    email: "hicham@yallahclick.com",
    password: "yallah123",
    role: "comptable",
    status: "active",
    createdAt: "2026-08-25T16:45:00Z"
  }
];