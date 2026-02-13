# Sidebar Component

## Features

- **Role-based navigation:** Filters menu items based on the logged-in user role (`site` or `corporate`).  
- **Collapsible sidebar:** Toggle the sidebar between expanded and collapsed views.  
- **Dropdown sections:** Expandable/collapsible sections with multiple menu items.  
- **FontAwesome integration:** Uses `@fortawesome/angular-fontawesome` for icons.  
- **User panel:** Displays the logged-in user's email and role, with a logout button.  
- **Responsive and animated:** Smooth transitions for collapsing, expanding, and icon alignment.

---

## File Structure

### `sidebar.ts`
- Angular component logic for the sidebar.  
- Uses **Angular Signals** (`signal`, `computed`) for reactive state.  
- Handles:
  - Sidebar collapse/expand.
  - Filtering nav items by user role.
  - Tracking open dropdown sections.
  - Logout functionality.

### `sidebar.html`
- Sidebar template structure.
- Contains:
  - Brand section.
  - Toggle button for collapsing.
  - Navigation menu with icons and labels.
  - User panel and logout button.
- Dynamically adjusts layout based on `isCollapsed()` state.

### `sidebar.css`
- Sidebar styling with **Tailwind CSS utility classes**.
- Provides:
  - Layout and spacing.
  - Transitions for collapse/expand.
  - Alignment for icons and labels.
  - Styling for hover states and active routes.

### `nav-config.ts`
- Defines the sidebar navigation structure.
- Contains:
  - `NavSection` and `NavItem` interfaces.
  - `navItems` array with all sections, roles, paths, and icons.
- Integrates **FontAwesome icons** for each menu item.

---
