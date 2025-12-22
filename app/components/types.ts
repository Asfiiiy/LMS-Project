export type UserRole =
  | 'Admin'
  | 'Tutor'
  | 'Manager'
  | 'Student'
  | 'Moderator'
  | 'ManagerStudent'
  | 'InstituteStudent'
  | null;

export interface User {
  id?: number;
  name: string;
  role: UserRole;
}
