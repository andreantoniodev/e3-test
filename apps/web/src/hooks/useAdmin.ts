import { Form, message } from 'antd';
import { useCallback, useEffect, useState } from 'react';
import { flushSync } from 'react-dom';
import { getFriendlyError } from '../lib/errors';
import { adminService } from '../services/adminService';
import { AdminUnit, AdminUser, LinkFormValues, UnitFormValues } from '../types';

const SECRET_STORAGE_KEY = 'mini-crm-admin-secret';

export function useAdmin() {
  const [secretInput, setSecretInput] = useState('');
  const [secret, setSecret] = useState(
    () => sessionStorage.getItem(SECRET_STORAGE_KEY) || '',
  );
  const [units, setUnits] = useState<AdminUnit[]>([]);
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [loading, setLoading] = useState(false);
  const [savingUser, setSavingUser] = useState(false);
  const [savingUnit, setSavingUnit] = useState(false);
  const [deletingUserId, setDeletingUserId] = useState<string | null>(null);
  const [deletingUnitId, setDeletingUnitId] = useState<string | null>(null);
  const [editingUserId, setEditingUserId] = useState<string | null>(null);
  const [editingUnitId, setEditingUnitId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState('units');

  const [userForm] = Form.useForm<LinkFormValues>();
  const [unitForm] = Form.useForm<UnitFormValues>();

  const loadData = useCallback(
    async (adminSecret: string) => {
      setLoading(true);
      setError(null);
      try {
        const [nextUnits, nextUsers] = await Promise.all([
          adminService.getUnits(adminSecret),
          adminService.getUsers(adminSecret),
        ]);
        setUnits(nextUnits);
        setUsers(nextUsers);
        if (nextUnits[0] && !userForm.getFieldValue('unitId')) {
          userForm.setFieldValue('unitId', nextUnits[0].id);
        }
      } catch (err) {
        setUnits([]);
        setUsers([]);
        setError(getFriendlyError(err, 'Não foi possível carregar o admin.'));
      } finally {
        setLoading(false);
      }
    },
    [userForm],
  );

  useEffect(() => {
    if (!secret) {
      return;
    }
    void loadData(secret);
  }, [secret, loadData]);

  function handleUnlock() {
    const value = secretInput.trim();
    if (!value) {
      setError('Informe o ADMIN_SECRET.');
      return;
    }
    sessionStorage.setItem(SECRET_STORAGE_KEY, value);
    setSecret(value);
    setError(null);
  }

  function handleLock() {
    sessionStorage.removeItem(SECRET_STORAGE_KEY);
    setSecret('');
    setSecretInput('');
    setUnits([]);
    setUsers([]);
    setEditingUserId(null);
    setEditingUnitId(null);
    setError(null);
    userForm.resetFields();
    unitForm.resetFields();
  }

  function handleEditUser(user: AdminUser) {
    setEditingUserId(user.id);
    setActiveTab('users');
    setError(null);
    userForm.setFieldsValue({
      email: user.email,
      name: user.name || '',
      unitId: user.unitId,
    });
  }

  function handleCancelEditUser() {
    setEditingUserId(null);
    userForm.setFieldsValue({
      email: '',
      name: '',
      unitId: units[0]?.id,
    });
  }

  function handleEditUnit(unit: AdminUnit) {
    setEditingUnitId(unit.id);
    setActiveTab('units');
    setError(null);
    unitForm.setFieldsValue({
      name: unit.name,
      slug: unit.slug,
    });
  }

  function handleCancelEditUnit() {
    setEditingUnitId(null);
    unitForm.resetFields();
  }

  async function handleSaveUnit(values: UnitFormValues) {
    if (!secret) {
      return;
    }
    flushSync(() => {
      setSavingUnit(true);
      setError(null);
    });
    try {
      await adminService.saveUnit(secret, values, editingUnitId);
      message.success(
        editingUnitId ? 'Unidade atualizada' : 'Unidade cadastrada',
      );
      setEditingUnitId(null);
      unitForm.resetFields();
      await loadData(secret);
    } catch (err) {
      setError(getFriendlyError(err, 'Não foi possível salvar a unidade.'));
    } finally {
      setSavingUnit(false);
    }
  }

  async function handleDeleteUnit(unit: AdminUnit) {
    if (!secret) {
      return;
    }
    flushSync(() => {
      setDeletingUnitId(unit.id);
      setError(null);
    });
    try {
      await adminService.deleteUnit(secret, unit.id);
      message.success('Unidade removida');
      if (editingUnitId === unit.id) {
        handleCancelEditUnit();
      }
      if (userForm.getFieldValue('unitId') === unit.id) {
        userForm.setFieldValue('unitId', undefined);
      }
      await loadData(secret);
    } catch (err) {
      setError(getFriendlyError(err, 'Não foi possível excluir a unidade.'));
    } finally {
      setDeletingUnitId(null);
    }
  }

  async function handleLink(values: LinkFormValues) {
    if (!secret) {
      return;
    }
    flushSync(() => {
      setSavingUser(true);
      setError(null);
    });
    try {
      await adminService.saveUser(secret, values);
      message.success(
        editingUserId ? 'Vínculo atualizado' : 'E-mail vinculado à unidade',
      );
      setEditingUserId(null);
      userForm.setFieldsValue({ email: '', name: '', unitId: values.unitId });
      await loadData(secret);
    } catch (err) {
      setError(getFriendlyError(err, 'Não foi possível salvar o vínculo.'));
    } finally {
      setSavingUser(false);
    }
  }

  async function handleDeleteUser(user: AdminUser) {
    if (!secret) {
      return;
    }
    flushSync(() => {
      setDeletingUserId(user.id);
      setError(null);
    });
    try {
      await adminService.deleteUser(secret, user.id);
      message.success('E-mail removido');
      if (editingUserId === user.id) {
        handleCancelEditUser();
      }
      await loadData(secret);
    } catch (err) {
      setError(getFriendlyError(err, 'Não foi possível excluir o e-mail.'));
    } finally {
      setDeletingUserId(null);
    }
  }

  return {
    secretInput,
    setSecretInput,
    secret,
    units,
    users,
    loading,
    savingUser,
    savingUnit,
    deletingUserId,
    deletingUnitId,
    editingUserId,
    editingUnitId,
    error,
    activeTab,
    setActiveTab,
    userForm,
    unitForm,
    loadData,
    handleUnlock,
    handleLock,
    handleEditUser,
    handleCancelEditUser,
    handleEditUnit,
    handleCancelEditUnit,
    handleSaveUnit,
    handleDeleteUnit,
    handleLink,
    handleDeleteUser,
  };
}
