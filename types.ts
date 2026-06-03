export enum Section {
  Home = 'Home',
  About = 'About',
  Research = 'Research',
  Tech = 'Tech',
  Contact = 'Contact'
}

export interface GeneData {
  gene: string;
  interactionStrength: number;
  distance: number;
  type: 'Promoter-Enhancer' | 'Promoter-Promoter';
}

export interface ResearchTab {
  id: string;
  label: string;
  color: string;
}

export interface Client {
  id: number;
  created_at: string;
  name: string;
  email: string;
  message: string;
}

export interface Milestone {
  id: number;
  created_at: string;
  title: string;
  date: string;
  description: string;
  category: string;
  image_url: string;
  fips_code?: string;
}

export interface Experience {
  id: number;
  created_at: string;
  role: string;
  company: string;
  date: string;
  description: string;
}

export interface State {
  id: number;
  created_at: string;
  name: string;
  status: 'VISITED' | 'STAYED';
  fips_code: string;
}

export interface Museum {
    id: number;
    created_at: string;
    name: string;
    city: string;
    state: string;
    description: string;
    image_url: string;
    fips_code: string;
    latitude?: number;
    longitude?: number;
}