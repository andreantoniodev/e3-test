export type AuthUser = {
  id: string;
  email: string;
  name: string | null;
  unitId: string;
  unit: {
    id: string;
    name: string;
    slug: string;
  };
};
