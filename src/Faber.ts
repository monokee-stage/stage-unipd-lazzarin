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

export class Issuer extends BaseAgent {
  public outOfBandId?: string;
  public credentialDefinition?: RegisterCredentialDefinitionReturnStateFinished;
  public anonCredsIssuerId?: string;
  private schemaResult: any;

  public constructor(port: number, name: string) {
    super({ port, name });
  }

  public static async initializeAgent(): Promise<Issuer> {
    const faber = new Issuer(3002, "issuer");

    // Register a simple `Http` inbound transport
    faber.agent.registerInboundTransport(
      new HttpInboundTransport({ port: 3001 })
    );

    await faber.initializeAgent();
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
    this.anonCredsIssuerId = cheqdDid.didState.did;

    console.log("Creating schema...");
    this.schemaResult = await this.agent.modules.anoncreds.registerSchema({
      schema: {
        attrNames: ["name"],
        issuerId: this.anonCredsIssuerId,
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
  }

  public async RegisterCredentialDefinition() {
    const credentialDefinitionResult =
      await this.agent.modules.anoncreds.registerCredentialDefinition({
        credentialDefinition: {
          tag: "default",
          issuerId: this.anonCredsIssuerId,
          schemaId: this.schemaResult.schemaState.schemaId,
        },
        options: {},
      });

    if (
      credentialDefinitionResult.credentialDefinitionState.state === "failed"
    ) {
      throw new Error(
        `Error creating credential definition: ${credentialDefinitionResult.credentialDefinitionState.reason}`
      );
    }
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

  public async exit() {
    console.log(Output.Exit);
    await this.agent.shutdown();
    process.exit(0);
  }

  public async restart() {
    await this.agent.shutdown();
  }
}
