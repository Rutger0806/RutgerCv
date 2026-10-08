export interface SkillGroup {
  category: string;
  items: string[];
}

export const skillGroups: SkillGroup[] = [
  {
    category: 'Research and analysis',
    items: [
      'Independent research and data analysis',
      'Critical thinking and problem solving',
      'Excel and financial modelling',
    ],
  },
  {
    category: 'Creative and strategic',
    items: [
      'Creative strategy and project management',
      'Content creation and visual storytelling',
    ],
  },
  {
    category: 'People and resilience',
    items: [
      'Intercultural communication',
      'Teamwork and collaboration',
      'Adaptability and resilience',
      'Independence and time management',
    ],
  },
];
