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
  /** When true, do not show section header (e.g. Dashboard first). */
  hideSectionLabel?: boolean;
  items: NavItem[];
}

export const navItems: NavSection[] = [
  {
    sectionKey: '',
    roles: ['site', 'corporate'],
    hideSectionLabel: true,
    items: [
      { labelKey: 'NAV.ITEMS.DASHBOARD', path: '/dashboard', roles: ['site', 'corporate'], icon: faChartLine },
    ],
  },
  {
    sectionKey: 'NAV.SECTIONS.PLANS_ACTIVITIES',
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
    sectionKey: 'NAV.SECTIONS.APPROVALS',
    roles: ['site', 'corporate'],
    isDropdown: true,
    items: [
      { labelKey: 'NAV.ITEMS.VALIDATE_PLANS', path: '/annual-plans/validation', roles: ['site', 'corporate'], icon: faCheckSquare },
      { labelKey: 'NAV.ITEMS.MY_REQUESTS', path: '/changes', roles: ['site'], icon: faEnvelopeOpenText },
      { labelKey: 'NAV.ITEMS.PENDING_REQUESTS', path: '/changes/pending', roles: ['corporate'], icon: faHourglassHalf },
      { labelKey: 'NAV.ITEMS.CHANGE_HISTORY', path: '/changes/history', roles: ['corporate'], icon: faHistory },
    ],
  },
  {
    sectionKey: 'NAV.SECTIONS.SETTINGS',
    roles: ['corporate'],
    isDropdown: true,
    items: [
      { labelKey: 'NAV.ITEMS.SITES', path: '/sites', roles: ['corporate'], icon: faBuilding },
      { labelKey: 'NAV.ITEMS.CSR_CATEGORIES', path: '/categories', roles: ['corporate'], icon: faFolderTree },
      { labelKey: 'NAV.ITEMS.USERS', path: '/admin/users', roles: ['corporate'], icon: faUser },
      { labelKey: 'NAV.ITEMS.AUDIT_LOG', path: '/admin/audit', roles: ['corporate'], icon: faClipboardList },
    ],
  },
];
