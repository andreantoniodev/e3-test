import { Logger } from '@nestjs/common';
import {
  OnGatewayConnection,
  OnGatewayDisconnect,
  WebSocketGateway,
  WebSocketServer,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';

@WebSocketGateway({
  cors: {
    origin: '*',
  },
})
export class EventsGateway implements OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer()
  server!: Server;

  private readonly logger = new Logger(EventsGateway.name);

  handleConnection(client: Socket) {
    const unitId =
      (client.handshake.query.unitId as string | undefined) ||
      (client.handshake.auth?.unitId as string | undefined);

    if (unitId) {
      const room = `unit:${unitId}`;
      void client.join(room);
      this.logger.log(`Cliente WebSocket conectado ao canal | socketId=${client.id} | room=${room}`);
    } else {
      this.logger.warn(`Cliente WebSocket conectado sem unitId | socketId=${client.id}`);
    }
  }

  handleDisconnect(client: Socket) {
    this.logger.log(`Cliente WebSocket desconectado | socketId=${client.id}`);
  }

  emitToUnit(unitId: string, event: string, payload: unknown) {
    if (!this.server) {
      return;
    }
    const room = `unit:${unitId}`;
    this.server.to(room).emit(event, payload);
    this.logger.debug(`Evento WebSocket emitido | room=${room} | event=${event}`);
  }
}
