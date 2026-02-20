import {
  faTachometerAlt, faList, faPlusSquare, faCheckSquare, faTasks,
  faPlusCircle, faCheckCircle, faChartPie, faChartLine,
  faEnvelopeOpenText, faHourglassHalf, faHistory, faUser,
  faBuilding, faCogs, faFolderTree, faLayerGroup, faFileAlt
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
      { label: 'Stratégie Globale', path: '/strategy', roles: ['corporate'], icon: faLayerGroup },
      { label: 'Objectifs Stratégiques', path: '/strategy/objectives', roles: ['corporate'], icon: faFileAlt },
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
      { label: 'Créer / Importer Plan', path: '/annual-plans/create', roles: ['site'], icon: faPlusSquare },
      { label: 'Validation Plans', path: '/annual-plans/validation', roles: ['corporate'], icon: faCheckSquare },
      { label: 'Projets CSR', path: '/projects', roles: ['site', 'corporate'], icon: faTasks },
      { label: 'Créer Projet', path: '/projects/create', roles: ['site'], icon: faPlusCircle },
      { label: 'Validation Projets', path: '/projects/validation', roles: ['corporate'], icon: faCheckCircle }
    ]
  },
  {
    section: 'PERFORMANCE & KPI',
    roles: ['corporate'],
    isDropdown: true,
    items: [
      { label: 'KPIs', path: '/kpi-management', roles: ['corporate'], icon: faChartLine },
      { label: 'Suivi Budget', path: '/budget-control', roles: ['corporate'], icon: faCogs }
    ]
  },
  {
    section: 'ANALYSE & REPORTING',
    roles: ['corporate'],
    isDropdown: true,
    items: [
      { label: 'Dashboard Consolidé', path: '/analytics', roles: ['corporate'], icon: faChartPie },
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
