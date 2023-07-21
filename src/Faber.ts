import {
  ConnectionEventTypes,
  ConnectionRecord,
  ConnectionStateChangedEvent,
  CredentialExchangeRecord,
  DidCreateResult,
  DidDocument,
  DidOperationStateActionBase,
  HttpOutboundTransport,
  InitConfig,
  KeyType,
  TypedArrayEncoder,
  WsOutboundTransport,
  utils,
} from "@aries-framework/core";
import { BaseAgent } from "./BaseAgent";
import { RegisterCredentialDefinitionReturnStateFinished } from "@aries-framework/anoncreds";
import { Color, Output, greenText, purpleText, redText } from "../OutputClass";
import { HttpInboundTransport } from "@aries-framework/node";
import { CheqdDidCreateOptions } from "@aries-framework/cheqd";

export class Faber extends BaseAgent {
  public outOfBandId?: string;
  public credentialDefinition?: RegisterCredentialDefinitionReturnStateFinished;
  public anonCredsIssuerId?: string;
  private schemaResult: any;
  private schemaResultID: any;

  public constructor(port: number, name: string) {
    super({ port, name });
  }

  public static async initializeAgent(): Promise<Faber> {
    const faber = new Faber(3002, "faber");

    const config: InitConfig = {
      label: "faber",
      walletConfig: {
        id: "mainFaberWallet",
        key: "demoagentfaber00000000000000000000",
      },
    };

    await faber.initializeAgent(config);
    faber.agent.registerOutboundTransport(new WsOutboundTransport());

    // Register a simple `Http` outbound transport
    faber.agent.registerOutboundTransport(new HttpOutboundTransport());

    faber.agent.registerInboundTransport(
      new HttpInboundTransport({ port: 3002 })
    );
    return faber;
  }

  public async createDid() {
    console.log("Creating DID...");

    // Create a DID
    const cheqdDid = await this.agent.dids.create({
      method: "cheqd",
      // the secret contains a the verification method type and id
      secret: {
        verificationMethod: {
          id: "key-1",
          type: "Ed25519VerificationKey2020",
        },
      },
      // an optional methodSpecificIdAlgo parameter
      options: {
        network: "testnet",
        methodSpecificIdAlgo: "uuid",
      },
    });
    this.anonCredsIssuerId = cheqdDid.didState.did;

    console.log("cheqdDid: ", cheqdDid);
  }

  public async creatingSchema() {
    console.log("Creating schema...");
    this.schemaResult = await this.agent.modules.anoncreds.registerSchema({
      schema: {
        attrNames: ["name"],
        issuerId: this.anonCredsIssuerId!,
        name: "Example Schema to register",
        version: "1.0.0",
      },
      options: {},
    });

    if (this.schemaResult.schemaState.state === "failed") {
      throw new Error(
        `Error creating schema: ${this.schemaResult.schemaState.reason}`
      );
    }
    console.log("schemaResult: ", this.schemaResult);
    this.schemaResultID = this.schemaResult.schemaState.schemaId;
    console.log("schemaResultID: ", this.schemaResultID);
  }

  public async issueCredential(): Promise<CredentialExchangeRecord> {
    const connectionRecord = await this.getConnectionRecord();

    const anonCredsCredentialExchangeRecord =
      await this.agent.credentials.offerCredential({
        connectionId: connectionRecord.id,
        protocolVersion: "v2",
        credentialFormats: {
          anoncreds: {
            credentialDefinitionId:
              this.credentialDefinition!.credentialDefinitionId,
            attributes: [
              { name: "name", value: "Jane Doe" },
              { name: "age", value: "23" },
            ],
          },
        },
      });
    return anonCredsCredentialExchangeRecord;
  }

  private async getConnectionRecord() {
    console.log("Getting connection record...");
    console.log("this.outOfBandId: ", this.outOfBandId);
    if (!this.outOfBandId) {
      throw Error(redText(Output.MissingConnectionRecord));
    }

    const [connection] = await this.agent.connections.findAllByOutOfBandId(
      this.outOfBandId
    );
    console.log("connection: ", connection);

    if (!connection) {
      throw Error(redText(Output.MissingConnectionRecord));
    }

    return connection;
  }

  public async printInvite(): Promise<string> {
    const outOfBand = await this.agent.oob.createInvitation();
    this.outOfBandId = outOfBand.id;
    const connectionInvite = outOfBand.outOfBandInvitation.toUrl({
      domain: `http://localhost:3002`,
    });

    console.log(Output.ConnectionLink, connectionInvite, "\n");
    return connectionInvite;
  }

  private printSchema(name: string, version: string, attributes: string[]) {
    console.log(`\n\nThe credential definition will look like this:\n`);
    console.log(purpleText(`Name: ${Color.Reset}${name}`));
    console.log(purpleText(`Version: ${Color.Reset}${version}`));
    console.log(
      purpleText(
        `Attributes: ${Color.Reset}${attributes[0]}, ${attributes[1]}, ${attributes[2]}\n`
      )
    );
  }

  public async registerCredentialDefinition() {
    console.log("Creating credential definition...");

    if (!this.anonCredsIssuerId) {
      throw new Error(redText("Missing anoncreds issuerId"));
    }
    console.log("\nRegistering credential definition...\n");
    const { credentialDefinitionState } =
      await this.agent.modules.anoncreds.registerCredentialDefinition({
        credentialDefinition: {
          schemaId: this.schemaResultID,
          issuerId: this.anonCredsIssuerId,
          tag: "latest",
        },
        options: {
          endorserMode: "internal",
          endorserDid: this.anonCredsIssuerId,
        },
      });

    if (credentialDefinitionState.state !== "finished") {
      throw new Error(
        `Error registering credential definition: ${
          credentialDefinitionState.state === "failed"
            ? credentialDefinitionState.reason
            : "Not Finished"
        }}`
      );
    }

    this.credentialDefinition = credentialDefinitionState;
    console.log("\nCredential definition registered!!\n");
    console.log(this.credentialDefinition);
    return this.credentialDefinition;
  }

  private async printProofFlow(print: string) {
    console.log(print);
    await new Promise((f) => setTimeout(f, 2000));
  }

  private async newProofAttribute() {
    await this.printProofFlow(
      greenText(`Creating new proof attribute for 'name' ...\n`)
    );
    const proofAttribute = {
      name: {
        name: "name",
        restrictions: [
          {
            cred_def_id: this.credentialDefinition?.credentialDefinitionId,
          },
        ],
      },
    };

    return proofAttribute;
  }

  public async sendProofRequest() {
    const connectionRecord = await this.getConnectionRecord();
    const proofAttribute = await this.newProofAttribute();
    await this.printProofFlow(greenText("\nRequesting proof...\n", false));

    await this.agent.proofs.requestProof({
      protocolVersion: "v2",
      connectionId: connectionRecord.id,
      proofFormats: {
        anoncreds: {
          name: "proof-request",
          version: "1.0",
          requested_attributes: proofAttribute,
        },
      },
    });
    console.log(
      `\nProof request sent!\n\nGo to the Alice agent to accept the proof request\n\n${Color.Reset}`
    );
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
