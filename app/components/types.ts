export type UserRole =
  | 'Admin'
  | 'Assessor'
  | 'Manager'
  | 'Student'
  | 'Moderator'
  | 'Operation Manager'
  | 'Accounts Manager'
  | 'Administrative Manager'
  | 'Admission Manager'
  | 'Team Member'
  | 'Certificate Manager'
  | 'Claim Manager'
  | 'Consultation Manager'
  | 'ManagerStudent'
  | 'InstituteStudent'
  | null;

export interface User {
  id?: number;
  name: string;
  role: UserRole;
}
