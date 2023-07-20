import {
  ConnectionEventTypes,
  ConnectionRecord,
  ConnectionStateChangedEvent,
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

  public constructor(port: number, name: string) {
    super({ port, name });
  }

  public static async initializeAgent(): Promise<Faber> {
    const faber = new Faber(9000, "faber");

    const config: InitConfig = {
      label: "faber",
      walletConfig: {
        id: "mainFaberWallet",
        key: "demoagentfaber00000000000000000000",
      },
    };
    // Register a simple `WebSocket` outbound transport
    faber.agent.registerOutboundTransport(new WsOutboundTransport());

    // Register a simple `Http` outbound transport
    faber.agent.registerOutboundTransport(new HttpOutboundTransport());

    // Register a simple `Http` inbound transport
    faber.agent.registerInboundTransport(
      new HttpInboundTransport({ port: 3001 })
    );

    await faber.initializeAgent(config);
    return faber;
  }

  public async createDidandSchema() {
    console.log("Creating DID and Schema...");

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

    console.log("cheqdDid: ", cheqdDid);

    console.log("Creating schema...");
    const schemaResult = await this.agent.modules.anoncreds.registerSchema({
      schema: {
        attrNames: ["name"],
        issuerId: cheqdDid.didState.did,
        name: "Example Schema to register",
        version: "1.0.0",
      },
      options: {},
    });

    if (schemaResult.schemaState.state === "failed") {
      throw new Error(
        `Error creating schema: ${schemaResult.schemaState.reason}`
      );
    }
    console.log("schemaResult: ", schemaResult);
  }

  public async importDid(registry: string) {
    // NOTE: we assume the did is already registered on the ledger, we just store the private key in the wallet
    // and store the existing did in the wallet
    // indy did is based on private key (seed)
    const unqualifiedIndyDid = "2jEvRuKmfBJTRa7QowDpNN";
    const cheqdDid = "did:cheqd:testnet:d37eba59-513d-42d3-8f9f-d1df0548b675";

    const did = cheqdDid;
    await this.agent.dids.import({
      did,
      overwrite: true,
      privateKeys: [
        {
          keyType: KeyType.Ed25519,
          privateKey: TypedArrayEncoder.fromString(
            "afjdemoverysercure00000000000000"
          ),
        },
      ],
    });
    this.anonCredsIssuerId = did;
  }

  private async getConnectionRecord() {
    if (!this.outOfBandId) {
      throw Error(redText(Output.MissingConnectionRecord));
    }

    const [connection] = await this.agent.connections.findAllByOutOfBandId(
      this.outOfBandId
    );

    if (!connection) {
      throw Error(redText(Output.MissingConnectionRecord));
    }

    return connection;
  }

  public async printInvite(): Promise<string> {
    const outOfBand = await this.agent.oob.createInvitation();
    this.outOfBandId = outOfBand.id;
    const connectionInvite = outOfBand.outOfBandInvitation.toUrl({
      domain: `http://localhost:${this.port}`,
    });

    console.log(Output.ConnectionLink, connectionInvite, "\n");
    return connectionInvite;
  }

  private async waitForConnection() {
    if (!this.outOfBandId) {
      throw new Error(redText(Output.MissingConnectionRecord));
    }

    console.log("Waiting for Alice to finish connection...");

    const getConnectionRecord = (outOfBandId: string) =>
      new Promise<ConnectionRecord>((resolve, reject) => {
        // Timeout of 20 seconds
        const timeoutId = setTimeout(
          () => reject(new Error(redText(Output.MissingConnectionRecord))),
          20000000
        );

        // Start listener
        this.agent.events.on<ConnectionStateChangedEvent>(
          ConnectionEventTypes.ConnectionStateChanged,
          (e) => {
            if (e.payload.connectionRecord.outOfBandId !== outOfBandId) return;

            clearTimeout(timeoutId);
            resolve(e.payload.connectionRecord);
          }
        );

        // Also retrieve the connection record by invitation if the event has already fired
        void this.agent.connections
          .findAllByOutOfBandId(outOfBandId)
          .then(([connectionRecord]) => {
            if (connectionRecord) {
              clearTimeout(timeoutId);
              resolve(connectionRecord);
            }
          });
      });

    const connectionRecord = await getConnectionRecord(this.outOfBandId);

    try {
      await this.agent.connections.returnWhenIsConnected(connectionRecord.id);
    } catch (e) {
      console.log(
        redText(`\nTimeout of 20 seconds reached.. Returning to home screen.\n`)
      );
      return;
    }
    console.log(greenText(Output.ConnectionEstablished));
  }

  public async setupConnection() {
    await this.printInvite();
    await this.waitForConnection();
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

  private async registerSchema() {
    if (!this.anonCredsIssuerId) {
      throw new Error(redText("Missing anoncreds issuerId"));
    }
    const schemaTemplate = {
      name: "Faber College" + utils.uuid(),
      version: "1.0.0",
      attrNames: ["name", "degree", "date"],
      issuerId: this.anonCredsIssuerId,
    };
    this.printSchema(
      schemaTemplate.name,
      schemaTemplate.version,
      schemaTemplate.attrNames
    );

    const { schemaState } = await this.agent.modules.anoncreds.registerSchema({
      schema: schemaTemplate,
      options: {
        endorserMode: "internal",
        endorserDid: this.anonCredsIssuerId,
      },
    });

    if (schemaState.state !== "finished") {
      throw new Error(
        `Error registering schema: ${
          schemaState.state === "failed" ? schemaState.reason : "Not Finished"
        }`
      );
    }
    return schemaState;
  }

  private async registerCredentialDefinition(schemaId: string) {
    if (!this.anonCredsIssuerId) {
      throw new Error(redText("Missing anoncreds issuerId"));
    }

    console.log("\nRegistering credential definition...\n");
    const { credentialDefinitionState } =
      await this.agent.modules.anoncreds.registerCredentialDefinition({
        credentialDefinition: {
          schemaId,
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
    return this.credentialDefinition;
  }

  /*
  public async issueCredential() {
    const schema = await this.registerSchema();
    const credentialDefinition = await this.registerCredentialDefinition(
      schema.schemaId
    );
    const connectionRecord = await this.getConnectionRecord();

    console.log("\nSending credential offer...\n");

    await this.agent.credentials.offerCredential({
      connectionId: connectionRecord.id,
      protocolVersion: "v2",
      credentialFormats: {
        anoncreds: {
          attributes: [
            {
              name: "name",
              value: "Alice Smith",
            },
            {
              name: "degree",
              value: "Computer Science",
            },
            {
              name: "date",
              value: "01/01/2022",
            },
          ],
          credentialDefinitionId: credentialDefinition.credentialDefinitionId,
        },
      },
    });
    console.log(
      `\nCredential offer sent!\n\nGo to the Alice agent to accept the credential offer\n\n${Color.Reset}`
    );
  }
  */

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
