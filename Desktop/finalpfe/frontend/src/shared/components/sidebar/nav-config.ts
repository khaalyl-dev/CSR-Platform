import {
  faTachometerAlt,
  faList,
  faCheckSquare,
  faClipboardCheck,
  faEnvelopeOpenText,
  faHourglassHalf,
  faHistory,
  faUser,
  faBuilding,
  faFolderTree,
  faFolderOpen,
  faCalendarPlus,
} from '@fortawesome/free-solid-svg-icons';

export interface NavItem {
  label: string;
  path: string;
  roles: ('site' | 'corporate')[];
  icon: any;
}

export interface NavSection {
  section: string;
  roles: ('site' | 'corporate')[];
  isDropdown?: boolean;
  items: NavItem[];
}

export const navItems: NavSection[] = [
  {
    section: 'Pilotage',
    roles: ['site', 'corporate'],
    items: [
      { label: 'Vue générale', path: '/dashboard', roles: ['site', 'corporate'], icon: faTachometerAlt },
    ],
  },
  {
    section: 'Gestion CSR',
    roles: ['site', 'corporate'],
    isDropdown: true,
    items: [
      { label: 'Plans annuels', path: '/csr-plans', roles: ['site', 'corporate'], icon: faList },
      { label: 'Activités planifiées', path: '/planned-activities', roles: ['site', 'corporate'], icon: faCalendarPlus },
      { label: 'Activités réalisées', path: '/realized-csr', roles: ['site', 'corporate'], icon: faClipboardCheck },
      { label: 'Documents', path: '/documents', roles: ['site', 'corporate'], icon: faFolderOpen },
    ],
  },
  {
    section: 'Workflow',
    roles: ['site', 'corporate'],
    isDropdown: true,
    items: [
      { label: 'Validation des plans', path: '/annual-plans/validation', roles: ['site', 'corporate'], icon: faCheckSquare },
      { label: 'Mes demandes', path: '/changes', roles: ['site'], icon: faEnvelopeOpenText },
      { label: 'Demandes en attente', path: '/changes/pending', roles: ['corporate'], icon: faHourglassHalf },
      { label: 'Historique des demandes', path: '/changes/history', roles: ['corporate'], icon: faHistory },
    ],
  },
  {
    section: 'Administration',
    roles: ['corporate'],
    isDropdown: true,
    items: [
      { label: 'Sites', path: '/sites', roles: ['corporate'], icon: faBuilding },
      { label: 'Catégories CSR', path: '/categories', roles: ['corporate'], icon: faFolderTree },
      { label: 'Utilisateurs', path: '/admin/users', roles: ['corporate'], icon: faUser },
    ],
  },
  {
    section: 'Compte',
    roles: ['site', 'corporate'],
    items: [
      { label: 'Mon profil', path: '/account/profile', roles: ['site', 'corporate'], icon: faUser },
    ],
  },
];
