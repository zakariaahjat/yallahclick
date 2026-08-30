/* ============================================================
   YallahClick — Services
   Reuses the services already present on the existing website
   (the service options in the homepage booking form).
   `page` is where the CTA should lead. Swap for real service
   routes later (e.g. /services/video-production) — no redesign.
   ============================================================ */
window.YC = window.YC || {};
YC.data = YC.data || {};

YC.data.services = [
  {
    id: "video-production",
    name: "Video Production",
    icon: "🎬",
    short: "Video Production",
    description: "High-retention long-form and short-form editing, cinematic color grading, and immersive sound design.",
    page: "index.html#book"
  },
  {
    id: "motion-design",
    name: "Motion Design",
    icon: "🎨",
    short: "Motion Design",
    description: "Motion graphics, animated captions, VFX, and visual storytelling that keeps viewers glued.",
    page: "index.html#book"
  },
  {
    id: "graphic-design",
    name: "Graphic Design",
    icon: "🖌️",
    short: "Graphic Design",
    description: "Thumbnails, channel art, branding and graphic assets built to convert clicks.",
    page: "index.html#book"
  },
  {
    id: "marketing",
    name: "Marketing",
    icon: "📈",
    short: "Marketing",
    description: "Algorithm-driven packaging, SEO titles, retention strategy and growth consulting.",
    page: "index.html#book"
  },
  {
    id: "full-creative",
    name: "Full Creative Service",
    icon: "⭐",
    short: "Full Creative Service",
    description: "The complete package: editing, motion, thumbnails and marketing handled end-to-end.",
    page: "index.html#book"
  }
];

YC.data.getService = function(id){
  return YC.data.services.find(function(s){ return s.id === id; }) || null;
};

YC.data.getServiceName = function(id){
  var s = YC.data.getService(id);
  return s ? s.short : "YallahClick Service";
};