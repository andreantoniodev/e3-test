import {
  ArrowLeftOutlined,
  DeleteOutlined,
  EditOutlined,
  LinkOutlined,
  ReloadOutlined,
} from '@ant-design/icons';
import {
  Alert,
  Button,
  Form,
  Input,
  Popconfirm,
  Select,
  Space,
  Table,
  Tabs,
  message,
} from 'antd';
import { useCallback, useEffect, useState } from 'react';
import { flushSync } from 'react-dom';
import { IMAGES } from '../constants';
import {
  AdminUnit,
  AdminUser,
  adminFetch,
} from '../lib/api';
import { getFriendlyError } from '../lib/errors';

const SECRET_STORAGE_KEY = 'mini-crm-admin-secret';

type LinkFormValues = {
  email: string;
  unitId: string;
  name?: string;
};

type UnitFormValues = {
  name: string;
  slug?: string;
};

export function AdminPage() {
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

  const loadData = useCallback(async (adminSecret: string) => {
    setLoading(true);
    setError(null);
    try {
      const [nextUnits, nextUsers] = await Promise.all([
        adminFetch<AdminUnit[]>('/admin/units', adminSecret),
        adminFetch<AdminUser[]>('/admin/users', adminSecret),
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
  }, [userForm]);

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
      const payload = {
        name: values.name.trim(),
        slug: values.slug?.trim() || undefined,
      };
      if (editingUnitId) {
        await adminFetch<AdminUnit>(`/admin/units/${editingUnitId}`, secret, {
          method: 'PATCH',
          body: JSON.stringify(payload),
        });
        message.success('Unidade atualizada');
      } else {
        await adminFetch<AdminUnit>('/admin/units', secret, {
          method: 'POST',
          body: JSON.stringify(payload),
        });
        message.success('Unidade cadastrada');
      }
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
      await adminFetch<{ ok: boolean }>(`/admin/units/${unit.id}`, secret, {
        method: 'DELETE',
      });
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
      await adminFetch<AdminUser>('/admin/users', secret, {
        method: 'POST',
        body: JSON.stringify({
          email: values.email,
          unitId: values.unitId,
          name: values.name?.trim() || '',
        }),
      });
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
      await adminFetch<{ ok: boolean }>(`/admin/users/${user.id}`, secret, {
        method: 'DELETE',
      });
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

  const editingUnit = units.find((unit) => unit.id === editingUnitId);
  const editingUser = users.find((user) => user.id === editingUserId);

  return (
    <div className="admin-shell">
      <header className="admin-header">
        <div className="admin-header__brand">
          <img src={IMAGES.logoHeader} alt="E3 Digital" className="admin-header__logo" />
          <h1>Admin · Mini CRM</h1>
        </div>
      </header>

      <main className="admin-main">
        {!secret ? (
          <div className="admin-gate">
            <div className="admin-gate__card">
              <h2>Acesso admin</h2>
              <p>
                Informe o <code>ADMIN_SECRET</code> da API para gerenciar unidades e
                e-mails.
              </p>
              {error ? (
                <Alert type="error" showIcon message={error} style={{ marginBottom: 16 }} />
              ) : null}
              <Space.Compact style={{ width: '100%' }}>
                <Input.Password
                  size="large"
                  value={secretInput}
                  onChange={(event) => setSecretInput(event.target.value)}
                  placeholder="ADMIN_SECRET"
                  onPressEnter={handleUnlock}
                />
                <Button
                  type="primary"
                  size="large"
                  icon={<LinkOutlined />}
                  onClick={handleUnlock}
                >
                  Entrar
                </Button>
              </Space.Compact>
              <Button
                className="admin-gate__back"
                type="link"
                icon={<ArrowLeftOutlined />}
                href="/"
              >
                Voltar ao login
              </Button>
            </div>
          </div>
        ) : (
          <div className="admin-workspace">
            <div className="admin-toolbar">
              <div className="admin-toolbar__meta">
                <span>{units.length} unidades</span>
                <span className="admin-toolbar__dot" aria-hidden />
                <span>{users.length} acessos</span>
              </div>
              <div className="admin-toolbar__actions">
                <Button
                  icon={<ReloadOutlined />}
                  loading={loading}
                  onClick={() => void loadData(secret)}
                >
                  Atualizar
                </Button>
                <Button onClick={handleLock}>Trocar secret</Button>
                <Button icon={<ArrowLeftOutlined />} href="/">
                  Login
                </Button>
              </div>
            </div>

            {error ? (
              <Alert type="error" showIcon message={error} style={{ marginBottom: 16 }} />
            ) : null}

            <Tabs
              activeKey={activeTab}
              onChange={setActiveTab}
              className="admin-tabs"
              items={[
                {
                  key: 'units',
                  label: `Unidades (${units.length})`,
                  children: (
                    <div className="admin-panel">
                      <div className="admin-panel__form">
                        <div className="admin-panel__form-head">
                          <h3>{editingUnitId ? 'Editar unidade' : 'Nova unidade'}</h3>
                          {editingUnit ? (
                            <span className="admin-panel__editing">
                              Editando {editingUnit.name}
                            </span>
                          ) : null}
                        </div>
                        <Form
                          form={unitForm}
                          layout="vertical"
                          onFinish={handleSaveUnit}
                          requiredMark={false}
                          className="admin-inline-form"
                        >
                          <div className="admin-inline-form__fields">
                            <Form.Item
                              label="Nome"
                              name="name"
                              rules={[{ required: true, message: 'Informe o nome' }]}
                            >
                              <Input placeholder="Unidade Centro" />
                            </Form.Item>
                            <Form.Item label="Slug" name="slug">
                              <Input placeholder="Gerado do nome se vazio" />
                            </Form.Item>
                          </div>
                          <div className="admin-inline-form__actions">
                            {editingUnitId ? (
                              <Button onClick={handleCancelEditUnit}>Cancelar</Button>
                            ) : null}
                            <Button
                              type="primary"
                              htmlType="submit"
                              loading={savingUnit}
                              disabled={savingUnit}
                            >
                              {editingUnitId ? 'Salvar alterações' : 'Cadastrar'}
                            </Button>
                          </div>
                        </Form>
                      </div>

                      <Table
                        rowKey="id"
                        loading={loading}
                        dataSource={units}
                        pagination={false}
                        className="admin-table"
                        locale={{ emptyText: 'Nenhuma unidade cadastrada' }}
                        columns={[
                          {
                            title: 'Nome',
                            dataIndex: 'name',
                            render: (value: string, unit: AdminUnit) => (
                              <div className="admin-table__primary">
                                <strong>{value}</strong>
                                <span>{unit.slug}</span>
                              </div>
                            ),
                          },
                          {
                            title: 'Acessos',
                            key: 'users',
                            width: 110,
                            render: (_: unknown, unit: AdminUnit) =>
                              unit._count?.users ?? 0,
                          },
                          {
                            title: 'Conversas',
                            key: 'conversations',
                            width: 120,
                            render: (_: unknown, unit: AdminUnit) =>
                              unit._count?.conversations ?? 0,
                          },
                          {
                            title: '',
                            key: 'actions',
                            width: 100,
                            align: 'right' as const,
                            render: (_: unknown, unit: AdminUnit) => (
                              <Space size={4}>
                                <Button
                                  type="text"
                                  icon={<EditOutlined />}
                                  onClick={() => handleEditUnit(unit)}
                                  title="Editar"
                                />
                                <Popconfirm
                                  title="Excluir unidade?"
                                  description="Remove usuários, conversas e WhatsApp desta unidade."
                                  okText="Excluir"
                                  cancelText="Cancelar"
                                  okButtonProps={{ danger: true }}
                                  onConfirm={() => void handleDeleteUnit(unit)}
                                >
                                  <Button
                                    type="text"
                                    danger
                                    icon={<DeleteOutlined />}
                                    loading={deletingUnitId === unit.id}
                                    title="Excluir"
                                  />
                                </Popconfirm>
                              </Space>
                            ),
                          },
                        ]}
                      />
                    </div>
                  ),
                },
                {
                  key: 'users',
                  label: `Acessos (${users.length})`,
                  children: (
                    <div className="admin-panel">
                      <div className="admin-panel__form">
                        <div className="admin-panel__form-head">
                          <h3>
                            {editingUserId ? 'Alterar vínculo' : 'Vincular e-mail'}
                          </h3>
                          {editingUser ? (
                            <span className="admin-panel__editing">
                              Editando {editingUser.email}
                            </span>
                          ) : null}
                        </div>
                        <Form
                          form={userForm}
                          layout="vertical"
                          onFinish={handleLink}
                          requiredMark={false}
                          className="admin-inline-form"
                        >
                          <div className="admin-inline-form__fields admin-inline-form__fields--3">
                            <Form.Item
                              label="E-mail Google"
                              name="email"
                              rules={[
                                { required: true, message: 'Informe o e-mail' },
                                { type: 'email', message: 'E-mail inválido' },
                              ]}
                            >
                              <Input
                                placeholder="usuario@gmail.com"
                                autoComplete="off"
                                disabled={Boolean(editingUserId)}
                              />
                            </Form.Item>
                            <Form.Item label="Nome" name="name">
                              <Input placeholder="Opcional" />
                            </Form.Item>
                            <Form.Item
                              label="Unidade"
                              name="unitId"
                              rules={[
                                { required: true, message: 'Selecione a unidade' },
                              ]}
                            >
                              <Select
                                placeholder="Unidade"
                                options={units.map((unit) => ({
                                  value: unit.id,
                                  label: unit.name,
                                }))}
                                loading={loading && units.length === 0}
                              />
                            </Form.Item>
                          </div>
                          <div className="admin-inline-form__actions">
                            {editingUserId ? (
                              <Button onClick={handleCancelEditUser}>Cancelar</Button>
                            ) : null}
                            <Button
                              type="primary"
                              htmlType="submit"
                              icon={<LinkOutlined />}
                              loading={savingUser}
                              disabled={savingUser || units.length === 0}
                            >
                              {editingUserId ? 'Salvar alterações' : 'Vincular'}
                            </Button>
                          </div>
                        </Form>
                      </div>

                      <Table
                        rowKey="id"
                        loading={loading}
                        dataSource={users}
                        pagination={false}
                        className="admin-table"
                        locale={{ emptyText: 'Nenhum acesso cadastrado' }}
                        columns={[
                          {
                            title: 'E-mail',
                            dataIndex: 'email',
                            render: (value: string, user: AdminUser) => (
                              <div className="admin-table__primary">
                                <strong>{value}</strong>
                                <span>{user.name || 'Sem nome'}</span>
                              </div>
                            ),
                          },
                          {
                            title: 'Unidade',
                            key: 'unit',
                            width: 200,
                            render: (_: unknown, user: AdminUser) =>
                              user.unit?.name || '—',
                          },
                          {
                            title: '',
                            key: 'actions',
                            width: 100,
                            align: 'right' as const,
                            render: (_: unknown, user: AdminUser) => (
                              <Space size={4}>
                                <Button
                                  type="text"
                                  icon={<EditOutlined />}
                                  onClick={() => handleEditUser(user)}
                                  title="Editar"
                                />
                                <Popconfirm
                                  title="Excluir e-mail?"
                                  description={`${user.email} perderá acesso.`}
                                  okText="Excluir"
                                  cancelText="Cancelar"
                                  okButtonProps={{ danger: true }}
                                  onConfirm={() => void handleDeleteUser(user)}
                                >
                                  <Button
                                    type="text"
                                    danger
                                    icon={<DeleteOutlined />}
                                    loading={deletingUserId === user.id}
                                    title="Excluir"
                                  />
                                </Popconfirm>
                              </Space>
                            ),
                          },
                        ]}
                      />
                    </div>
                  ),
                },
              ]}
            />
          </div>
        )}
      </main>
    </div>
  );
}
