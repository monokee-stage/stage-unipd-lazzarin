import type { InitConfig } from "@aries-framework/core";

import {
  AnonCredsCredentialFormatService,
  AnonCredsModule,
  AnonCredsProofFormatService,
  LegacyIndyCredentialFormatService,
  LegacyIndyProofFormatService,
  V1CredentialProtocol,
  V1ProofProtocol,
} from "@aries-framework/anoncreds";
import { AnonCredsRsModule } from "@aries-framework/anoncreds-rs";
import { AskarModule } from "@aries-framework/askar";
import {
  CheqdAnonCredsRegistry,
  CheqdDidRegistrar,
  CheqdDidResolver,
  CheqdModule,
  CheqdModuleConfig,
} from "@aries-framework/cheqd";
import {
  ConnectionsModule,
  DidsModule,
  V2ProofProtocol,
  V2CredentialProtocol,
  ProofsModule,
  AutoAcceptProof,
  AutoAcceptCredential,
  CredentialsModule,
  Agent,
  HttpOutboundTransport,
  WsOutboundTransport,
} from "@aries-framework/core";
import { agentDependencies, HttpInboundTransport } from "@aries-framework/node";
import { anoncreds } from "@hyperledger/anoncreds-nodejs";
import { ariesAskar } from "@hyperledger/aries-askar-nodejs";

//type DemoAgent = Agent<ReturnType<typeof getAskarAnonCredsIndyModules>>;

export class BaseAgent {
  public port: number;
  public name: string;
  public config: InitConfig;
  public agent: Agent;
  public useLegacyIndySdk: boolean;

  public constructor({
    port,
    name,
    useLegacyIndySdk = false,
  }: {
    port: number;
    name: string;
    useLegacyIndySdk?: boolean;
  }) {
    this.name = name;
    this.port = port;

    const config = {
      label: name,
      walletConfig: {
        id: name,
        key: name,
      },
      endpoints: [`http://localhost:${this.port}`],
    } satisfies InitConfig;

    this.config = config;

    this.useLegacyIndySdk = useLegacyIndySdk;

    this.agent = new Agent({
      config,
      dependencies: agentDependencies,
      modules: getAskarAnonCredsIndyModules(),
    });
    this.agent.registerInboundTransport(new HttpInboundTransport({ port }));
    this.agent.registerOutboundTransport(new HttpOutboundTransport());
  }

  public async initializeAgent(config: InitConfig) {
    this.agent = new Agent({
      config,
      modules: {
        askar: new AskarModule({ ariesAskar }),
        anoncredsRs: new AnonCredsRsModule({ anoncreds }),
        connections: new ConnectionsModule({ autoAcceptConnections: true }),
        dids: new DidsModule({
          registrars: [new CheqdDidRegistrar()],
          resolvers: [new CheqdDidResolver()],
        }),
        anoncreds: new AnonCredsModule({
          registries: [new CheqdAnonCredsRegistry()],
        }),
        cheqd: new CheqdModule(
          new CheqdModuleConfig({
            networks: [
              {
                network: "testnet",
                cosmosPayerSeed:
                  "robust across amount corn curve panther opera wish toe ring bleak empower wreck party abstract glad average muffin picnic jar squeeze annual long aunt",
              },
            ],
          })
        ),
      },
      dependencies: agentDependencies,
    });

    // Register a simple `WebSocket` outbound transport
    this.agent.registerOutboundTransport(new WsOutboundTransport());

    // Register a simple `Http` outbound transport
    this.agent.registerOutboundTransport(new HttpOutboundTransport());

    await this.agent.initialize();

    console.log(`\nAgent ${this.name} created!\n`);
  }
}

function getAskarAnonCredsIndyModules() {
  const legacyIndyCredentialFormatService =
    new LegacyIndyCredentialFormatService();
  const legacyIndyProofFormatService = new LegacyIndyProofFormatService();

  return {
    connections: new ConnectionsModule({
      autoAcceptConnections: true,
    }),
    credentials: new CredentialsModule({
      autoAcceptCredentials: AutoAcceptCredential.ContentApproved,
      credentialProtocols: [
        new V1CredentialProtocol({
          indyCredentialFormat: legacyIndyCredentialFormatService,
        }),
        new V2CredentialProtocol({
          credentialFormats: [
            legacyIndyCredentialFormatService,
            new AnonCredsCredentialFormatService(),
          ],
        }),
      ],
    }),
    proofs: new ProofsModule({
      autoAcceptProofs: AutoAcceptProof.ContentApproved,
      proofProtocols: [
        new V1ProofProtocol({
          indyProofFormat: legacyIndyProofFormatService,
        }),
        new V2ProofProtocol({
          proofFormats: [
            legacyIndyProofFormatService,
            new AnonCredsProofFormatService(),
          ],
        }),
      ],
    }),
    anoncreds: new AnonCredsModule({
      registries: [new CheqdAnonCredsRegistry()],
    }),
    anoncredsRs: new AnonCredsRsModule({
      anoncreds,
    }),
    cheqd: new CheqdModule(
      new CheqdModuleConfig({
        networks: [
          {
            network: "testnet",
            cosmosPayerSeed:
              "robust across amount corn curve panther opera wish toe ring bleak empower wreck party abstract glad average muffin picnic jar squeeze annual long aunt",
          },
        ],
      })
    ),
    dids: new DidsModule({
      resolvers: [new CheqdDidResolver()],
      registrars: [new CheqdDidRegistrar()],
    }),
    askar: new AskarModule({
      ariesAskar,
    }),
  } as const;
}
