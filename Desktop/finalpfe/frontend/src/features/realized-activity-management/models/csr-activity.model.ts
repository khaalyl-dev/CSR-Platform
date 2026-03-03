/** CSR Activity - aligned with csr_activities table (for dropdown). */
export interface CsrActivity {
  id: string;
  plan_id: string;
  activity_number: string;
  title: string;
  category_id?: string;
  status?: string;
  planned_budget?: number | null;
}
