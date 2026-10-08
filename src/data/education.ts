export interface EducationEntry {
  period: string;
  title: string;
  org: string;
  summary: string;
}

export const education: EducationEntry[] = [
  {
    period: '2024 to present',
    title: 'International Bachelor of Psychology and Honours College',
    org: 'Universiteit Leiden',
    summary:
      'Combines the psychology bachelor with the Honours College. Followed an academic programme in Morocco through NIMAR (5 ECTS). First-year average of 7.9, Honours College included.',
  },
  {
    period: '2018 to 2024',
    title: 'Atheneum diploma',
    org: 'Atheneum College Hageveld',
    summary: 'Graduated with an average of 7.65 across 10 subjects.',
  },
];
