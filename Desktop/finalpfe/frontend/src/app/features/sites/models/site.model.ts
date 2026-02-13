export interface Site {
  id: number;
  name: string;
  city: string;
  country: string;
  manager: string;
  status: 'Active' | 'Inactive';
  location?: string;
  email?: string;
  createdAt?: Date;
  updatedAt?: Date;
}
