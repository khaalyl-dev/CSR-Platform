import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { Document } from '../models/document.model';

@Injectable({ providedIn: 'root' })
export class DocumentsApi {
  private apiUrl = '/api';

  constructor(private http: HttpClient) {}

  /** Tous les documents (corporate) ou documents des sites associés (site user) */
  list(): Observable<Document[]> {
    return this.http.get<Document[]>(`${this.apiUrl}/documents`);
  }

  /** Documents d'un site spécifique */
  getBySite(siteId: string): Observable<Document[]> {
    return this.http.get<Document[]>(`${this.apiUrl}/documents/site/${siteId}`);
  }

  /** URL de téléchargement d'un fichier */
  getDownloadUrl(filePath: string): string {
    return `${this.apiUrl}/documents/download/${filePath}`;
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