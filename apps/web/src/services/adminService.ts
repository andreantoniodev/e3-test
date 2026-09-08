import { adminFetch } from '../lib/api';
import { AdminUnit, AdminUser, LinkFormValues, UnitFormValues } from '../types';

export const adminService = {
  getUnits: (secret: string) => adminFetch<AdminUnit[]>('/admin/units', secret),
  getUsers: (secret: string) => adminFetch<AdminUser[]>('/admin/users', secret),

  saveUnit: (secret: string, values: UnitFormValues, editingUnitId?: string | null) => {
    const payload = {
      name: values.name.trim(),
      slug: values.slug?.trim() || undefined,
    };
    if (editingUnitId) {
      return adminFetch<AdminUnit>(`/admin/units/${editingUnitId}`, secret, {
        method: 'PATCH',
        body: JSON.stringify(payload),
      });
    }
    return adminFetch<AdminUnit>('/admin/units', secret, {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  },

  deleteUnit: (secret: string, unitId: string) =>
    adminFetch<{ ok: boolean }>(`/admin/units/${unitId}`, secret, {
      method: 'DELETE',
    }),

  saveUser: (secret: string, values: LinkFormValues) =>
    adminFetch<AdminUser>('/admin/users', secret, {
      method: 'POST',
      body: JSON.stringify({
        email: values.email,
        unitId: values.unitId,
        name: values.name?.trim() || '',
      }),
    }),

  deleteUser: (secret: string, userId: string) =>
    adminFetch<{ ok: boolean }>(`/admin/users/${userId}`, secret, {
      method: 'DELETE',
    }),
};
