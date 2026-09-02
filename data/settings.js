/* ============================================================
   YallahClick — Settings (default site configuration)
   Modeled as a single-record collection so it flows through the
   same REST CRUD + sync bridge as every other collection.
   The dashboard "Settings" page reads/writes this one object.
   ============================================================ */
window.YC = window.YC || {};
YC.data = YC.data || {};

YC.data.settings = [
  {
    id: 1,
    websiteName: 'Yallah Click',
    tagline: 'Premium Video Editing & Content Growth',
    contactEmail: 'yallahclick.contact@gmail.com',
    phone: '+212 600 000 000',
    logoDark: 'images/Yalah Click WH.png',
    logoLight: 'images/yallahclick.png',
    favicon: 'images/Mini logo.ico',
    defaultTheme: 'dark',
    enableThemeToggle: true,
    announcement: '',
    bookingEnabled: true,
    bookingMinPeople: 1,
    bookingMaxPeople: 10,
    bookingBufferHours: 1,
    confirmRequired: true,
    contentPromptsEnabled: true,
    contentTemplatesEnabled: true,
    downloadMethod: 'direct',
    itemsPerPage: 9,
    promoPopupsEnabled: true,
    promoDefaultDelay: 5,
    promoDefaultPosition: 'center',
    promoDefaultShowOnce: true,
    social: {
      youtube: 'https://www.youtube.com/@YallahClick',
      instagram: 'https://www.instagram.com/yallah.click/?hl=en',
      tiktok: 'https://www.tiktok.com/@yallah.click',
      behance: 'https://www.behance.net/yallahclick',
      linkedin: 'https://www.linkedin.com/in/yallah-click-34a897421/',
      facebook: 'https://facebook.com',
      pinterest: 'https://www.pinterest.com/yallahclick/_profile/',
      x: 'https://x.com/YallahClick',
      whatsapp: 'https://wa.me/message/I5ZSIR6EPNRON1'
    }
  }
];