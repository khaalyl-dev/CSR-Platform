import {
  faTachometerAlt, faList, faPlusSquare, faCheckSquare, faTasks,
  faPlusCircle, faCheckCircle, faChartPie, faChartLine,
  faEnvelopeOpenText, faHourglassHalf, faHistory, faUser,
  faBuilding, faCogs, faFolderTree, faLayerGroup, faFileAlt, faClipboardCheck,
  faFolderOpen
} from '@fortawesome/free-solid-svg-icons';
import { faMicrosoft } from '@fortawesome/free-brands-svg-icons';

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
    section: 'DASHBOARD',
    roles: ['site', 'corporate'],
    items: [
      { label: 'Vue générale', path: '/dashboard', roles: ['site', 'corporate'], icon: faTachometerAlt }
    ]
  },
  {
    section: 'STRATÉGIE & PILIERS CSR',
    roles: ['corporate'],
    isDropdown: true,
    items: [
      { label: 'Gestion des Sites', path: '/sites', roles: ['corporate'], icon: faBuilding },
      { label: 'Gestion Catégories CSR', path: '/categories', roles: ['corporate'], icon: faFolderTree }
    ]
  },
  {
    section: 'PLANIFICATION OPÉRATIONNELLE',
    roles: ['site', 'corporate'],
    isDropdown: true,
    items: [
      { label: 'Plans Annuels', path: '/csr-plans', roles: ['site', 'corporate'], icon: faList },
      { label: 'Activités', path: '/realized-csr', roles: ['site', 'corporate'], icon: faClipboardCheck },
      { label: 'Validation Plans', path: '/annual-plans/validation', roles: ['site', 'corporate'], icon: faCheckSquare },
    ]
  },
  
  {
    section: 'ANALYSE & REPORTING',
    roles: ['corporate'],
    isDropdown: true,
    items: [
      { label: 'Power BI', path: '/reporting/power-bi', roles: ['corporate'], icon: faMicrosoft }
    ]
  },
  {
    section: 'DEMANDES & HISTORIQUE',
    roles: ['site', 'corporate'],
    isDropdown: true,
    items: [
      { label: 'Mes Demandes', path: '/changes', roles: ['site'], icon: faEnvelopeOpenText },
      { label: 'Demandes en Attente', path: '/changes/pending', roles: ['corporate'], icon: faHourglassHalf },
      { label: 'Historique', path: '/changes/history', roles: ['corporate'], icon: faHistory }
    ]
  },
  {
    section: 'DOCUMENTS',
    roles: ['site', 'corporate'],
    items: [
      { 
        label: 'Gestion Documents', 
        path: '/documents', 
        roles: ['site', 'corporate'], 
        icon: faFolderOpen 
      }
    ]
  },
  {
    section: 'COMPTE',
    roles: ['site', 'corporate'],
    items: [
      { label: 'Mon Profil', path: '/account/profile', roles: ['site', 'corporate'], icon: faUser }
    ]
  },
  {
    section: 'ADMINISTRATION',
    roles: ['corporate'],
    isDropdown: true,
    items: [
      { label: 'Gestion Utilisateurs', path: '/admin/users', roles: ['corporate'], icon: faUser },
      { label: 'Audit Logs', path: '/admin/audit', roles: ['corporate'], icon: faFolderTree }

    ]
  }
];
