export interface Project {
  id: string;
  title: string;
  description: string;
  /** case study copy shown in the expanded view */
  caseStudy: { problem: string; approach: string; outcome: string };
  /** aspect ratio of the placeholder image block */
  ratio: string;
}

export const projects: Project[] = [
  {
    id: 'colours-in-the-universe',
    title: 'Colours in the Universe',
    description: 'How modern cameras change low-budget astrophotography.',
    caseStudy: {
      problem: 'Does modern camera equipment make astrophotography affordable for people on a small budget?',
      approach:
        'Independent research for the school profile project (PWS), combining astrophysics, imaging technology and data analysis.',
      outcome:
        'Graded 9.0. Won both the Publieksprijs and the Rotaryprijs at Atheneum College Hageveld and was submitted to the KNAW PWS competition in 2024.',
    },
    ratio: '4 / 3',
  },
  {
    id: 'seekthetruth',
    title: 'SeekTheTruth._',
    description: 'An Instagram account built on suspense and a countdown.',
    caseStudy: {
      problem: 'How do you build curiosity and engagement around a suspense and countdown concept?',
      approach:
        'Applied principles from psychology and social influence, analysed engagement data to evaluate reach and interaction, and ran the project independently.',
      outcome: 'Reached more than 200,000 people.',
    },
    ratio: '3 / 4',
  },
  {
    id: 'awi-plants',
    title: 'AWI Plants',
    description: 'A 41 page business analysis with a pitch.',
    caseStudy: {
      problem: 'What strategy should AWI Plants follow, given its market and its financials?',
      approach:
        'Market research, financial modelling in Excel and strategic recommendations, written up in a 41 page report and presented as a pitch. Done in a project team.',
      outcome: 'The Excel analysis scored 10/10 and the final report 8.5/10.',
    },
    ratio: '1 / 1',
  },
];
