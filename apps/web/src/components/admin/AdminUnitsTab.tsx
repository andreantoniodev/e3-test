import { DeleteOutlined, EditOutlined } from '@ant-design/icons';
import { Button, Form, FormInstance, Input, Popconfirm, Space, Table } from 'antd';
import { AdminUnit, UnitFormValues } from '../../types';

interface AdminUnitsTabProps {
  units: AdminUnit[];
  unitForm: FormInstance<UnitFormValues>;
  editingUnitId: string | null;
  savingUnit: boolean;
  deletingUnitId: string | null;
  loading: boolean;
  onSaveUnit: (values: UnitFormValues) => void;
  onCancelEdit: () => void;
  onEditUnit: (unit: AdminUnit) => void;
  onDeleteUnit: (unit: AdminUnit) => void;
}

export function AdminUnitsTab({
  units,
  unitForm,
  editingUnitId,
  savingUnit,
  deletingUnitId,
  loading,
  onSaveUnit,
  onCancelEdit,
  onEditUnit,
  onDeleteUnit,
}: AdminUnitsTabProps) {
  const editingUnit = units.find((unit) => unit.id === editingUnitId);

  return (
    <div className="admin-panel">
      <div className="admin-panel__form">
        <div className="admin-panel__form-head">
          <h3>{editingUnitId ? 'Editar unidade' : 'Nova unidade'}</h3>
          {editingUnit ? (
            <span className="admin-panel__editing">Editando {editingUnit.name}</span>
          ) : null}
        </div>
        <Form
          form={unitForm}
          layout="vertical"
          onFinish={onSaveUnit}
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
            {editingUnitId ? <Button onClick={onCancelEdit}>Cancelar</Button> : null}
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
            render: (_: unknown, unit: AdminUnit) => unit._count?.users ?? 0,
          },
          {
            title: 'Conversas',
            key: 'conversations',
            width: 120,
            render: (_: unknown, unit: AdminUnit) => unit._count?.conversations ?? 0,
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
                  onClick={() => onEditUnit(unit)}
                  title="Editar"
                />
                <Popconfirm
                  title="Excluir unidade?"
                  description="Remove usuários, conversas e WhatsApp desta unidade."
                  okText="Excluir"
                  cancelText="Cancelar"
                  okButtonProps={{ danger: true }}
                  onConfirm={() => onDeleteUnit(unit)}
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
  );
}
