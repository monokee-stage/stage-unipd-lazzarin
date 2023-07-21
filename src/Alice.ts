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
import { HttpInboundTransport } from "@aries-framework/node";

export class Alice extends BaseAgent {
  public connected: boolean;
  connectionRecordFaberId: any;

  public constructor(port: number, name: string) {
    super({ port, name });
    this.connected = false;
  }

  public static async initializeAgent(): Promise<Alice> {
    const alice = new Alice(3002, "alice");

    const config: InitConfig = {
      label: "alice",
      walletConfig: {
        id: "mainAliceWallet",
        key: "demoagentalice00000000000000000000",
      },
    };

    await alice.initializeAgent(config);
    alice.agent.registerOutboundTransport(new WsOutboundTransport());

    // Register a simple `Http` outbound transport
    alice.agent.registerOutboundTransport(new HttpOutboundTransport());
    return alice;
  }

  private async getConnectionRecord() {
    if (!this.connectionRecordFaberId) {
      throw Error(redText(Output.MissingConnectionRecord));
    }
    return await this.agent.connections.getById(this.connectionRecordFaberId);
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
    const { connectionRecord } = await this.agent.oob.receiveInvitationFromUrl(
      invitationUrl
    );
    if (!connectionRecord) {
      throw new Error(redText(Output.NoConnectionRecordFromOutOfBand));
    }
    console.log(greenText(Output.ConnectionEstablished) + connectionRecord.id);
    return connectionRecord;
  }

  public async acceptCredentialOffer(
    credentialRecord: CredentialExchangeRecord
  ) {
    const linkSecretIds = await this.agent.modules.anoncreds.getLinkSecretIds();
    if (linkSecretIds.length === 0) {
      await this.agent.modules.anoncreds.createLinkSecret();
    }

    await this.agent.credentials.acceptOffer({
      credentialRecordId: credentialRecord.id,
    });
  }

  public async acceptProofRequest(proofRecord: ProofExchangeRecord) {
    const requestedCredentials =
      await this.agent.proofs.selectCredentialsForRequest({
        proofRecordId: proofRecord.id,
      });

    await this.agent.proofs.acceptRequest({
      proofRecordId: proofRecord.id,
      proofFormats: requestedCredentials.proofFormats,
    });
    console.log(greenText("\nProof request accepted!\n"));
  }

  public async sendMessage(message: string) {
    const connectionRecord = await this.getConnectionRecord();
    await this.agent.basicMessages.sendMessage(connectionRecord.id, message);
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
