import type { IconKey } from '../config/assets';

export interface CvSection {
  id: string;
  label: string;
  icon: IconKey;
  blurb: string;
}

/** Order here is the order of the ring and of the page. */
export const sections: CvSection[] = [
  { id: 'education', label: 'Education', icon: 'education', blurb: '[PLACEHOLDER: one line about studies]' },
  { id: 'experience', label: 'Job Experience', icon: 'experience', blurb: '[PLACEHOLDER: one line about work]' },
  { id: 'projects', label: 'Projects', icon: 'projects', blurb: '[PLACEHOLDER: one line about projects]' },
  { id: 'skills', label: 'Skills', icon: 'skills', blurb: '[PLACEHOLDER: one line about skills]' },
  { id: 'interests', label: 'Interests', icon: 'interests', blurb: '[PLACEHOLDER: one line about interests]' },
];
