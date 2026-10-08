import type { IconKey } from '../config/assets';

export interface CvSection {
  id: string;
  label: string;
  icon: IconKey;
  blurb: string;
}

/** Order here is the order of the ring and of the page. */
export const sections: CvSection[] = [
  { id: 'education', label: 'Education', icon: 'education', blurb: 'Psychology and the Honours College in Leiden.' },
  { id: 'experience', label: 'Job Experience', icon: 'experience', blurb: 'Kitchens, tables and newspaper routes.' },
  { id: 'projects', label: 'Projects', icon: 'projects', blurb: 'Astrophotography, Instagram and a business case.' },
  { id: 'skills', label: 'Skills', icon: 'skills', blurb: 'Research, numbers, creativity and resilience.' },
  { id: 'interests', label: 'Interests', icon: 'interests', blurb: 'Music, making things, mountains and travel.' },
];
