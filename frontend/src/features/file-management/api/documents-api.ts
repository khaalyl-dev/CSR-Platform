import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { Document } from '../models/document.model';

@Injectable({ providedIn: 'root' })
export class DocumentsApi {
  private apiUrl = '/api';

  constructor(private http: HttpClient) {}

  /** Tous les documents (corporate) ou documents des sites associés (site user). Optional entity_type + entity_id to filter by entity (e.g. ACTIVITY, activityId). */
  list(params?: { entity_type?: string; entity_id?: string }): Observable<Document[]> {
    const p: Record<string, string> = {};
    if (params?.entity_type) p['entity_type'] = params.entity_type;
    if (params?.entity_id) p['entity_id'] = params.entity_id;
    return this.http.get<Document[]>(`${this.apiUrl}/documents`, { params: p });
  }

  /** Documents liés à une entité (ex. photos d'une activité). */
  listByEntity(entityType: string, entityId: string): Observable<Document[]> {
    return this.http.get<Document[]>(`${this.apiUrl}/documents`, {
      params: { entity_type: entityType, entity_id: entityId },
    });
  }

  /** Documents d'un site spécifique */
  getBySite(siteId: string): Observable<Document[]> {
    return this.http.get<Document[]>(`${this.apiUrl}/documents/site/${siteId}`);
  }

  /** URL de téléchargement d'un fichier */
  getDownloadUrl(filePath: string): string {
    return `${this.apiUrl}/documents/download/${filePath}`;
  }

  /** URL pour afficher un fichier (ex. image dans img src). */
  getServeUrl(filePath: string): string {
    return `${this.apiUrl}/documents/serve/${filePath}`;
  }

  /** Upload file (e.g. for change request or activity photo). FormData: file, site_id, optional change_request_id, optional entity_type, entity_id */
  upload(formData: FormData): Observable<Document & { file_size?: number }> {
    return this.http.post<Document & { file_size?: number }>(`${this.apiUrl}/documents/upload`, formData);
  }

  deleteDocument(docId: string): Observable<{message: string}> {
  return this.http.delete<{message: string}>(`${this.apiUrl}/documents/${docId}`);
}

updateDocument(docId: string, data: { file_name?: string; file_type?: string; site_id?: string }): Observable<Document> {
  return this.http.put<Document>(`${this.apiUrl}/documents/${docId}`, data);
}
togglePin(docId: string): Observable<{message: string, is_pinned: boolean}> {
  return this.http.patch<{message: string, is_pinned: boolean}>(
    `${this.apiUrl}/documents/${docId}/pin`, {}
  );
} 
}