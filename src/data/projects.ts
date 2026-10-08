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
    id: 'project-one',
    title: '[PLACEHOLDER: project one]',
    description: '[PLACEHOLDER: one sentence about this project]',
    caseStudy: {
      problem: '[PLACEHOLDER: the problem it set out to solve]',
      approach: '[PLACEHOLDER: how you approached it]',
      outcome: '[PLACEHOLDER: what came out of it]',
    },
    ratio: '4 / 3',
  },
  {
    id: 'project-two',
    title: '[PLACEHOLDER: project two]',
    description: '[PLACEHOLDER: one sentence about this project]',
    caseStudy: {
      problem: '[PLACEHOLDER: the problem it set out to solve]',
      approach: '[PLACEHOLDER: how you approached it]',
      outcome: '[PLACEHOLDER: what came out of it]',
    },
    ratio: '3 / 4',
  },
  {
    id: 'project-three',
    title: '[PLACEHOLDER: project three]',
    description: '[PLACEHOLDER: one sentence about this project]',
    caseStudy: {
      problem: '[PLACEHOLDER: the problem it set out to solve]',
      approach: '[PLACEHOLDER: how you approached it]',
      outcome: '[PLACEHOLDER: what came out of it]',
    },
    ratio: '1 / 1',
  },
];
