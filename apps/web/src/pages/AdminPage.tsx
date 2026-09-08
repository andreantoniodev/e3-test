import { Alert, Tabs } from 'antd';
import { AdminGateCard } from '../components/admin/AdminGateCard';
import { AdminToolbar } from '../components/admin/AdminToolbar';
import { AdminUnitsTab } from '../components/admin/AdminUnitsTab';
import { AdminUsersTab } from '../components/admin/AdminUsersTab';
import { IMAGES } from '../constants';
import { useAdmin } from '../hooks/useAdmin';

export function AdminPage() {
  const {
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
  } = useAdmin();

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
          <AdminGateCard
            secretInput={secretInput}
            error={error}
            onSecretInputChange={setSecretInput}
            onUnlock={handleUnlock}
          />
        ) : (
          <div className="admin-workspace">
            <AdminToolbar
              unitsCount={units.length}
              usersCount={users.length}
              loading={loading}
              onRefresh={() => void loadData(secret)}
              onLock={handleLock}
            />

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
                    <AdminUnitsTab
                      units={units}
                      unitForm={unitForm}
                      editingUnitId={editingUnitId}
                      savingUnit={savingUnit}
                      deletingUnitId={deletingUnitId}
                      loading={loading}
                      onSaveUnit={(values) => void handleSaveUnit(values)}
                      onCancelEdit={handleCancelEditUnit}
                      onEditUnit={handleEditUnit}
                      onDeleteUnit={(unit) => void handleDeleteUnit(unit)}
                    />
                  ),
                },
                {
                  key: 'users',
                  label: `Acessos (${users.length})`,
                  children: (
                    <AdminUsersTab
                      users={users}
                      units={units}
                      userForm={userForm}
                      editingUserId={editingUserId}
                      savingUser={savingUser}
                      deletingUserId={deletingUserId}
                      loading={loading}
                      onLinkUser={(values) => void handleLink(values)}
                      onCancelEdit={handleCancelEditUser}
                      onEditUser={handleEditUser}
                      onDeleteUser={(user) => void handleDeleteUser(user)}
                    />
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
