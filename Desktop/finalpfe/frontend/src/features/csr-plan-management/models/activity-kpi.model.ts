export interface ActivityKpi {
  id: string;
  activity_id: string;
  name: string;
  target_value: number;
  actual_value: number | null;
  unit: string;
}
