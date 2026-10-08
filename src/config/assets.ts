/**
 * One line per asset. To use real artwork, drop the file into /public/assets/
 * and change the path on that line (for example '/assets/hero.jpg').
 */
export const assets = {
  hero: '/assets/hero.placeholder.svg',
  heroAlt: 'Painting of a young man alone at a picnic table on a rocky alpine ledge, jagged peaks behind him and a cerulean sky above.',
  birdFrames: [
    '/assets/bird-frame-1.placeholder.svg', // wings up
    '/assets/bird-frame-2.placeholder.svg', // wings mid-down
    '/assets/bird-frame-3.placeholder.svg', // wings down
    '/assets/bird-frame-4.placeholder.svg', // wings mid-up
  ],
  birdBack: '/assets/bird-back.placeholder.svg',
  icons: {
    education: '/assets/icon-education.placeholder.svg',
    experience: '/assets/icon-experience.placeholder.svg',
    projects: '/assets/icon-projects.placeholder.svg',
    skills: '/assets/icon-skills.placeholder.svg',
    interests: '/assets/icon-interests.placeholder.svg',
  },
  /** optional transparent parallax layers, null until supplied */
  layers: {
    sky: null as string | null,
    midground: null as string | null,
    foreground: null as string | null,
  },
} as const;

export type IconKey = keyof typeof assets.icons;
