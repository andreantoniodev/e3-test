import { describe, expect, it } from 'vitest';
import { UsersController } from './users.controller';

describe('UsersController', () => {
  const controller = new UsersController();

  it('retorna os dados do perfil do usuário autenticado no formato MeResponse', () => {
    const user = {
      id: 'user-1',
      email: 'user@test.com',
      name: 'User Test',
      unitId: 'unit-1',
      createdAt: new Date(),
      updatedAt: new Date(),
      unit: {
        id: 'unit-1',
        name: 'Unidade A',
        slug: 'unidade-a',
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    };

    const me = controller.me(user);

    expect(me).toEqual({
      id: 'user-1',
      email: 'user@test.com',
      name: 'User Test',
      unit: {
        id: 'unit-1',
        name: 'Unidade A',
        slug: 'unidade-a',
      },
    });
  });
});
