import { Component, OnInit, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { SitesApi, UserSite, AssignUserPayload, UpdateUserSitePayload } from '../api/sites-api';
import { UsersApi, User } from '../../user-management/api/users-api';

@Component({
  selector: 'app-site-users',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './site-users.html',
  styleUrls: ['./site-users.css'],
})
export class SiteUsersComponent implements OnInit {

  // ── Données principales ───────────────────────────────────────────────────

  /** ID du site récupéré depuis l'URL (/sites/:id/users) */
  siteId: string = '';

  /** Nom du site (pour affichage) */
  siteName: string = '';

  /** Liste des utilisateurs affectés au site */
  users: UserSite[] = [];

  /** Liste de tous les utilisateurs disponibles (pour le modal d'affectation) */
  availableUsers: User[] = [];

  /** Indicateur de chargement — true pendant les appels HTTP */
  loading = false;

  /** Message d'erreur à afficher (rouge) */
  error = '';

  /** Message de succès à afficher (vert) — disparaît après 3s */
  success = '';

  // ── Modal : Affecter un utilisateur ──────────────────────────────────────

  /** Contrôle l'affichage du modal d'affectation */
  showAssignModal = false;

  /** Formulaire d'affectation — contient user_id, access_type, grade */
  assignForm: AssignUserPayload = {
    user_id: '',           // ID du user sélectionné
    access_type: 'READ_ONLY', // Type d'accès par défaut
    grade: null,           // Grade optionnel
  };

  // ── Modal : Modifier l'accès ──────────────────────────────────────────────

  /** Contrôle l'affichage du modal de modification */
  showEditModal = false;

  /** Utilisateur en cours de modification */
  editingUser: UserSite | null = null;

  /** Formulaire de modification — contient access_type et grade */
  editForm: UpdateUserSitePayload = {
    access_type: 'READ_ONLY',
    grade: null,
  };

  // ── Modal : Révoquer l'accès ──────────────────────────────────────────────

  /** Contrôle l'affichage du modal de confirmation de révocation */
  showRevokeModal = false;

  /** Utilisateur dont on veut révoquer l'accès */
  revokingUser: UserSite | null = null;

  // ── Constructeur ──────────────────────────────────────────────────────────

  constructor(
    private route: ActivatedRoute,      // Pour lire les paramètres de l'URL (:id)
    private router: Router,             // Pour la navigation (retour vers /sites)
    private sitesApi: SitesApi,         // Service HTTP pour les appels API sites
    private usersApi: UsersApi,         // Service HTTP pour les appels API users
    private cdr: ChangeDetectorRef      // Pour forcer Angular à re-render après les appels HTTP
  ) {}

  // ── Lifecycle ─────────────────────────────────────────────────────────────

  /**
   * S'exécute automatiquement au chargement du composant.
   * Récupère le siteId depuis l'URL et charge les données.
   */
  ngOnInit() {
    // Extrait l'ID du site depuis l'URL ex: /sites/abc123/users → "abc123"
    this.siteId = this.route.snapshot.paramMap.get('id') || '';
    console.log('siteId:', this.siteId);
    this.loadUsers();         // Charge les users affectés au site
    this.loadAvailableUsers(); // Charge tous les users pour le modal
  }

  // ── Chargement des données ────────────────────────────────────────────────

  /**
   * Charge la liste des utilisateurs affectés au site depuis le backend.
   * GET /api/sites/:siteId/users
   */
  loadUsers() {
    this.loading = true;
    this.sitesApi.getSiteUsers(this.siteId).subscribe({
      next: (data) => {
        // [...data] crée une nouvelle référence tableau
        // pour que Angular détecte le changement
        this.users = [...data];
        this.loading = false;
        console.log('loading:', this.loading, 'users:', this.users.length);
        // Force Angular à mettre à jour la vue
        // nécessaire au refresh de page (Change Detection)
        this.cdr.detectChanges();
      },
      error: (err) => {
        console.log('erreur:', err);
        this.error = 'Erreur lors du chargement des utilisateurs';
        this.loading = false;
        this.cdr.detectChanges();
      },
    });
  }

  /**
   * Charge tous les utilisateurs disponibles dans le système.
   * Utilisé pour peupler le select dans le modal d'affectation.
   * GET /api/users
   */
  loadAvailableUsers() {
    this.usersApi.list().subscribe({
      next: (data) => {
        this.availableUsers = data;
      },
      error: () => {}, // Silencieux — non critique
    });
  }

  // ── Affecter un utilisateur ───────────────────────────────────────────────

  /** Ouvre le modal d'affectation et réinitialise le formulaire */
  openAssignModal() {
    this.assignForm = { user_id: '', access_type: 'READ_ONLY', grade: null };
    this.showAssignModal = true;
  }

  /** Ferme le modal d'affectation */
  closeAssignModal() {
    this.showAssignModal = false;
  }

  /**
   * Soumet le formulaire d'affectation.
   * POST /api/sites/:siteId/users
   * Body: { user_id, access_type, grade }
   */
  submitAssign() {
    // Validation côté frontend avant l'appel HTTP
    if (!this.assignForm.user_id) {
      this.error = 'Veuillez sélectionner un utilisateur';
      return;
    }
    this.sitesApi.assignUser(this.siteId, this.assignForm).subscribe({
      next: () => {
        this.success = 'Utilisateur affecté avec succès';
        this.showAssignModal = false;
        this.loadUsers(); // Recharge la liste pour afficher le nouvel utilisateur
        setTimeout(() => (this.success = ''), 3000); // Cache le message après 3s
      },
      error: (err) => {
        // Affiche le message d'erreur retourné par le backend
        this.error = err?.error?.message || 'Erreur lors de l\'affectation';
        setTimeout(() => (this.error = ''), 3000);
      },
    });
  }

  // ── Modifier l'accès ──────────────────────────────────────────────────────

  /**
   * Ouvre le modal de modification pour un utilisateur donné.
   * Pré-remplit le formulaire avec les valeurs actuelles.
   */
  openEditModal(user: UserSite) {
    this.editingUser = user;
    // Pré-remplir le formulaire avec les valeurs actuelles du user
    this.editForm = {
      access_type: user.access_type as 'FULL' | 'READ_ONLY',
      grade: user.grade as any,
    };
    this.showEditModal = true;
  }

  /** Ferme le modal de modification et réinitialise l'utilisateur en cours */
  closeEditModal() {
    this.showEditModal = false;
    this.editingUser = null;
  }

  /**
   * Soumet le formulaire de modification.
   * PUT /api/sites/:siteId/users/:userId
   * Body: { access_type, grade }
   */
  submitEdit() {
    if (!this.editingUser) return;
    this.sitesApi.updateUserSite(this.siteId, this.editingUser.user_id, this.editForm).subscribe({
      next: () => {
        this.success = 'Accès mis à jour avec succès';
        this.showEditModal = false;
        this.loadUsers(); // Recharge la liste pour afficher les nouvelles valeurs
        setTimeout(() => (this.success = ''), 3000);
      },
      error: (err) => {
        this.error = err?.error?.message || 'Erreur lors de la mise à jour';
        setTimeout(() => (this.error = ''), 3000);
      },
    });
  }

  

  /** Ouvre le modal de confirmation de révocation pour un utilisateur donné */
  openRevokeModal(user: UserSite) {
    this.revokingUser = user;
    this.showRevokeModal = true;
  }

  /** Ferme le modal de révocation et réinitialise l'utilisateur en cours */
  closeRevokeModal() {
    this.showRevokeModal = false;
    this.revokingUser = null;
  }

  /**
   * Confirme et exécute la révocation de l'accès.
   * DELETE /api/sites/:siteId/users/:userId
   * Soft delete côté backend (is_active = false)
   */
  confirmRevoke() {
    if (!this.revokingUser) return;
    this.sitesApi.revokeUser(this.siteId, this.revokingUser.user_id).subscribe({
      next: () => {
        this.success = 'Accès révoqué avec succès';
        this.showRevokeModal = false;
        this.loadUsers(); // Recharge la liste — l'utilisateur révoqué disparaît
        setTimeout(() => (this.success = ''), 3000);
      },
      error: (err) => {
        this.error = err?.error?.message || 'Erreur lors de la révocation';
        setTimeout(() => (this.error = ''), 3000);
      },
    });
  }



  /**
   * Convertit le grade technique en label lisible.
   * ex: "level_0" → "Niveau 0"
   */
  getGradeLabel(grade: string): string {
    const labels: Record<string, string> = {
      level_0: 'Niveau 0',
      level_1: 'Niveau 1',
      level_2: 'Niveau 2',
    };
    return labels[grade] || '—'; // '—' si grade vide ou inconnu
  }

  /**
   * Convertit le type d'accès technique en label lisible.
   * ex: "FULL" → "Complet", "READ_ONLY" → "Lecture seule"
   */
  getAccessLabel(access: string): string {
    return access === 'FULL' ? 'Complet' : 'Lecture seule';
  }

  /** Navigue vers la liste des sites */
  goBack() {
    this.router.navigate(['/sites']);
  }

  /**
   * Getter qui retourne uniquement les utilisateurs pas encore affectés au site.
   * Utilisé pour peupler le select dans le modal d'affectation.
   * Evite d'afficher des users déjà affectés dans la liste de sélection.
   */
  get unassignedUsers(): User[] {
    // Récupère les IDs des users déjà affectés
    const assignedIds = this.users.map((u) => u.user_id);
    // Filtre pour ne garder que ceux qui ne sont pas dans la liste
    return this.availableUsers.filter((u) => !assignedIds.includes(u.id));
  }
}