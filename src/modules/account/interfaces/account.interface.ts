
export interface IAccount {
  fullName: string;
  email: string;
  password: string;
  role: "admin" | "user";
  phone?: string;
  createdAt: Date;
  updatedAt: Date;
  // more....
}

