import {
  ConnectionRecord,
  CredentialExchangeRecord,
  HttpOutboundTransport,
  InitConfig,
  ProofExchangeRecord,
  WsOutboundTransport,
} from "@aries-framework/core";
import { BaseAgent } from "./BaseAgent";
import { Output, greenText, redText } from "../OutputClass";

export class Holder extends BaseAgent {
  public connected: boolean;
  connectionRecordFaberId: any;

  public constructor(port: number, name: string) {
    super({ port, name });
    this.connected = false;
  }

  public static async initializeAgent(): Promise<Holder> {
    const alice = new Holder(3003, "holder");

    await alice.initializeAgent();
    return alice;
  }

  private async receiveConnectionRequest(invitationUrl: string) {
    const { connectionRecord } = await this.agent.oob.receiveInvitationFromUrl(
      invitationUrl
    );
    if (!connectionRecord) {
      throw new Error(redText(Output.NoConnectionRecordFromOutOfBand));
    }
    return connectionRecord;
  }

  private async waitForConnection(connectionRecord: ConnectionRecord) {
    connectionRecord = await this.agent.connections.returnWhenIsConnected(
      connectionRecord.id
    );
    this.connected = true;
    console.log(greenText(Output.ConnectionEstablished));
    return connectionRecord.id;
  }

  public async acceptConnection(invitation_url: string) {
    const connectionRecord = await this.receiveConnectionRequest(
      invitation_url
    );
    this.connectionRecordFaberId = await this.waitForConnection(
      connectionRecord
    );
  }

  public async acceptInvitation(invitationUrl: string) {
    const outOfBandRecord = await this.agent.oob.receiveInvitationFromUrl(
      invitationUrl
    );

    return outOfBandRecord;
  }

  public async exit() {
    console.log(Output.Exit);
    await this.agent.shutdown();
    process.exit(0);
  }

  public async restart() {
    await this.agent.shutdown();
  }
}
