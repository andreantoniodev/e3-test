import { DeleteOutlined, EditOutlined, LinkOutlined } from '@ant-design/icons';
import { Button, Form, FormInstance, Input, Popconfirm, Select, Space, Table } from 'antd';
import { AdminUnit, AdminUser, LinkFormValues } from '../../types';

interface AdminUsersTabProps {
  users: AdminUser[];
  units: AdminUnit[];
  userForm: FormInstance<LinkFormValues>;
  editingUserId: string | null;
  savingUser: boolean;
  deletingUserId: string | null;
  loading: boolean;
  onLinkUser: (values: LinkFormValues) => void;
  onCancelEdit: () => void;
  onEditUser: (user: AdminUser) => void;
  onDeleteUser: (user: AdminUser) => void;
}

export function AdminUsersTab({
  users,
  units,
  userForm,
  editingUserId,
  savingUser,
  deletingUserId,
  loading,
  onLinkUser,
  onCancelEdit,
  onEditUser,
  onDeleteUser,
}: AdminUsersTabProps) {
  const editingUser = users.find((user) => user.id === editingUserId);

  return (
    <div className="admin-panel">
      <div className="admin-panel__form">
        <div className="admin-panel__form-head">
          <h3>{editingUserId ? 'Alterar vínculo' : 'Vincular e-mail'}</h3>
          {editingUser ? (
            <span className="admin-panel__editing">Editando {editingUser.email}</span>
          ) : null}
        </div>
        <Form
          form={userForm}
          layout="vertical"
          onFinish={onLinkUser}
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
              rules={[{ required: true, message: 'Selecione a unidade' }]}
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
            {editingUserId ? <Button onClick={onCancelEdit}>Cancelar</Button> : null}
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
            render: (_: unknown, user: AdminUser) => user.unit?.name || '—',
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
                  onClick={() => onEditUser(user)}
                  title="Editar"
                />
                <Popconfirm
                  title="Excluir e-mail?"
                  description={`${user.email} perderá acesso.`}
                  okText="Excluir"
                  cancelText="Cancelar"
                  okButtonProps={{ danger: true }}
                  onConfirm={() => onDeleteUser(user)}
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
  );
}
