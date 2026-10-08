export interface ExperienceEntry {
  period: string;
  role: string;
  org: string;
  summary: string;
}

export const experience: ExperienceEntry[] = [
  {
    period: '2023 to present',
    role: 'Cook',
    org: 'Restaurant Nolita',
    summary:
      'Prepares dishes in a fast, demanding kitchen where speed and precision count. Works as part of a team, owns assigned tasks, and keeps quality and timing under control during busy services.',
  },
  {
    period: 'Summer 2022',
    role: 'Server',
    org: 'Restaurant The Spot',
    summary:
      'Gave guests attentive service in a busy restaurant, juggling several tasks at once without losing quality, and worked closely with colleagues.',
  },
  {
    period: '2021 to 2022',
    role: 'Newspaper deliverer',
    org: 'BezorgDeKrant.nl',
    summary:
      'Delivered newspapers independently on a fixed route and schedule. Planned each day alone and kept to every deadline.',
  },
];
