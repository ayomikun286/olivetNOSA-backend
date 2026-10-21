
export const WEBSITE_CONTENT_PAGES = {
  home: {
    label: "Home",
   fields: [
  // Hero section
  "heroTitle",
  "heroSubtitle",
  "heroImage",
  "heroImage2",
  "heroImage3",
  "heroImage4",
  "heroImage5",

  // About section
  "aboutTitle",
  "aboutText",

  // Mission and vision
  "missionTitle",
  "missionText",
  "visionTitle",
  "visionText",

  // Other homepage images
  "whereItBeganImage",
  "communityImage",
  "newsImage",
  "youtubeImage",
  "instagramImage",
  "archiveImage1",
  "archiveImage2",
  "archiveImage3",
],
  },

  "about-school": {
    label: "About the School",
    fields: [
      "pageTitle",
      "intro",
      "historyTitle",
      "historyText",
      "mission",
      "vision",
      "values",
      "heroImage",
    ],
  },

  "about-gosa": {
    label: "About GOSA",
    fields: [
      "pageTitle",
      "intro",
      "historyTitle",
      "historyText",
      "mission",
      "vision",
      "objectives",
      "heroImage",
    ],
  },

  contact: {
    label: "Contact",
    fields: [
      "pageTitle",
      "intro",
      "address",
      "email",
      "phone",
      "mapUrl",
    ],
  },

  gallery: {
    label: "Gallery",
    fields: ["pageTitle", "intro", "heroImage"],
  },

  news: {
    label: "News",
    fields: ["pageTitle", "intro"],
  },

  events: {
    label: "Events",
    fields: ["pageTitle", "intro"],
  },

  olivetians: {
    label: "Olivetians",
    fields: ["pageTitle", "intro", "heroImage"],
  },

  "leaders-chapters": {
    label: "Leaders & Chapters",
    fields: ["pageTitle", "intro", "heroImage"],
  },

  "legacy-leadership": {
    label: "Legacy Leadership",
    fields: ["pageTitle", "intro", "historyText"],
  },

  // "privacy-policy": {
  //   label: "Privacy Policy",
  //   fields: ["pageTitle", "intro", "policySections"],
  // },

  // "terms-and-conditions": {
  //   label: "Terms & Conditions",
  //   fields: ["pageTitle", "intro", "termsSections"],
  // },
};

export const getWebsiteContentPage = (pageKey) =>
  WEBSITE_CONTENT_PAGES[pageKey] ?? null;
