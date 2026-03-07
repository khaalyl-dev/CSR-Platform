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
  faClipboardList,
  faChartLine,
} from '@fortawesome/free-solid-svg-icons';

export interface NavItem {
  labelKey: string;
  path: string;
  roles: ('site' | 'corporate')[];
  icon: any;
}

export interface NavSection {
  sectionKey: string;
  roles: ('site' | 'corporate')[];
  isDropdown?: boolean;
  items: NavItem[];
}

export const navItems: NavSection[] = [
  {
    sectionKey: 'NAV.SECTIONS.PILOTAGE',
    roles: ['site', 'corporate'],
    items: [
      { labelKey: 'NAV.ITEMS.OVERVIEW', path: '/dashboard', roles: ['site', 'corporate'], icon: faTachometerAlt },
    ],
  },
  {
    sectionKey: 'NAV.SECTIONS.CSR_MANAGEMENT',
    roles: ['site', 'corporate'],
    isDropdown: true,
    items: [
      { labelKey: 'NAV.ITEMS.ANNUAL_PLANS', path: '/csr-plans', roles: ['site', 'corporate'], icon: faList },
      { labelKey: 'NAV.ITEMS.PLANNED_ACTIVITIES', path: '/planned-activities', roles: ['site', 'corporate'], icon: faCalendarPlus },
      { labelKey: 'NAV.ITEMS.REALIZED_ACTIVITIES', path: '/realized-csr', roles: ['site', 'corporate'], icon: faClipboardCheck },
      { labelKey: 'NAV.ITEMS.DOCUMENTS', path: '/documents', roles: ['site', 'corporate'], icon: faFolderOpen },
    ],
  },
  {
    sectionKey: 'NAV.SECTIONS.WORKFLOW',
    roles: ['site', 'corporate'],
    isDropdown: true,
    items: [
      { labelKey: 'NAV.ITEMS.PLAN_VALIDATION', path: '/annual-plans/validation', roles: ['site', 'corporate'], icon: faCheckSquare },
      { labelKey: 'NAV.ITEMS.MY_REQUESTS', path: '/changes', roles: ['site'], icon: faEnvelopeOpenText },
      { labelKey: 'NAV.ITEMS.PENDING_REQUESTS', path: '/changes/pending', roles: ['corporate'], icon: faHourglassHalf },
      { labelKey: 'NAV.ITEMS.REQUEST_HISTORY', path: '/changes/history', roles: ['corporate'], icon: faHistory },
    ],
  },
  {
    sectionKey: 'NAV.SECTIONS.ADMINISTRATION',
    roles: ['corporate'],
    isDropdown: true,
    items: [
      { labelKey: 'NAV.ITEMS.SITES', path: '/sites', roles: ['corporate'], icon: faBuilding },
      { labelKey: 'NAV.ITEMS.CSR_CATEGORIES', path: '/categories', roles: ['corporate'], icon: faFolderTree },
      { labelKey: 'NAV.ITEMS.USERS', path: '/admin/users', roles: ['corporate'], icon: faUser },
      { labelKey: 'NAV.ITEMS.AUDIT_LOG', path: '/admin/audit', roles: ['corporate'], icon: faClipboardList },
    ],
  },
  {
    sectionKey: 'NAV.SECTIONS.ACCOUNT',
    roles: ['site', 'corporate'],
    items: [
      { labelKey: 'NAV.ITEMS.MY_PROFILE', path: '/account/profile', roles: ['site', 'corporate'], icon: faUser },
    ],
  },
];
